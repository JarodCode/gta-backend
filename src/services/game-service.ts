/**
 * Game Service
 * 
 * This service handles game-related operations such as:
 * - Game data retrieval and caching
 * - Game reviews and ratings
 * - Game search and filtering
 */

import db from "./database-service.ts";
import { NotFoundError } from "../utils/errors.ts";
import logger from "../utils/logger.ts";
import { RowObject } from "./database-service.ts";

/**
 * Game interface
 */
export interface Game extends RowObject {
  id: number;
  external_id: string;
  title: string;
  cover_url: string | null;
  release_date: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Game review interface
 */
export interface GameReview extends RowObject {
  id: number;
  game_id: number;
  user_id: number;
  rating: number;
  content: string;
  created_at: string;
  updated_at: string;
  username?: string;
}

/**
 * Game with rating information
 */
export interface GameWithRating extends Game {
  avg_rating: number;
  review_count: number;
}

/**
 * Game service class
 */
export class GameService {
  /**
   * Get a game by ID
   * @param id - Game ID
   * @returns Game or null if not found
   */
  async getGameById(id: number): Promise<Game | null> {
    const result = await db.query<Game>(
      "SELECT * FROM games WHERE id = ?",
      [id]
    );
    
    return result.rows[0] || null;
  }
  
  /**
   * Get a game by external ID
   * @param externalId - External game ID
   * @returns Game or null if not found
   */
  async getGameByExternalId(externalId: string): Promise<Game | null> {
    const result = await db.query<Game>(
      "SELECT * FROM games WHERE external_id = ?",
      [externalId]
    );
    
    return result.rows[0] || null;
  }
  
  /**
   * Create or update a game
   * @param gameData - Game data
   * @returns Created or updated game
   */
  async createOrUpdateGame(gameData: {
    external_id: string;
    title: string;
    cover_url?: string | null;
    release_date?: string | null;
    description?: string | null;
  }): Promise<Game> {
    // Check if game already exists
    const existingGame = await this.getGameByExternalId(gameData.external_id);
    
    if (existingGame) {
      // Update existing game
      const updateData: Record<string, unknown> = {
        title: gameData.title,
        updated_at: new Date().toISOString(),
      };
      
      if (gameData.cover_url !== undefined) {
        updateData.cover_url = gameData.cover_url;
      }
      
      if (gameData.release_date !== undefined) {
        updateData.release_date = gameData.release_date;
      }
      
      if (gameData.description !== undefined) {
        updateData.description = gameData.description;
      }
      
      await db.update("games", updateData, "id = ?", [existingGame.id]);
      
      // Retrieve updated game
      const updatedGame = await this.getGameById(existingGame.id);
      if (!updatedGame) {
        throw new Error("Failed to retrieve updated game");
      }
      
      return updatedGame;
    } else {
      // Create new game
      const now = new Date().toISOString();
      
      const gameId = await db.insert("games", {
        external_id: gameData.external_id,
        title: gameData.title,
        cover_url: gameData.cover_url || null,
        release_date: gameData.release_date || null,
        description: gameData.description || null,
        created_at: now,
        updated_at: now,
      });
      
      // Retrieve created game
      const createdGame = await this.getGameById(gameId);
      if (!createdGame) {
        throw new Error("Failed to retrieve created game");
      }
      
      return createdGame;
    }
  }
  
  /**
   * Get games with rating information
   * @param limit - Maximum number of games to return
   * @param offset - Number of games to skip
   * @param sortBy - Sort field
   * @param sortOrder - Sort order
   * @returns List of games with ratings
   */
  async getGamesWithRatings(
    limit = 20,
    offset = 0,
    sortBy = "title",
    sortOrder = "ASC"
  ): Promise<{
    games: GameWithRating[];
    total: number;
  }> {
    // Validate sort parameters to prevent SQL injection
    const validSortFields = ["title", "release_date", "avg_rating", "review_count"];
    const validSortOrders = ["ASC", "DESC"];
    
    const actualSortBy = validSortFields.includes(sortBy) ? sortBy : "title";
    const actualSortOrder = validSortOrders.includes(sortOrder) ? sortOrder : "ASC";
    
    // Get total count
    const countResult = await db.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM games"
    );
    const total = countResult.rows[0]?.count || 0;
    
