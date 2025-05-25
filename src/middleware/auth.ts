// auth.ts - Authentication middleware
import { Context, Next } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { verify } from "https://deno.land/x/djwt@v3.0.0/mod.ts";
import { getJwtSecret } from "../routes/auth.ts";

export async function authMiddleware(ctx: Context, next: Next) {
  try {
    // Get the token from the Authorization header
    const authHeader = ctx.request.headers.get("Authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Unauthorized: No token provided");
    }
    
    const token = authHeader.split(" ")[1];
    
    try {
      // Get the JWT secret
      const secretKey = await getJwtSecret();
      
      // Create crypto key for verification
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secretKey);
      const key = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        true,
        ["verify"]
      );
      
      // Verify the token
      const payload = await verify(token, key);
      
      // Set the user in the state for use in downstream handlers
      ctx.state.user = payload;
      
      await next();
    } catch (err) {
      throw new Error("Unauthorized: Invalid token");
    }
  } catch (err) {
    ctx.response.status = 401;
    ctx.response.body = {
      success: false,
      message: err.message || "Unauthorized",
    };
  }
}