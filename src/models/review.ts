/**
 * Review Model Definitions
 * 
 * This file contains all interfaces and types related to the Review entity.
 * It provides type safety for review data throughout the application.
 */

/**
 * Represents a game review in the database
 */
export interface Review {
  /** Unique identifier for the review */
  id: number;
  /** ID of the game being reviewed */
  gameId: string;
  /** ID of the user who wrote the review */
  userId: number;
  /** Rating value (1-5) */
  rating: number;
  /** Text content of the review */
  content: string;
  /** Date when the review was created */
  createdAt: Date;
  /** Date when the review was last updated */
  updatedAt: Date;
}

/**
 * Represents a review as returned in API responses (includes username)
 */
export interface ReviewResponse {
  /** Unique identifier for the review */
  id: string;
  /** ID of the game being reviewed */
  gameId: string;
  /** ID of the user who wrote the review */
  userId: number;
  /** Username of the user who wrote the review */
  username: string;
  /** Rating value (1-5) */
  rating: number;
  /** Text content of the review */
  content: string;
  /** Optional game title information */
  gameTitle?: string;
  /** Optional game cover URL */
  gameCoverUrl?: string;
  /** Date when the review was created */
  createdAt: string;
  /** Date when the review was last updated */
  updatedAt?: string;
}

/**
 * Collection of reviews for a response
 */
export interface ReviewsResponse {
  /** Array of reviews */
  reviews: ReviewResponse[];
}

/**
 * Data required to create a new review
 */
export interface ReviewCreationData {
  /** ID of the game being reviewed */
  gameId: string;
  /** Rating value (1-5) */
  rating: number;
  /** Text content of the review */
  content: string;
  /** Optional game title (for notifications) */
  gameTitle?: string;
  /** Optional game cover URL (for notifications) */
  gameCoverUrl?: string;
}

/**
 * Data required to update an existing review
 */
export interface ReviewUpdateData {
  /** Rating value (1-5) */
  rating?: number;
  /** Text content of the review */
  content?: string;
}

/**
 * WebSocket notification for a new review
 */
export interface ReviewNotification {
  /** Type of notification */
  type: 'new_review' | 'updated_review' | 'deleted_review';
  /** ID of the game being reviewed */
  gameId: string;
  /** Review data */
  review: ReviewResponse;
} 