    // Get games with ratings
    const result = await db.query<GameWithRating>(
      `SELECT 
        g.*,
        COALESCE(AVG(gr.rating), 0) as avg_rating,
        COUNT(gr.id) as review_count
      FROM games g
      LEFT JOIN game_reviews gr ON g.id = gr.game_id
      GROUP BY g.id
      ORDER BY ${actualSortBy} ${actualSortOrder}
      LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    
    // Format ratings to one decimal place
    const games = result.rows.map(game => ({
      ...game,
      avg_rating: Number(game.avg_rating.toFixed(1)),
    }));
    
    return { games, total };
  }
  
  /**
   * Search games
   * @param query - Search query
   * @param limit - Maximum number of games to return
   * @param offset - Number of games to skip
   * @returns List of games matching the search query
   */
  async searchGames(
    query: string,
    limit = 20,
    offset = 0
  ): Promise<{
    games: GameWithRating[];
    total: number;
  }> {
    const searchTerm = `%${query}%`;
    
    // Get total count
    const countResult = await db.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM games WHERE title LIKE ?",
      [searchTerm]
    );
    const total = countResult.rows[0]?.count || 0;
    
    // Get games matching search query with ratings
    const result = await db.query<GameWithRating>(
      `SELECT 
        g.*,
        COALESCE(AVG(gr.rating), 0) as avg_rating,
        COUNT(gr.id) as review_count
      FROM games g
      LEFT JOIN game_reviews gr ON g.id = gr.game_id
      WHERE g.title LIKE ?
      GROUP BY g.id
      ORDER BY g.title ASC
      LIMIT ? OFFSET ?`,
      [searchTerm, limit, offset]
    );
    
    // Format ratings to one decimal place
    const games = result.rows.map(game => ({
      ...game,
      avg_rating: Number(game.avg_rating.toFixed(1)),
    }));
    
    return { games, total };
  }
  
  /**
   * Get game reviews
   * @param gameId - Game ID
   * @param limit - Maximum number of reviews to return
   * @param offset - Number of reviews to skip
   * @returns List of reviews for the game
   */
  async getGameReviews(
    gameId: number,
    limit = 20,
    offset = 0
  ): Promise<{
    reviews: GameReview[];
    total: number;
  }> {
    // Check if game exists
    const game = await this.getGameById(gameId);
    if (!game) {
      throw new NotFoundError(`Game with ID ${gameId} not found`);
    }
    
    // Get total count
    const countResult = await db.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM game_reviews WHERE game_id = ?",
      [gameId]
    );
    const total = countResult.rows[0]?.count || 0;
    
    // Get reviews with usernames
    const result = await db.query<GameReview>(
      `SELECT 
        gr.*,
        u.username
      FROM game_reviews gr
      JOIN users u ON gr.user_id = u.id
      WHERE gr.game_id = ?
      ORDER BY gr.created_at DESC
      LIMIT ? OFFSET ?`,
      [gameId, limit, offset]
    );
    
    return { reviews: result.rows, total };
  }
  
  /**
   * Get game rating statistics
   * @param gameId - Game ID
   * @returns Rating statistics
   */
  async getGameRatingStats(gameId: number): Promise<{
    avg_rating: number;
    review_count: number;
  }> {
    // Check if game exists
    const game = await this.getGameById(gameId);
    if (!game) {
      throw new NotFoundError(`Game with ID ${gameId} not found`);
    }
    
    // Get rating statistics
    const result = await db.query<{ avg_rating: number; review_count: number }>(
      `SELECT 
        COALESCE(AVG(rating), 0) as avg_rating,
        COUNT(id) as review_count
      FROM game_reviews
      WHERE game_id = ?`,
      [gameId]
    );
    
    const stats = result.rows[0] || { avg_rating: 0, review_count: 0 };
    
    // Format average rating to one decimal place
    return {
      avg_rating: Number(stats.avg_rating.toFixed(1)),
      review_count: stats.review_count,
    };
  }
  
  /**
   * Create or update a game review
   * @param userId - User ID
   * @param gameId - Game ID
   * @param reviewData - Review data
   * @returns Created or updated review
   */
  async createOrUpdateReview(
    userId: number,
    gameId: number,
    reviewData: {
      rating: number;
      content: string;
    }
  ): Promise<GameReview> {
    // Check if game exists
    const game = await this.getGameById(gameId);
    if (!game) {
      throw new NotFoundError(`Game with ID ${gameId} not found`);
    }
    
    // Check if review already exists
    const existingReview = await this.getUserGameReview(userId, gameId);
    
    if (existingReview) {
      // Update existing review
      await db.update(
        "game_reviews",
        {
          rating: reviewData.rating,
          content: reviewData.content,
          updated_at: new Date().toISOString(),
        },
        "id = ?",
        [existingReview.id]
      );
      
      // Retrieve updated review
      const updatedReview = await this.getReviewById(existingReview.id);
      if (!updatedReview) {
        throw new Error("Failed to retrieve updated review");
      }
      
      return updatedReview;
    } else {
      // Create new review
      const now = new Date().toISOString();
      
      const reviewId = await db.insert("game_reviews", {
        game_id: gameId,
        user_id: userId,
        rating: reviewData.rating,
        content: reviewData.content,
        created_at: now,
        updated_at: now,
      });
      
      // Retrieve created review
      const createdReview = await this.getReviewById(reviewId);
      if (!createdReview) {
        throw new Error("Failed to retrieve created review");
      }
      
      return createdReview;
    }
  }
  
  /**
   * Delete a game review
   * @param userId - User ID
   * @param reviewId - Review ID
   * @returns True if review was deleted
   * @throws NotFoundError if review not found or doesn't belong to user
   */
  async deleteReview(userId: number, reviewId: number): Promise<boolean> {
    // Get review
    const review = await this.getReviewById(reviewId);
    if (!review) {
      throw new NotFoundError(`Review with ID ${reviewId} not found`);
    }
    
    // Check if review belongs to user
    if (review.user_id !== userId) {
      throw new NotFoundError(`Review with ID ${reviewId} not found for this user`);
    }
    
    // Delete review
    const result = await db.delete("game_reviews", "id = ?", [reviewId]);
    
    return result > 0;
  }
  
  /**
   * Get a review by ID
   * @param id - Review ID
   * @returns Review or null if not found
   */
  private async getReviewById(id: number): Promise<GameReview | null> {
    const result = await db.query<GameReview>(
      `SELECT 
        gr.*,
        u.username
      FROM game_reviews gr
      JOIN users u ON gr.user_id = u.id
      WHERE gr.id = ?`,
      [id]
    );
    
    return result.rows[0] || null;
  }
  
  /**
   * Get a user's review for a game
   * @param userId - User ID
   * @param gameId - Game ID
   * @returns Review or null if not found
   */
  async getUserGameReview(userId: number, gameId: number): Promise<GameReview | null> {
    const result = await db.query<GameReview>(
      `SELECT 
        gr.*,
        u.username
      FROM game_reviews gr
      JOIN users u ON gr.user_id = u.id
      WHERE gr.user_id = ? AND gr.game_id = ?`,
      [userId, gameId]
    );
    
    return result.rows[0] || null;
  }
  
  /**
   * Get a user's reviews
   * @param userId - User ID
   * @param limit - Maximum number of reviews to return
   * @param offset - Number of reviews to skip
   * @returns List of reviews by the user
   */
  async getUserReviews(
    userId: number,
    limit = 20,
    offset = 0
  ): Promise<{
    reviews: Array<GameReview & { game_title: string; game_cover_url: string | null }>;
    total: number;
  }> {
    // Get total count
    const countResult = await db.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM game_reviews WHERE user_id = ?",
      [userId]
    );
    const total = countResult.rows[0]?.count || 0;
    
    // Get reviews with game information
    const result = await db.query<GameReview & { game_title: string; game_cover_url: string | null }>(
      `SELECT 
        gr.*,
        g.title as game_title,
        g.cover_url as game_cover_url,
        u.username
      FROM game_reviews gr
      JOIN games g ON gr.game_id = g.id
      JOIN users u ON gr.user_id = u.id
      WHERE gr.user_id = ?
      ORDER BY gr.created_at DESC
      LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
    
    return { reviews: result.rows, total };
  }

