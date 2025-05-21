// Main server entry point - Simple redirection to server.ts
import { Application, Router, send } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import authRoutes from "./src/routes/auth.ts";
import * as path from "https://deno.land/std@0.201.0/path/mod.ts";

const app = new Application();
const router = new Router();

// Logging middleware
app.use(async (ctx, next) => {
  console.log(`${ctx.request.method} ${ctx.request.url.pathname}`);
  try {
    await next();
  } catch (err) {
    console.error("Server error:", err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal Server Error" };
  }
});

// Enhanced CORS middleware
app.use(async (ctx, next) => {
  // Get the origin from the request header or use * as fallback
  const requestOrigin = ctx.request.headers.get("Origin") || "*";
  
  // For better security, we should check against a list of allowed origins
  // but for development, we'll accept any origin
  ctx.response.headers.set("Access-Control-Allow-Origin", requestOrigin);
  
  // Allow credentials (cookies, authorization headers, etc.)
  ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
  
  // Allow common methods
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
  
  // Allow common headers plus Authorization
  ctx.response.headers.set("Access-Control-Allow-Headers", 
    "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control");
  
  // Allow browsers to cache preflight results for 1 hour (3600 seconds)
  ctx.response.headers.set("Access-Control-Max-Age", "3600");
  
  // Handle preflight OPTIONS requests
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204; // No content
    console.log("Responded to OPTIONS preflight request");
    return;
  }
  
  // Continue to the next middleware
  await next();
});

// JSON response formatter middleware
app.use(async (ctx, next) => {
  // Save the original body setter
  const originalBody = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(ctx.response), "body");
  
  // Override the body setter
  Object.defineProperty(ctx.response, "body", {
    configurable: true,
    enumerable: true,
    get() {
      return originalBody.get.call(this);
    },
    set(value) {
      // If the value is an object and not null, ensure it's properly formatted as JSON
      if (typeof value === "object" && value !== null) {
        // Set content type to JSON
        ctx.response.type = "application/json; charset=utf-8";
        
        try {
          // Format as clean JSON
          const jsonString = JSON.stringify(value);
          originalBody.set.call(this, jsonString);
          console.log(`Response formatted as JSON: ${jsonString.substring(0, 100)}${jsonString.length > 100 ? '...' : ''}`);
        } catch (e) {
          console.error("Error formatting JSON response:", e);
          originalBody.set.call(this, JSON.stringify({ error: "Error formatting response" }));
        }
      } else {
        // Use the original setter for non-object values
        originalBody.set.call(this, value);
      }
    },
  });
  
  await next();
  
  // Restore the original body setter
  Object.defineProperty(ctx.response, "body", originalBody);
});

// Database initialization
import { initDatabase } from "./src/database.ts";
await initDatabase();

// Setup API routes
router.use("/api/auth", authRoutes.routes(), authRoutes.allowedMethods());

// Error logging for API routes
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (error) {
    console.error(`API Error at ${ctx.request.url.pathname}:`, error);
    ctx.response.status = error.status || 500;
    ctx.response.type = "application/json; charset=utf-8";
    ctx.response.body = JSON.stringify({ error: error.message || "Internal Server Error" });
  }
});

// Resolve frontend directory path - check both backend/frontend and ../frontend
let frontendDir;
try {
  // First try one directory up (project root/frontend)
  const rootPath = path.resolve(Deno.cwd(), "..");
  const frontendPath = path.join(rootPath, "frontend");
  const frontendStat = Deno.statSync(frontendPath);
  if (frontendStat.isDirectory) {
    frontendDir = frontendPath;
  }
} catch (e) {
  console.error("Error checking for ../frontend:", e);
  
  try {
    // Then try local frontend directory
    const localFrontendPath = path.join(Deno.cwd(), "frontend");
    const localFrontendStat = Deno.statSync(localFrontendPath);
    if (localFrontendStat.isDirectory) {
      frontendDir = localFrontendPath;
    }
  } catch (e) {
    console.error("Error checking for ./frontend:", e);
    throw new Error("Could not find frontend directory");
  }
}

console.log("Serving static files from:", frontendDir);

// Static files from frontend directory
router.get("/(.*)", async (ctx) => {
  const reqPath = ctx.params[0] || "";
  console.log(`Serving static file: ${reqPath || "index.html"}`);
  
  // Special case for root path
  if (reqPath === "") {
    try {
      await send(ctx, "index.html", {
        root: frontendDir,
      });
      return;
    } catch (e) {
      console.error("Error serving index.html:", e);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to serve index.html" };
      return;
    }
  }
  
  // Attempt to serve the file directly
  try {
    await send(ctx, reqPath, {
      root: frontendDir,
    });
  } catch (e) {
    // If file not found, serve index.html (for SPAs)
    if (e instanceof Error && e.message.includes("Not Found")) {
      console.log(`File not found: ${reqPath}, serving index.html instead`);
      try {
        await send(ctx, "index.html", {
          root: frontendDir,
        });
      } catch (indexError) {
        console.error("Error serving index.html as fallback:", indexError);
        ctx.response.status = 500;
        ctx.response.body = { error: "Failed to serve index.html fallback" };
      }
    } else {
      console.error(`Error serving ${reqPath}:`, e);
      ctx.response.status = 500;
      ctx.response.body = { error: `Failed to serve file: ${reqPath}` };
    }
  }
});

// Use router
app.use(router.routes());
app.use(router.allowedMethods());

// Parse command line arguments
const port = Deno.args[0] || "8000";

// Start server
console.log(`Server running on http://localhost:${port}`);
await app.listen({ port: parseInt(port) });
