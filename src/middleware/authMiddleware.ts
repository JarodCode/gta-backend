// authMiddleware.ts - Authentication middleware for protected routes
import { Context, Next } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { verify } from "https://deno.land/x/djwt@v3.0.0/mod.ts";

const SECRET_KEY = Deno.env.get("JWT_SECRET") || "super-secret-jwt-key-for-game-tracking-app";

// Convert string to crypto key for JWT
const getJwtKey = async () => {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SECRET_KEY);
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );
};

export async function authMiddleware(ctx: Context, next: Next) {
  try {
    // Get authorization header
    const authHeader = ctx.request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Unauthorized" };
      return;
    }
    
    // Extract token
    const token = authHeader.split(" ")[1];
    
    // Verify token
    try {
      const key = await getJwtKey();
      const payload = await verify(token, key);
      
      // Set user ID in context state for use in routes
      ctx.state.user = {
        id: payload.user_id,
        username: payload.username
      };
      
      await next();
    } catch (error) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Invalid or expired token" };
    }
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Authentication verification failed" };
  }
} 