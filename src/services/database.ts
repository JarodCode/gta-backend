/**
 * Database Service
 * 
 * This service provides a unified interface for database operations,
 * abstracting the differences between PostgreSQL and SQLite.
 */

import { DB } from "https://deno.land/x/sqlite@v3.7.0/mod.ts";
import { Pool, PoolClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { DatabaseError } from "../utils/errors.ts";

/** Type for supported database systems */
export type DatabaseSystem = 'postgres' | 'sqlite';

/** Configuration for database connections */
export interface DatabaseConfig {
  /** PostgreSQL connection URL */
  postgresUrl?: string;
  /** SQLite database file path */
  sqlitePath?: string;
  /** Connection pool size (PostgreSQL only) */
  poolSize?: number;
  /** Connection timeout in milliseconds */
  connectionTimeout?: number;
  /** Whether to log queries */
  logQueries?: boolean;
}

/** Query result interface for standardized returns */
export interface QueryResult<T = any> {
  /** Rows returned by the query, as objects with named properties */
  rows: T[];
  /** Number of rows affected (for insert/update/delete) */
  rowCount: number;
  /** Last inserted ID (for insert operations) */
  lastInsertId?: number | bigint;
  /** Raw result from the database driver */
  raw?: any;
}

/** Database service class */
class DatabaseService {
  /** The active database system */
  private dbSystem: DatabaseSystem = 'sqlite';
  /** SQLite database instance */
  private sqliteDb?: DB;
  /** PostgreSQL connection pool */
  private pgPool?: Pool;
  /** Configuration options */
  private config: DatabaseConfig;
  /** Whether database has been initialized */
  private initialized = false;

  /**
   * Create a new DatabaseService instance
   * 
   * @param config - Database configuration options
   */
  constructor(config: DatabaseConfig = {}) {
    this.config = {
      postgresUrl: Deno.env.get("DATABASE_URL") || "postgres://gametrackr:gametrackrpass@localhost:5432/gametrackr",
      sqlitePath: Deno.env.get("DATABASE_PATH") || "./data/database.sqlite",
      poolSize: 2,
      connectionTimeout: 3000,
      logQueries: true,
      ...config
    };
  }

  /**
   * Initialize the database connection
   * Attempts PostgreSQL first, then falls back to SQLite
   * 
   * @returns The database service instance for chaining
   * @throws DatabaseError if connection fails
   */
  async init(): Promise<DatabaseService> {
    if (this.initialized) {
      return this;
    }

    try {
      // Try PostgreSQL connection
      console.log("Attempting PostgreSQL connection...");
      
      // Create connection pool
      this.pgPool = new Pool(
        this.config.postgresUrl!, 
        this.config.poolSize!
      );
      
      // Test connection with timeout
      const client = await Promise.race([
        this.pgPool.connect(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error("Connection timeout")), this.config.connectionTimeout!)
        )
      ]) as PoolClient;
      
      // If we got here, PostgreSQL is available
      console.log("PostgreSQL connected successfully");
      this.dbSystem = 'postgres';
      
      // Initialize schema
      try {
        const schemaSQL = await Deno.readTextFile("./database/schema.sql");
        await client.queryArray(schemaSQL);
        console.log("PostgreSQL schema initialized successfully");
      } finally {
        client.release();
      }
    } catch (error) {
      // Fallback to SQLite
      console.error("PostgreSQL connection failed:", error.message);
      console.log("Falling back to SQLite...");
      
      try {
        // Create SQLite database
        const DB_PATH = this.config.sqlitePath!;
        this.sqliteDb = new DB(DB_PATH);
        this.dbSystem = 'sqlite';
        
        // Initialize SQLite schema by converting PostgreSQL schema
        let schemaSQL = await Deno.readTextFile("./database/schema.sql");
        
        // Convert PostgreSQL schema to SQLite
        schemaSQL = schemaSQL
          .replace(/SERIAL PRIMARY KEY/g, "INTEGER PRIMARY KEY AUTOINCREMENT")
          .replace(/NOW\(\)/g, "CURRENT_TIMESTAMP")
          .replace(/TIMESTAMP DEFAULT/g, "TIMESTAMP DEFAULT")
          .replace(/\$(\d+)/g, "?");
        
        this.sqliteDb.execute(schemaSQL);
        console.log("SQLite schema initialized successfully");
      } catch (e) {
        const errorMsg = `Error initializing SQLite database: ${e.message}`;
        console.error(errorMsg);
        throw new DatabaseError(errorMsg, { originalError: e.message });
      }
    }
    
    this.initialized = true;
    return this;
  }

  /**
   * Execute a SQL query and return the results
   * 
   * @param query - SQL query string
   * @param params - Query parameters
   * @returns Query results as a standardized object
   * @throws DatabaseError if query execution fails
   */
  async query<T = any>(query: string, params: any[] = []): Promise<QueryResult<T>> {
    // Ensure database is initialized
    if (!this.initialized) {
      await this.init();
    }
    
    // Log query if enabled
    if (this.config.logQueries) {
      console.log(`[DB] Executing query: ${query}`);
      console.log(`[DB] With parameters: ${JSON.stringify(params)}`);
    }
    
    try {
      let result: QueryResult<T>;
      
      if (this.dbSystem === 'postgres' && this.pgPool) {
        // PostgreSQL execution
        const client = await this.pgPool.connect();
        try {
          // Convert query placeholder style if needed
          const pgQuery = query.replace(/\?/g, (_, i) => `$${i + 1}`);
          
          // Execute query
          const queryResult = await client.queryObject<T>(pgQuery, params);
          
          // Format result
          result = {
            rows: queryResult.rows,
            rowCount: queryResult.rowCount,
            raw: queryResult
          };
        } finally {
          client.release();
        }
      } else if (this.dbSystem === 'sqlite' && this.sqliteDb) {
        // SQLite execution
        
        // Check if this is a SELECT query
        const isSelect = query.trim().toUpperCase().startsWith('SELECT');
        
        if (isSelect) {
          // For SELECT queries, return results as objects
          const rows = this.sqliteDb.queryEntries<T>(query, params);
          result = {
            rows: Array.from(rows),
            rowCount: rows.length,
            raw: rows
          };
        } else {
          // For non-SELECT queries, just execute
          this.sqliteDb.query(query, params);
          
          // Get last insert ID if this was an INSERT
          const isInsert = query.trim().toUpperCase().startsWith('INSERT');
          const lastInsertId = isInsert ? this.sqliteDb.lastInsertRowId : undefined;
          
          result = {
            rows: [],
            rowCount: this.sqliteDb.changes,
            lastInsertId,
            raw: null
          };
        }
      } else {
        throw new DatabaseError("Database not initialized properly");
      }
      
      // Log result summary if enabled
      if (this.config.logQueries) {
        console.log(`[DB] Query returned ${result.rows.length} rows`);
        console.log(`[DB] Affected ${result.rowCount} rows`);
        
        if (result.rows.length > 0) {
          console.log(`[DB] First row sample: ${JSON.stringify(result.rows[0])}`);
        }
      }
      
      return result;
    } catch (error) {
      const errorMsg = `Database query error: ${error.message}`;
      console.error(errorMsg);
      console.error(`Failed query: ${query}`);
      console.error(`Parameters: ${JSON.stringify(params)}`);
      
      throw new DatabaseError(errorMsg, { 
        query, 
        params,
        originalError: error.message
      });
    }
  }

  /**
   * Execute a SQL query that returns a single value
   * 
   * @param query - SQL query string
   * @param params - Query parameters
   * @returns The single value returned by the query, or null if no results
   * @throws DatabaseError if query execution fails
   */
  async queryValue<T>(query: string, params: any[] = []): Promise<T | null> {
    const result = await this.query<{ value: T }>(query, params);
    return result.rows.length > 0 ? (result.rows[0] as any).value : null;
  }

  /**
   * Execute a SQL query that returns a single row
   * 
   * @param query - SQL query string
   * @param params - Query parameters
   * @returns The single row returned by the query, or null if no results
   * @throws DatabaseError if query execution fails
   */
  async queryRow<T = any>(query: string, params: any[] = []): Promise<T | null> {
    const result = await this.query<T>(query, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Execute a SQL query and return the ID of the inserted row
   * 
   * @param query - SQL query string (should be an INSERT)
   * @param params - Query parameters
   * @returns The ID of the inserted row
   * @throws DatabaseError if query execution fails
   */
  async insert(query: string, params: any[] = []): Promise<number> {
    const result = await this.query(query, params);
    
    if (result.lastInsertId !== undefined) {
      return Number(result.lastInsertId);
    }
    
    // If lastInsertId is not available, try to get it with a separate query
    if (this.dbSystem === 'postgres') {
      const idResult = await this.query<{ id: number }>("SELECT lastval() as id");
      return idResult.rows[0]?.id;
    } else {
      const idResult = await this.query<{ id: number }>("SELECT last_insert_rowid() as id");
      return idResult.rows[0]?.id;
    }
  }

  /**
   * Begin a transaction
   * 
   * @throws DatabaseError if transaction cannot be started
   */
  async beginTransaction(): Promise<void> {
    await this.query("BEGIN TRANSACTION");
  }

  /**
   * Commit a transaction
   * 
   * @throws DatabaseError if transaction cannot be committed
   */
  async commitTransaction(): Promise<void> {
    await this.query("COMMIT");
  }

  /**
   * Rollback a transaction
   * 
   * @throws DatabaseError if transaction cannot be rolled back
   */
  async rollbackTransaction(): Promise<void> {
    await this.query("ROLLBACK");
  }

  /**
   * Close database connections
   */
  async close(): Promise<void> {
    if (this.dbSystem === 'postgres' && this.pgPool) {
      await this.pgPool.end();
    } else if (this.dbSystem === 'sqlite' && this.sqliteDb) {
      this.sqliteDb.close();
    }
    
    this.initialized = false;
    console.log("Database connection closed");
  }

  /**
   * Get the current database system
   * 
   * @returns The active database system ('postgres' or 'sqlite')
   */
  getDatabaseSystem(): DatabaseSystem {
    return this.dbSystem;
  }
}

// Export a singleton instance
const db = new DatabaseService();
export default db; 