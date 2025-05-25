/**
 * Game Controller
 * 
 * Handles HTTP requests related to game operations:
 * - Game search and retrieval
 * - Game details and metadata
 * - Game ratings and reviews
 */

import { RouterContext } from "https://deno.land/x/oak@v12.5.0/mod.ts";
import gameService from "../services/game-service.ts";
import apiService from "../services/api-service.ts";
import { BadRequestError, NotFoundError } from "../utils/errors.ts";
import logger from "../utils/logger.ts";
import { sendSuccess, sendCreated, sendNoContent } from "../utils/response.ts";

// Define the extended Context type with params and state
type Context = RouterContext<string>;

/**
 * Game controller class
 */
export class GameController {
  /**
   * Search for games
   * @param ctx - Oak context
   */
  async searchGames(ctx: Context): Promise<void> {
    try {
      // Get search query
      const query = ctx.request.url.searchParams.get("q") || "";
      
      if (!query) {
        throw new BadRequestError("Search query is required");
      }
      
      // Get pagination parameters
      const limit = parseInt(ctx.request.url.searchParams.get("limit") || "20");
      const offset = parseInt(ctx.request.url.searchParams.get("offset") || "0");
      
      // First, search in our database
      const { games, total } = await gameService.searchGames(query, limit, offset);
      
      // If we have enough results, return them
      if (total >= limit || offset > 0) {
        sendSuccess(ctx, { games }, 200, {
          pagination: {
            total,
            limit,
            offset,
          },
        });
        return;
      }
      
      // If we don't have enough results, search in the external API
      try {
        const apiGames = await apiService.searchGames(query, limit - games.length);
        
        // Combine results, ensuring no duplicates
        const existingIds = new Set(games.map(game => game.id));
        const combinedGames = [
          ...games,
          ...apiGames.filter(game => !existingIds.has(game.id)),
        ];
        
        sendSuccess(ctx, { games: combinedGames }, 200, {
          pagination: {
            total: combinedGames.length,
            limit,
            offset,
          },
        });
      } catch (apiError) {
        // If API search fails, just return database results
        logger.error("API game search failed", apiError);
        sendSuccess(ctx, { games }, 200, {
          pagination: {
            total,
            limit,
            offset,
          },
        });
      }
    } catch (error) {
      logger.error("Game search failed", error);
      throw new BadRequestError("Game search failed", { error: error.message });
    }
  }
  
  /**
   * Get popular games
   * @param ctx - Oak context
   */
  async getPopularGames(ctx: Context): Promise<void> {
    try {
      // Get query parameters
      const limit = parseInt(ctx.request.url.searchParams.get("limit") || "10");
      const offset = parseInt(ctx.request.url.searchParams.get("offset") || "0");
      const ordering = ctx.request.url.searchParams.get("ordering") || "-metacritic";
      
      // Log the request
      logger.info(`Getting popular games: limit=${limit}, offset=${offset}, ordering=${ordering}`);
      
      // Get popular games from database
      const games = await gameService.getPopularGames(limit, offset, ordering);
      
      // Return games
      ctx.response.body = {
        games,
        total: games.length + offset, // This is just a placeholder
        next: games.length === limit,
        previous: offset > 0
      };
    } catch (error) {
      logger.error("Error getting popular games:", error);
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to get popular games" };
    }
  }
  
  /**
   * Get recent games
   * @param ctx - Oak context
   */
  async getRecentGames(ctx: Context): Promise<void> {
    try {
      // Get pagination parameters
      const limit = parseInt(ctx.request.url.searchParams.get("limit") || "20");
      const offset = parseInt(ctx.request.url.searchParams.get("offset") || "0");
      
      // Get games with ratings, sorted by release date
      const { games, total } = await gameService.getGamesWithRatings(
        limit,
        offset,
        "release_date",
        "DESC"
      );
      
      // Filter games to only include those with a release date
      const recentGames = games.filter(game => game.release_date);
      
      // If we have enough results, return them
      if (recentGames.length >= limit || offset > 0) {
        sendSuccess(ctx, { games: recentGames }, 200, {
          pagination: {
            total: recentGames.length,
            limit,
            offset,
          },
        });
        return;
      }
      
      // If we don't have enough results, get recent games from the API
      try {
        const apiGames = await apiService.getRecentGames(limit - recentGames.length);
        
        // Combine results, ensuring no duplicates
        const existingIds = new Set(recentGames.map(game => game.id));
        const combinedGames = [
          ...recentGames,
          ...apiGames.filter(game => !existingIds.has(game.id)),
        ];
        
        sendSuccess(ctx, { games: combinedGames }, 200, {
          pagination: {
            total: combinedGames.length,
            limit,
            offset,
          },
        });
      } catch (apiError) {
        // If API request fails, just return database results
        logger.error("API recent games request failed", apiError);
        sendSuccess(ctx, { games: recentGames }, 200, {
          pagination: {
            total: recentGames.length,
            limit,
            offset,
          },
        });
      }
    } catch (error) {
      logger.error("Recent games retrieval failed", error);
      throw new BadRequestError("Failed to retrieve recent games", { error: error.message });
    }
  }
  
