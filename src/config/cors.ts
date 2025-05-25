/**
 * CORS Configuration
 * 
 * This file contains the CORS (Cross-Origin Resource Sharing) middleware configuration.
 * It allows controlled access to resources from different origins.
 */

import { CORS, SERVER } from "./constants.ts";
import { Context, Next } from "https://deno.land/x/oak@v17.1.4/mod.ts";

/**
 * CORS middleware function
 * Handles Cross-Origin Resource Sharing headers to allow controlled access from different origins
 * 
 * @param ctx - The Oak context object
 * @param next - The next middleware function
 */
export async function corsMiddleware(ctx: Context, next: Next): Promise<void> {
  // Get the origin from the request
  const requestOrigin = ctx.request.headers.get("Origin") || "";
  
  // In development mode, allow all origins
  if (SERVER.IS_DEVELOPMENT || CORS.ALLOWED_ORIGINS.includes("*")) {
    ctx.response.headers.set("Access-Control-Allow-Origin", requestOrigin || "*");
    ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    ctx.response.headers.set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
    
    if (CORS.EXPOSE_HEADERS.length > 0) {
      ctx.response.headers.set("Access-Control-Expose-Headers", CORS.EXPOSE_HEADERS.join(", "));
    }
  }
  // Check if the origin is specifically allowed
  else if (CORS.ALLOWED_ORIGINS.includes(requestOrigin)) {
    // Set CORS headers for allowed origins
    ctx.response.headers.set("Access-Control-Allow-Origin", requestOrigin);
    ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    ctx.response.headers.set("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    
    // Set additional headers
    if (CORS.ALLOW_CREDENTIALS) {
      ctx.response.headers.set("Access-Control-Allow-Credentials", "true");
    }
    
    if (CORS.EXPOSE_HEADERS.length > 0) {
      ctx.response.headers.set("Access-Control-Expose-Headers", CORS.EXPOSE_HEADERS.join(", "));
    }
  } else {
    console.log(`Blocked request from non-allowed origin: ${requestOrigin}`);
  }
  
  // Handle preflight requests
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204; // No content
    return;
  }
  
  // Continue to the next middleware
  await next();
} 