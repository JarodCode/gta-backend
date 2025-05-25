// users.ts - API routes for users
import { Router } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { executeQuery, executeQueryAndReturnResults } from "../database.ts";
import { verify } from "https://deno.land/x/djwt@v3.0.0/mod.ts";
import { getJwtSecret } from "./auth.ts";
import { comparePassword, generateRandomAvatar } from "../utils.ts";

const router = new Router();

// Helper function to set JSON response
function setJsonResponse(ctx: any, status: number, data: any) {
  ctx.response.status = status;
  ctx.response.type = "application/json; charset=utf-8";
  ctx.response.body = data;
}

// Helper function to get user from JWT token
async function getUserFromToken(ctx: any) {
  try {
    // Get token from cookie
    const token = await ctx.cookies.get("auth_token");
    
    if (!token) {
      return null;
    }
    
    // Verify token
    const key = await getJwtSecret();
    const keyData = new TextEncoder().encode(key);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      true,
      ["verify"]
    );
    
    const payload = await verify(token, cryptoKey);
    return {
      id: Number(payload.user_id),
      username: String(payload.username)
    };
  } catch (error) {
    console.error("Error getting user from token:", error);
    return null;
  }
}

// Get user profile
router.get("/:username", async (ctx) => {
  try {
    const username = ctx.params.username;
    
    if (!username) {
      setJsonResponse(ctx, 400, { error: "Username is required" });
      return;
    }
    
    // Get user data
    const userQuery = `
      SELECT id, username, email, avatar_url, bio, created_at
      FROM users
      WHERE username = ?
    `;
    
    const userResult = await executeQuery(userQuery, [username]);
    
    if (!userResult.rows || userResult.rows.length === 0) {
      setJsonResponse(ctx, 404, { error: "User not found" });
      return;
    }
    
    const userData = {
      id: userResult.rows[0][0],
      username: userResult.rows[0][1],
      email: userResult.rows[0][2],
      avatar_url: userResult.rows[0][3] || generateRandomAvatar(username),
      bio: userResult.rows[0][4] || "",
      created_at: userResult.rows[0][5]
    };
    
    // Get user's reviews
    const reviewsQuery = `
      SELECT r.id, r.game_id, r.rating, r.content, r.created_at, r.updated_at
      FROM game_reviews r
      WHERE r.user_id = ?
      ORDER BY r.created_at DESC
    `;
    
    const reviewsResult = await executeQuery(reviewsQuery, [userData.id]);
    
    // Format reviews
    const reviews = reviewsResult.rows ? reviewsResult.rows.map((row: any[]) => ({
      id: row[0],
      game_id: row[1],
      rating: row[2],
      content: row[3],
      created_at: row[4],
      updated_at: row[5]
    })) : [];
    
    // Return user profile with reviews
    setJsonResponse(ctx, 200, {
      user: userData,
      reviews
    });
  } catch (error) {
    console.error("Error fetching user profile:", error);
    setJsonResponse(ctx, 500, { error: "Failed to fetch user profile" });
  }
});

export default router; 