  /**
   * Get a game by ID
   * @param ctx - Oak context
   */
  async getGameById(ctx: Context): Promise<void> {
    try {
      // Get game ID from URL params
      const gameId = ctx.params.id;
      
      if (!gameId) {
        throw new BadRequestError("Game ID is required");
      }
      
      // Get game details
      const game = await gameService.getGameById(parseInt(gameId));
      
      if (!game) {
        throw new NotFoundError(`Game with ID ${gameId} not found`);
      }
      
      // Get rating statistics
      const ratingStats = await gameService.getGameRatingStats(game.id);
      
      // Combine game and rating stats
      const gameWithRating = {
        ...game,
        avg_rating: ratingStats.avg_rating,
        review_count: ratingStats.review_count,
      };
      
      sendSuccess(ctx, { game: gameWithRating });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      logger.error("Game retrieval failed", error);
      throw new BadRequestError("Failed to retrieve game", { error: error.message });
    }
  }
  
  /**
   * Get reviews for a game
   * @param ctx - Oak context
   */
  async getGameReviews(ctx: Context): Promise<void> {
    try {
      // Get game ID from URL params
      const gameId = ctx.params.gameId;
      
      if (!gameId) {
        throw new BadRequestError("Game ID is required");
      }
      
      // Get pagination parameters
      const limit = parseInt(ctx.request.url.searchParams.get("limit") || "20");
      const offset = parseInt(ctx.request.url.searchParams.get("offset") || "0");
      
      // Get reviews
      const { reviews, total } = await gameService.getGameReviews(
        parseInt(gameId),
        limit,
        offset
      );
      
      sendSuccess(ctx, { reviews }, 200, {
        pagination: {
          total,
          limit,
          offset,
        },
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      logger.error("Game reviews retrieval failed", error);
      throw new BadRequestError("Failed to retrieve game reviews", { error: error.message });
    }
  }
  
  /**
   * Create or update a review for a game
   * @param ctx - Oak context
   */
  async createOrUpdateReview(ctx: Context): Promise<void> {
    try {
      // Get user ID from context state (set by auth middleware)
      const userId = ctx.state.user?.id;
      
      if (!userId) {
        throw new BadRequestError("User ID is required");
      }
      
      // Get game ID from URL params
      const gameId = ctx.params.gameId;
      
      if (!gameId) {
        throw new BadRequestError("Game ID is required");
      }
      
      // Get request body
      const body = await ctx.request.body.json();
      
      // Validate required fields
      if (typeof body.rating !== "number" || !body.content) {
        throw new BadRequestError("Rating and content are required");
      }
      
      // Create or update review
      const review = await gameService.createOrUpdateReview(
        parseInt(userId),
        parseInt(gameId),
        {
          rating: body.rating,
          content: body.content,
        }
      );
      
      // Get updated rating statistics
      const ratingStats = await gameService.getGameRatingStats(parseInt(gameId));
      
      sendCreated(ctx, {
        review,
        game_stats: ratingStats,
      });
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      logger.error("Review creation/update failed", error);
      throw new BadRequestError("Failed to create/update review", { error: error.message });
    }
  }
  
  /**
   * Delete a review
   * @param ctx - Oak context
   */
  async deleteReview(ctx: Context): Promise<void> {
    try {
      // Get user ID from context state (set by auth middleware)
      const userId = ctx.state.user?.id;
      
      if (!userId) {
        throw new BadRequestError("User ID is required");
      }
      
      // Get review ID from URL params
      const reviewId = ctx.params.reviewId;
      
      if (!reviewId) {
        throw new BadRequestError("Review ID is required");
      }
      
      // Delete review
      await gameService.deleteReview(parseInt(userId), parseInt(reviewId));
      
      sendNoContent(ctx);
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      
      logger.error("Review deletion failed", error);
      throw new BadRequestError("Failed to delete review", { error: error.message });
    }
  }
  
  /**
   * Get a user's reviews
   * @param ctx - Oak context
   */
  async getUserReviews(ctx: Context): Promise<void> {
    try {
      // Get user ID from URL params or context state
      let userId = ctx.params.userId;
      
      // If no user ID in params, use authenticated user
      if (!userId && ctx.state.user) {
        userId = ctx.state.user.id;
      }
      
      if (!userId) {
        throw new BadRequestError("User ID is required");
      }
      
      // Get pagination parameters
      const limit = parseInt(ctx.request.url.searchParams.get("limit") || "20");
      const offset = parseInt(ctx.request.url.searchParams.get("offset") || "0");
      
      // Get reviews
      const { reviews, total } = await gameService.getUserReviews(
        parseInt(userId),
        limit,
        offset
      );
      
      sendSuccess(ctx, { reviews }, 200, {
        pagination: {
          total,
          limit,
          offset,
        },
      });
    } catch (error) {
      logger.error("User reviews retrieval failed", error);
      throw new BadRequestError("Failed to retrieve user reviews", { error: error.message });
    }
  }
}

// Create and export a singleton instance
const gameController = new GameController();
export default gameController; 