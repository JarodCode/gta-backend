/**
 * Application Constants
 * 
 * This file contains all global constants used throughout the application.
 * Centralizing these values makes it easier to configure the application.
 */

/**
 * Server configuration
 */
export const SERVER = {
  /** Default port number for the server */
  PORT: Number(Deno.env.get("PORT") || 8080),
  /** Environment mode (development, testing, production) */
  ENVIRONMENT: Deno.env.get("ENVIRONMENT") || "development",
  /** Whether to run in development mode */
  IS_DEVELOPMENT: Deno.env.get("ENVIRONMENT") !== "production",
};

/**
 * CORS configuration
 */
export const CORS = {
  /** Allowed origins for CORS */
  ALLOWED_ORIGINS: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "*" // Allow all origins in development mode
  ],
  /** Headers to expose in CORS responses */
  EXPOSE_HEADERS: ["Content-Length", "X-Response-Time"],
  /** Whether credentials are allowed in CORS requests */
  ALLOW_CREDENTIALS: true,
};

/**
 * Database configuration
 */
export const DATABASE = {
  /** PostgreSQL connection URL */
  POSTGRES_URL: Deno.env.get("DATABASE_URL") || "postgres://gametrackr:gametrackrpass@localhost:5432/gametrackr",
  /** SQLite database file path */
  SQLITE_PATH: Deno.env.get("DATABASE_PATH") || "./data/database.sqlite",
  /** Database schema path */
  SCHEMA_PATH: "./database/schema.sql",
  /** PostgreSQL connection pool size */
  PG_POOL_SIZE: 2,
  /** Connection timeout in milliseconds */
  CONNECTION_TIMEOUT: 3000,
};

/**
 * Authentication configuration
 */
export const AUTH = {
  /** JWT secret key */
  JWT_SECRET: Deno.env.get("JWT_SECRET") || "super-secret-jwt-key-for-game-tracking-app",
  /** Name of the authentication cookie */
  COOKIE_NAME: "auth_token",
  /** Cookie options */
  COOKIE_OPTIONS: {
    httpOnly: true,     // Prevent JavaScript access
    secure: Deno.env.get("ENVIRONMENT") === "production",  // Use secure cookies in production
    sameSite: "lax" as const,  // Allow cookies for same-site and some cross-site requests
    path: "/",          // Cookie available for all paths
    maxAge: 30 * 24 * 60 * 60, // 30 days in seconds
  },
  /** JWT token expiration time (in milliseconds) */
  TOKEN_EXPIRY: 30 * 24 * 60 * 60 * 1000, // 30 days
  /** Minimum password length */
  MIN_PASSWORD_LENGTH: 6,
  /** Bcrypt salt rounds */
  BCRYPT_SALT_ROUNDS: 10,
};

/**
 * Game ratings configuration
 */
export const RATINGS = {
  /** Minimum rating value */
  MIN_RATING: 1,
  /** Maximum rating value */
  MAX_RATING: 5,
};

/**
 * File paths and directories
 */
export const PATHS = {
  /** Frontend directory */
  FRONTEND: `${Deno.cwd()}/frontend`,
  /** Database directory */
  DATABASE: `${Deno.cwd()}/database`,
}; 