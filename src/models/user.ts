/**
 * User Model Definitions
 * 
 * This file contains all interfaces and types related to the User entity.
 * It provides type safety for user data throughout the application.
 */

/**
 * Represents a user in the database
 */
export interface User {
  /** Unique identifier for the user */
  id: number;
  /** Unique username for the user */
  username: string;
  /** Unique email address for the user */
  email: string;
  /** Hashed password for the user (never exposed in API responses) */
  passwordHash: string;
  /** Date when the user account was created */
  createdAt: Date;
  /** Date when the user account was last updated */
  updatedAt: Date;
  /** Optional URL to the user's avatar image */
  avatarUrl?: string;
  /** Optional biographical information about the user */
  bio?: string;
}

/**
 * Represents a user as returned in API responses (excludes sensitive data)
 */
export interface UserResponse {
  /** Unique identifier for the user */
  id: number;
  /** Unique username for the user */
  username: string;
  /** Unique email address for the user */
  email: string;
  /** Date when the user account was created */
  createdAt: string;
  /** Date when the user account was last updated */
  updatedAt: string;
  /** Optional URL to the user's avatar image */
  avatarUrl?: string;
  /** Optional biographical information about the user */
  bio?: string;
}

/**
 * Data required to create a new user
 */
export interface UserRegistrationData {
  /** Unique username for the user */
  username: string;
  /** Unique email address for the user */
  email: string;
  /** Plain text password (will be hashed before storage) */
  password: string;
}

/**
 * Data required for user login
 */
export interface UserLoginData {
  /** Username for login */
  username: string;
  /** Plain text password */
  password: string;
}

/**
 * JWT payload structure for authentication
 */
export interface JwtPayload {
  /** Unique identifier for the user */
  userId: number;
  /** Username of the user */
  username: string;
  /** Email of the user */
  email: string;
  /** Expiration timestamp */
  exp: number;
}

/**
 * Authentication response containing user data and token
 */
export interface AuthResponse {
  /** User data appropriate for client usage */
  user: UserResponse;
  /** JWT token for authentication */
  token: string;
} 