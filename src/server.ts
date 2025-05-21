// server.ts - Simple static file server with no database connections

import { Application, Router, send } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { parse } from "https://deno.land/std@0.220.0/path/mod.ts";

// Set up the server
const app = new Application();
const router = new Router();

// Log requests
app.use(async (ctx, next) => {
  console.log(`${ctx.request.method} ${ctx.request.url.pathname}`);
  try {
    await next();
  } catch (err) {
    console.error(err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal Server Error" };
  }
});

// Enable CORS
app.use(async (ctx, next) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*");
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  ctx.response.headers.set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204;
    return;
  }
  
  await next();
});

// Static files from frontend directory
router.get("/(.*)", async (ctx) => {
  const path = ctx.params[0] || "";
  
  // Special case for root path
  if (path === "") {
    await send(ctx, "index.html", {
      root: `${Deno.cwd()}/frontend`,
    });
    return;
  }
  
  // Attempt to serve the file directly
  try {
    await send(ctx, path, {
      root: `${Deno.cwd()}/frontend`,
    });
  } catch (e) {
    // If file not found, serve index.html (for SPAs)
    if (e instanceof Error && e.message.includes("Not Found")) {
      console.log(`File not found: ${path}, serving index.html instead`);
      await send(ctx, "index.html", {
        root: `${Deno.cwd()}/frontend`,
      });
    } else {
      throw e;
    }
  }
});

// Use router
app.use(router.routes());
app.use(router.allowedMethods());

// Start the server
const port = Number(Deno.env.get("PORT") || 8000);
console.log(`Server running on http://localhost:${port}`);

await app.listen({ port });
