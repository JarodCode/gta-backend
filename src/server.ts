/**
 * Main Server File
 * 
 * This is the entry point for the application.
 * It sets up the server, middleware, routes, and starts listening for requests.
 */

import { Application } from "https://deno.land/x/oak@v12.5.0/mod.ts";
import { oakCors } from "https://deno.land/x/cors@v1.2.2/mod.ts";
import { load } from "https://deno.land/std@0.207.0/dotenv/mod.ts";
import { SERVER, CORS } from "./config/constants.ts";
import router from "./routes/index.ts";
import { errorMiddleware } from "./middleware/error.ts";
import { corsMiddleware } from "./config/cors.ts";
import logger from "./utils/logger.ts";
import db from "./services/database-service.ts";

// Load environment variables
try {
  const envFilePath = Deno.env.get("ENV_FILE") || ".env";
  await load({ envPath: envFilePath });
  logger.info(`Environment variables loaded from ${envFilePath}`);
} catch (error) {
  logger.warn(`Failed to load environment variables: ${error.message}`);
}

// Create application
const app = new Application();

// Initialize database
await db.initialize().catch(error => {
  logger.fatal("Failed to initialize database", error);
  Deno.exit(1);
});

// Add middleware
app.use(errorMiddleware);
app.use(corsMiddleware);

// Add logging for requests
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  logger.httpRequest(ctx.request.method, ctx.request.url.pathname, ctx.response.status, ms);
});

// Add router
app.use(router.routes());
app.use(router.allowedMethods());

// Start server
const port = Number(Deno.env.get("PORT")) || SERVER.PORT;
app.addEventListener("listen", ({ port }) => {
  logger.info(`Server running on http://localhost:${port}`);
  logger.info(`Environment: ${Deno.env.get("ENVIRONMENT") || "development"}`);
});

await app.listen({ port });

// Handle shutdown
Deno.addSignalListener("SIGINT", () => {
  logger.info("Shutting down server...");
  db.close().then(() => {
    logger.info("Database connection closed");
    Deno.exit(0);
  }).catch(error => {
    logger.error("Error closing database connection", error);
    Deno.exit(1);
  });
});

Deno.addSignalListener("SIGTERM", () => {
  logger.info("Shutting down server...");
  db.close().then(() => {
    logger.info("Database connection closed");
    Deno.exit(0);
  }).catch(error => {
    logger.error("Error closing database connection", error);
    Deno.exit(1);
  });
});
