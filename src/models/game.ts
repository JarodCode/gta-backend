/**
 * Game Model Definitions
 * 
 * This file contains all interfaces and types related to the Game entity.
 * It provides type safety for game data throughout the application.
 */

/**
 * Represents a game in the database
 */
export interface Game {
  /** Unique identifier for the game */
  id: number | string;
  /** Title of the game */
  title: string;
  /** Release date of the game */
  releaseDate?: Date;
  /** Developer of the game */
  developer?: string;
  /** Publisher of the game */
  publisher?: string;
  /** URL to the game's cover image */
  coverImageUrl?: string;
  /** Description of the game */
  description?: string;
  /** Date when the game was added to the database */
  createdAt: Date;
}

/**
 * Represents a game as returned in API responses
 */
export interface GameResponse {
  /** Unique identifier for the game */
  id: string;
  /** Title of the game */
  title: string;
  /** Release date of the game */
  releaseDate?: string;
  /** Developer of the game */
  developer?: string;
  /** Publisher of the game */
  publisher?: string;
  /** URL to the game's cover image */
  coverImageUrl?: string;
  /** Description of the game */
  description?: string;
  /** Date when the game was added to the database */
  createdAt: string;
}

/**
 * Represents the rating summary for a game
 */
export interface GameRating {
  /** Unique identifier for the game */
  gameId: string;
  /** Average rating of the game (1.0 to 5.0) */
  averageRating: string;
  /** Number of ratings for the game */
  ratingCount: number;
}

/**
 * Represents data for all game ratings
 */
export interface AllGameRatings {
  /** Array of game ratings */
  ratings: GameRating[];
}

/**
 * Data required to create a new game
 */
export interface GameCreationData {
  /** Title of the game */
  title: string;
  /** Release date of the game */
  releaseDate?: string;
  /** Developer of the game */
  developer?: string;
  /** Publisher of the game */
  publisher?: string;
  /** URL to the game's cover image */
  coverImageUrl?: string;
  /** Description of the game */
  description?: string;
}

/**
 * Data required to update an existing game
 */
export interface GameUpdateData {
  /** Title of the game */
  title?: string;
  /** Release date of the game */
  releaseDate?: string;
  /** Developer of the game */
  developer?: string;
  /** Publisher of the game */
  publisher?: string;
  /** URL to the game's cover image */
  coverImageUrl?: string;
  /** Description of the game */
  description?: string;
} 