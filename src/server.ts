// server.ts - Main server file for GTA (Game Tracking App)
import { Application, Router, Context, send } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { oakCors } from "https://deno.land/x/cors/mod.ts";
import { initDatabase } from "./database.ts";
import { authRouter } from "./routes/auth.ts";
import { chatRouter } from "./routes/chat.ts";
import { setupWebsockets } from "./websockets/chat.ts";
import { authMiddleware } from "./middleware/auth.ts";
import { loggerMiddleware } from "./middleware/logger.ts";

// Initialize the database
await initDatabase();

const app = new Application();
const router = new Router();

// Middlewares
app.use(loggerMiddleware);
app.use(oakCors({
  origin: "https://localhost:3000", // Frontend URL
  credentials: true,
}));

// API routes
app.use(authRouter.routes());
app.use(authRouter.allowedMethods());

// Protected routes - require authentication
app.use(authMiddleware);
app.use(chatRouter.routes());
app.use(chatRouter.allowedMethods());

// Error handling
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    ctx.response.status = err.status || 500;
    ctx.response.body = {
      success: false,
      message: err.message || "Internal Server Error",
    };
    console.error(`Error: ${err.message}`);
  }
});

// Health check endpoint
router.get("/api/health", (ctx: Context) => {
  ctx.response.body = { status: "ok", timestamp: new Date() };
});

app.use(router.routes());
app.use(router.allowedMethods());

// Setup WebSockets for chat
setupWebsockets(app);

// Start the server
const PORT = 8000;
console.log(`Server running on http://localhost:${PORT}`);

await app.listen({ port: PORT });