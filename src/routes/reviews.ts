// reviews.ts - API routes for game reviews
import { Router } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { executeQuery, executeQueryAndReturnId, executeQueryAndReturnResults } from "../database.ts";
import { verify } from "https://deno.land/x/djwt@v3.0.0/mod.ts";
import { getJwtSecret } from "./auth.ts";
import { broadcastReviewNotification } from "../websockets/reviews.ts";
import { DB } from "https://deno.land/x/sqlite@v3.7.0/mod.ts";

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

// Get all reviews for a game
router.get("/game/:id", async (ctx) => {
  try {
    const gameId = ctx.params.id;
    
    if (!gameId) {
      setJsonResponse(ctx, 400, { error: "Game ID is required" });
      return;
    }
    
    console.log(`[REVIEWS] Fetching reviews for game ${gameId} - DIRECT DB ACCESS`);
    
    // Use direct DB access to avoid any potential issues with the executeQuery function
    const DB_PATH = "./data/database.sqlite";
    const db = new DB(DB_PATH);
    
    try {
      // Simple query to get reviews
      const query = `
        SELECT r.id, r.game_id, r.user_id, u.username, r.rating, r.content, r.created_at
        FROM game_reviews r
        LEFT JOIN users u ON r.user_id = u.id
        WHERE r.game_id = ?
        ORDER BY r.created_at DESC
      `;
      
      const results = [...db.query(query, [gameId])];
      console.log(`[REVIEWS] Direct query found ${results.length} reviews for game ${gameId}`);
      
      // Format the reviews
      const reviews = results.map(row => ({
        id: row[0],
        gameId: String(row[1]),
        userId: row[2],
        username: row[3] || 'Unknown User',
        rating: row[4],
        content: row[5],
        createdAt: row[6]
      }));
      
      // Close the database connection
      db.close();
      
      // Return the reviews
      setJsonResponse(ctx, 200, { reviews });
      
    } catch (dbError) {
      console.error(`[REVIEWS] Database error getting reviews for game ${gameId}:`, dbError);
      // Close the database connection
      db.close();
      setJsonResponse(ctx, 500, { error: `Failed to get reviews: ${dbError.message}` });
    }
  } catch (error) {
    console.error("[REVIEWS] Error getting reviews:", error);
    setJsonResponse(ctx, 500, { error: `Failed to get reviews: ${error.message}` });
  }
});

// Add a new review
router.post("/", async (ctx) => {
  try {
    // Get user from token
    const user = await getUserFromToken(ctx);
    
    if (!user) {
      setJsonResponse(ctx, 401, { error: "Authentication required" });
      return;
    }
    
    // Parse request body
    const body = await ctx.request.body.json();
    const { gameId, content, rating, gameTitle, gameCoverUrl } = body;
    
    console.log(`[REVIEWS] Adding review for game ${gameId} by user ${user.id}`);
    console.log(`[REVIEWS] Review content: "${content}", rating: ${rating}`);
    
    // Validate required fields
    if (!gameId) {
      setJsonResponse(ctx, 400, { error: "Game ID is required" });
      return;
    }
    
    if (!content || content.trim() === "") {
      setJsonResponse(ctx, 400, { error: "Review content is required" });
      return;
    }
    
    if (!rating || rating < 1 || rating > 5) {
      setJsonResponse(ctx, 400, { error: "Rating must be between 1 and 5" });
      return;
    }
    
    // Check if user already has a review for this game
    const checkQuery = `
      SELECT id FROM game_reviews
      WHERE game_id = ? AND user_id = ?
    `;
    
    const checkResult = await executeQuery(checkQuery, [gameId, user.id]);
    
    let reviewId;
    
    // If user already has a review, update it instead of inserting a new one
    if (checkResult.rows && checkResult.rows.length > 0) {
      const existingReviewId = checkResult.rows[0][0];
      
      // Update existing review
      const updateQuery = `
        UPDATE game_reviews
        SET rating = ?, content = ?, updated_at = datetime('now')
        WHERE id = ?
      `;
      
      await executeQuery(updateQuery, [rating, content, existingReviewId]);
      reviewId = existingReviewId;
      
      console.log(`[REVIEWS] Updated existing review ${existingReviewId} for game ${gameId} by user ${user.id}`);
    } else {
      // Insert new review
      const insertQuery = `
        INSERT INTO game_reviews (game_id, user_id, rating, content, created_at, updated_at)
        VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
      `;
      
      await executeQuery(insertQuery, [
        gameId,
        user.id,
        rating,
        content
      ]);
      
      try {
        // For SQLite, get the last inserted ID
        const lastIdResult = await executeQuery("SELECT last_insert_rowid()");
        console.log("[REVIEWS] Last insert ID result:", JSON.stringify(lastIdResult));
        
        if (lastIdResult && lastIdResult.rows && lastIdResult.rows.length > 0) {
          reviewId = lastIdResult.rows[0][0];
        } else {
          // Fallback to timestamp if we can't get the ID
          reviewId = Date.now().toString();
        }
      } catch (idError) {
        console.error("[REVIEWS] Error getting last insert ID:", idError);
        // Fallback to timestamp
        reviewId = Date.now().toString();
      }
      
      console.log(`[REVIEWS] Created new review ${reviewId} for game ${gameId} by user ${user.id}`);
    }
    
    // Create review object for response
    const review = {
      id: reviewId.toString(),
      gameId: String(gameId), // Convert to string to match frontend expectations
      userId: user.id,
      username: user.username,
      content,
      rating: Number(rating),
      gameTitle: gameTitle || 'Unknown Game',
      gameCoverUrl: gameCoverUrl || '',
      createdAt: new Date().toISOString()
    };
    
    // Broadcast the review to all connected clients
    try {
      broadcastReviewNotification({
        type: "new_review",
        gameId: String(gameId), // Convert to string to match frontend expectations
        review
      });
      console.log(`[REVIEWS] Broadcast review notification for game ${gameId}`);
    } catch (wsError) {
      console.error("[REVIEWS] Error broadcasting review notification:", wsError);
      // Continue anyway, this shouldn't fail the request
    }
    
    setJsonResponse(ctx, 201, { review });
  } catch (error) {
    console.error("[REVIEWS] Error adding review:", error);
    setJsonResponse(ctx, 500, { error: "Failed to add review" });
  }
});

// Delete a review
router.delete("/:id", async (ctx) => {
  try {
    const reviewId = ctx.params.id;
    
    // Get user from token
    const user = await getUserFromToken(ctx);
    
    if (!user) {
      setJsonResponse(ctx, 401, { error: "Authentication required" });
      return;
    }
    
    // Check if the review exists and belongs to the user
    const checkQuery = `
      SELECT game_id FROM game_reviews
      WHERE id = ? AND user_id = ?
    `;
    
    const checkResult = await executeQuery(checkQuery, [reviewId, user.id]);
    
    if (!checkResult.rows || checkResult.rows.length === 0) {
      setJsonResponse(ctx, 404, { error: "Review not found or you don't have permission to delete it" });
      return;
    }
    
    const gameId = checkResult.rows[0][0];
    
    // Delete the review
    const deleteQuery = `
      DELETE FROM game_reviews
      WHERE id = ?
    `;
    
    await executeQuery(deleteQuery, [reviewId]);
    
    setJsonResponse(ctx, 200, { success: true, gameId: String(gameId) });
  } catch (error) {
    console.error("[REVIEWS] Error deleting review:", error);
    setJsonResponse(ctx, 500, { error: "Failed to delete review" });
  }
});

export default router; 