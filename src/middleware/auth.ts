// auth.ts - Authentication middleware
import { Context, Next } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { verifyJwt } from "https://deno.land/x/djwt/mod.ts";
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
      // Verify the token
      const payload = await verifyJwt(token, await getJwtSecret());
      
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