  /**
   * Get popular games sorted by rating or other criteria
   * @param limit - Maximum number of games to return
   * @param offset - Number of games to skip
   * @param ordering - Sort order (e.g., "-metacritic", "-avg_rating", "title")
   * @returns List of games with ratings
   */
  async getPopularGames(
    limit = 10,
    offset = 0,
    ordering = "-avg_rating"
  ): Promise<GameWithRating[]> {
    // Determine sort field and direction based on ordering
    let sortField = "avg_rating";
    let sortDirection = "DESC";
    
    if (ordering.startsWith("-")) {
      sortField = ordering.substring(1);
      sortDirection = "DESC";
    } else {
      sortField = ordering;
      sortDirection = "ASC";
    }
    
    // Map external field names to database fields
    if (sortField === "metacritic") {
      sortField = "avg_rating";
    } else if (sortField === "released") {
      sortField = "release_date";
    } else if (sortField === "name") {
      sortField = "title";
    }
    
    // Validate sort parameters to prevent SQL injection
    const validSortFields = ["title", "release_date", "avg_rating", "review_count"];
    const validSortOrders = ["ASC", "DESC"];
    
    const actualSortField = validSortFields.includes(sortField) ? sortField : "avg_rating";
    const actualSortOrder = validSortOrders.includes(sortDirection) ? sortDirection : "DESC";
    
    // Get games with ratings
    const result = await db.query<GameWithRating>(
      `SELECT 
        g.*,
        COALESCE(AVG(gr.rating), 0) as avg_rating,
        COUNT(gr.id) as review_count
      FROM games g
      LEFT JOIN game_reviews gr ON g.id = gr.game_id
      GROUP BY g.id
      ORDER BY ${actualSortField} ${actualSortOrder}
      LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    
    // Format ratings to one decimal place
    return result.rows.map(game => ({
      ...game,
      avg_rating: Number(game.avg_rating.toFixed(1)),
    }));
  }
}

// Create and export a singleton instance
const gameService = new GameService();
export default gameService; 