// Game-related routes
import { Router } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { executeQuery } from "../database.ts";
import { authMiddleware } from "../middleware/auth.ts";

const router = new Router();

// Get ratings for all games
router.get("/ratings", async (ctx) => {
  try {
    console.log("Fetching ratings for all games");
    
    // First check if there are any reviews at all
    const checkQuery = `SELECT COUNT(*) FROM game_reviews`;
    const checkResult = await executeQuery(checkQuery);
    
    console.log(`Total reviews in database: ${checkResult.rows?.[0]?.[0] || 0}`);
    
    if (!checkResult.rows || checkResult.rows.length === 0 || checkResult.rows[0][0] === 0) {
      console.log("No reviews found in database");
      ctx.response.body = [];
      return;
    }
    
    // Query to get average rating and count for each game
    const query = `
      SELECT 
        game_id,
        AVG(rating) as average_rating,
        COUNT(*) as rating_count
      FROM game_reviews
      GROUP BY game_id
    `;
    
    try {
      const result = await executeQuery(query);
      console.log(`Rating query returned ${result.rows?.length || 0} rows`);
      
      // Format the response
      const ratings = result.rows.map((row: any) => {
        console.log(`Game ${row[0]}: avg=${row[1]}, count=${row[2]}`);
        return {
          game_id: String(row[0]),
          average_rating: parseFloat(row[1] || 0).toFixed(1),
          rating_count: row[2]
        };
      });
      
      ctx.response.body = ratings;
    } catch (error) {
      console.error('Error executing ratings query:', error);
      ctx.response.body = []; // Return empty array on error
    }
  } catch (error) {
    console.error("Error fetching game ratings:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to fetch game ratings" };
  }
});

// Get ratings for a specific game
router.get("/:gameId/ratings", async (ctx) => {
  try {
    const gameId = ctx.params.gameId;
    
    if (!gameId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Game ID is required" };
      return;
    }
    
    console.log(`Fetching ratings for game ${gameId}`);
    
    // First check if there are any reviews for this game
    const checkQuery = `SELECT COUNT(*) FROM game_reviews WHERE game_id = ?`;
    const checkResult = await executeQuery(checkQuery, [gameId]);
    
    console.log(`Reviews for game ${gameId}: ${checkResult.rows?.[0]?.[0] || 0}`);
    
    if (!checkResult.rows || checkResult.rows.length === 0 || checkResult.rows[0][0] === 0) {
      console.log(`No reviews found for game ${gameId}`);
      ctx.response.body = {
        game_id: String(gameId),
        average_rating: "0.0",
        rating_count: 0
      };
      return;
    }
    
    // Query to get average rating and count for the specified game
    const query = `
      SELECT 
        AVG(rating) as average_rating,
        COUNT(*) as rating_count
      FROM game_reviews
      WHERE game_id = ?
    `;
    
    const result = await executeQuery(query, [gameId]);
    console.log(`Rating query result for game ${gameId}:`, JSON.stringify(result));
    
    if (!result.rows || result.rows.length === 0 || result.rows[0][1] === 0) {
      ctx.response.body = {
        game_id: String(gameId),
        average_rating: "0.0",
        rating_count: 0
      };
      return;
    }
    
    const avgRating = parseFloat(result.rows[0][0] || 0).toFixed(1);
    const count = result.rows[0][1] || 0;
    
    console.log(`Game ${gameId}: avg=${avgRating}, count=${count}`);
    
    ctx.response.body = {
      game_id: String(gameId),
      average_rating: avgRating,
      rating_count: count
    };
  } catch (error) {
    console.error(`Error fetching ratings for game ${ctx.params.gameId}:`, error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to fetch game ratings" };
  }
});

export default router; 