/**
 * Database Configuration
 * 
 * This file contains the database configuration settings and initialization logic.
 * It provides a unified interface for database operations across different database systems.
 */

import { DATABASE } from "./constants.ts";

/**
 * Database configuration object
 * Contains all settings needed for database connections
 */
export const dbConfig = {
  /** PostgreSQL connection URL */
  postgresUrl: DATABASE.POSTGRES_URL,
  
  /** SQLite database file path */
  sqlitePath: DATABASE.SQLITE_PATH,
  
  /** PostgreSQL connection pool size */
  poolSize: DATABASE.PG_POOL_SIZE,
  
  /** Connection timeout in milliseconds */
  connectionTimeout: DATABASE.CONNECTION_TIMEOUT,
  
  /** Path to the database schema SQL file */
  schemaPath: DATABASE.SCHEMA_PATH,
  
  /** Whether to log queries (default: true in development, false in production) */
  logQueries: Deno.env.get("ENVIRONMENT") !== "production",
};

/**
 * Converts a PostgreSQL schema to SQLite compatible syntax
 * 
 * @param schema - PostgreSQL schema SQL string
 * @returns SQLite compatible schema SQL string
 */
export function convertPgSchemaToSqlite(schema: string): string {
  return schema
    // Convert SERIAL PRIMARY KEY to SQLite's autoincrement syntax
    .replace(/SERIAL PRIMARY KEY/g, "INTEGER PRIMARY KEY AUTOINCREMENT")
    
    // Convert PostgreSQL's NOW() function to SQLite's CURRENT_TIMESTAMP
    .replace(/NOW\(\)/g, "CURRENT_TIMESTAMP")
    
    // Fix timestamp default syntax
    .replace(/TIMESTAMP DEFAULT/g, "TIMESTAMP DEFAULT")
    
    // Convert PostgreSQL's $n parameters to SQLite's ? placeholders
    .replace(/\$(\d+)/g, "?");
}

/**
 * Generates a database connection error message
 * 
 * @param dbType - The database type that failed to connect
 * @param error - The error that occurred
 * @returns Formatted error message
 */
export function formatDbConnectionError(dbType: string, error: Error): string {
  return `Failed to connect to ${dbType} database: ${error.message}`;
} 