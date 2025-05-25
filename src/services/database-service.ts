/**
 * Database Service
 * 
 * This service provides a unified interface for database operations,
 * supporting both SQLite and PostgreSQL databases.
 */

import { DB, QueryParameterSet } from "https://deno.land/x/sqlite@v3.7.0/mod.ts";
import { Pool, PoolClient } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { dbConfig } from "../config/database.ts";
import { DatabaseError } from "../utils/errors.ts";
import logger from "../utils/logger.ts";
import { ensureDirSync } from "https://deno.land/std@0.190.0/fs/ensure_dir.ts";

/**
 * Supported database systems
 */
export type DatabaseSystem = "postgres" | "sqlite";

/**
 * Row object interface for query results
 */
export interface RowObject {
  [key: string]: unknown;
}

/**
 * Query result interface
 */
export interface QueryResult<T extends RowObject = RowObject> {
  rows: T[];
  rowCount: number;
  lastInsertId?: number | bigint;
}

/**
 * Database service for handling database operations
 */
export class DatabaseService {
  private db: DB | Pool | null = null;
  private dbSystem: DatabaseSystem | null = null;
  private client: PoolClient | null = null;
  private inTransaction = false;

  /**
   * Initialize the database connection
   * Tries PostgreSQL first, falls back to SQLite if PostgreSQL is not available
   */
  async initialize(): Promise<void> {
    try {
      // Try PostgreSQL first
      if (dbConfig.postgresUrl) {
        logger.info("Attempting to connect to PostgreSQL database");
        
        const pool = new Pool(dbConfig.postgresUrl, dbConfig.poolSize);
        
        // Test the connection
        const client = await pool.connect();
        await client.queryObject("SELECT 1");
        client.release();
        
        this.db = pool;
        this.dbSystem = "postgres";
        logger.info("Successfully connected to PostgreSQL database");
        
        // Initialize schema if needed
        await this.initializePostgresSchema();
      } else {
        throw new Error("PostgreSQL URL not configured, falling back to SQLite");
      }
    } catch (error) {
      // Fall back to SQLite
      const pgError = error instanceof Error ? error : new Error(String(error));
      logger.warn(`PostgreSQL connection failed: ${pgError.message}, falling back to SQLite`);
      
      try {
        logger.info(`Connecting to SQLite database at ${dbConfig.sqlitePath}`);
        
        // Ensure directory exists
        const dbDir = dbConfig.sqlitePath.split("/").slice(0, -1).join("/");
        try {
          ensureDirSync(dbDir);
        } catch (err) {
          if (!(err instanceof Deno.errors.AlreadyExists)) {
            throw err;
          }
        }
        
        // Connect to SQLite
        this.db = new DB(dbConfig.sqlitePath);
        this.dbSystem = "sqlite";
        logger.info("Successfully connected to SQLite database");
        
        // Initialize schema if needed
        await this.initializeSqliteSchema();
      } catch (sqliteError) {
        const sqliteErr = sqliteError instanceof Error ? sqliteError : new Error(String(sqliteError));
        logger.error("Failed to connect to any database", sqliteErr);
        throw new DatabaseError("Failed to connect to any database", { 
          details: {
            postgresError: pgError.message,
            sqliteError: sqliteErr.message
          }
        });
      }
    }
  }

  /**
   * Initialize PostgreSQL schema
   */
  private async initializePostgresSchema(): Promise<void> {
    if (!this.db || this.dbSystem !== "postgres") {
      throw new DatabaseError("PostgreSQL database not initialized");
    }
    
    try {
      const client = await (this.db as Pool).connect();
      
      try {
        // Check if schema needs to be initialized
        const result = await client.queryObject<{ exists: boolean }>(
          "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') AS exists"
        );
        
        if (!result.rows[0].exists) {
          logger.info("Initializing PostgreSQL schema");
          
          // Read schema file
          const schemaSQL = await Deno.readTextFile(dbConfig.schemaPath);
          
          // Execute schema SQL
          await client.queryObject(schemaSQL);
          logger.info("PostgreSQL schema initialized successfully");
        }
      } finally {
        client.release();
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to initialize PostgreSQL schema", err);
      throw new DatabaseError("Failed to initialize PostgreSQL schema", { 
        details: { error: err.message }
      });
    }
  }

  /**
   * Initialize SQLite schema
   */
  private async initializeSqliteSchema(): Promise<void> {
    if (!this.db || this.dbSystem !== "sqlite") {
      throw new DatabaseError("SQLite database not initialized");
    }
    
    try {
      // Check if schema needs to be initialized
      const db = this.db as DB;
      const result = db.query<[number]>(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='users'"
      );
      
      if (result[0][0] === 0) {
        logger.info("Initializing SQLite schema");
        
        // Read schema file
        const schemaSQL = await Deno.readTextFile(dbConfig.schemaPath);
        
        // Convert PostgreSQL schema to SQLite compatible
        const sqliteSchema = this.convertPgSchemaToSqlite(schemaSQL);
        
        // Execute schema SQL
        db.execute(sqliteSchema);
        logger.info("SQLite schema initialized successfully");
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to initialize SQLite schema", err);
      throw new DatabaseError("Failed to initialize SQLite schema", { 
        details: { error: err.message }
      });
    }
  }

  /**
   * Convert PostgreSQL schema to SQLite compatible
   * @param pgSchema - PostgreSQL schema SQL
   * @returns SQLite compatible schema SQL
   */
  private convertPgSchemaToSqlite(pgSchema: string): string {
    // Replace PostgreSQL-specific syntax with SQLite compatible syntax
    return pgSchema
      // Replace serial with integer primary key
      .replace(/SERIAL PRIMARY KEY/gi, "INTEGER PRIMARY KEY AUTOINCREMENT")
      // Replace timestamp with datetime
      .replace(/TIMESTAMP/gi, "DATETIME")
      // Replace now() with datetime('now')
      .replace(/NOW\(\)/gi, "datetime('now')")
      // Remove PostgreSQL-specific column constraints
      .replace(/WITH TIME ZONE/gi, "")
      // Handle other PostgreSQL-specific syntax
      .replace(/CREATE EXTENSION IF NOT EXISTS.+?;/g, "")
      .replace(/OWNER TO.+?;/g, "");
  }

  /**
   * Execute a query and return the result
   * @param sql - SQL query
   * @param params - Query parameters
   * @returns Query result
   */
  async query<T extends RowObject = RowObject>(
    sql: string,
    params: unknown[] = []
  ): Promise<QueryResult<T>> {
    if (!this.db) {
      throw new DatabaseError("Database not initialized");
    }
    
    if (dbConfig.logQueries) {
      logger.debug(`Executing query: ${sql}`, { params });
    }
    
    try {
      if (this.dbSystem === "postgres") {
        // PostgreSQL query
        const client = this.client || await (this.db as Pool).connect();
        
        try {
          const result = await client.queryObject<T>(sql, params);
          
          if (!this.client) {
            client.release();
          }
          
          return {
            rows: result.rows,
            rowCount: result.rows.length,
          };
        } catch (error) {
          if (!this.client) {
            client.release();
          }
          throw error;
        }
      } else {
        // SQLite query
        const db = this.db as DB;
        
        if (sql.trim().toLowerCase().startsWith("select") || sql.trim().toLowerCase().startsWith("pragma")) {
          // For SELECT queries
          // Convert params to the format SQLite expects
          const sqliteParams = params as QueryParameterSet;
          const rows = db.queryEntries(sql, sqliteParams) as T[];
          return {
            rows,
            rowCount: rows.length,
          };
        } else {
          // For INSERT, UPDATE, DELETE queries
          // Convert params to the format SQLite expects
          const sqliteParams = params as QueryParameterSet;
          db.query(sql, sqliteParams);
          
          // Get last insert ID for INSERT queries
          let lastInsertId: number | undefined;
          if (sql.trim().toLowerCase().startsWith("insert")) {
            lastInsertId = db.lastInsertRowId;
          }
          
          return {
            rows: [],
            rowCount: db.changes,
            lastInsertId,
          };
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error(`Query error: ${err.message}`, err);
      throw new DatabaseError(`Database query error: ${err.message}`, {
        details: { sql, params: JSON.stringify(params) }
      });
    }
  }

  /**
   * Insert a record and return the inserted ID
   * @param table - Table name
   * @param data - Record data
   * @returns Inserted record ID
   */
  async insert(table: string, data: Record<string, unknown>): Promise<number> {
    if (!this.db) {
      throw new DatabaseError("Database not initialized");
    }
    
    const columns = Object.keys(data);
    const placeholders = columns.map((_, i) => this.dbSystem === "postgres" ? `$${i + 1}` : "?").join(", ");
    const values = Object.values(data);
    
    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
    
    const result = await this.query(sql, values);
    
    // Handle getting the last insert ID
    if (typeof result.lastInsertId !== "undefined") {
      // SQLite case
      return Number(result.lastInsertId);
    } else if (this.dbSystem === "postgres") {
      // PostgreSQL case - query the last inserted ID
      const idResult = await this.query<{ id: number }>(
        `SELECT currval(pg_get_serial_sequence('${table}', 'id')) as id`
      );
      if (idResult.rows.length > 0) {
        return idResult.rows[0].id;
      }
    }
    
    // Fallback if we couldn't get the ID
    logger.warn(`Could not determine last insert ID for table ${table}`);
    return -1;
  }

  /**
   * Update records in a table
   * @param table - Table name
   * @param data - Record data to update
   * @param whereClause - WHERE clause
   * @param whereParams - WHERE clause parameters
   * @returns Number of affected rows
   */
  async update(
    table: string,
    data: Record<string, unknown>,
    whereClause: string,
    whereParams: unknown[] = []
  ): Promise<number> {
    if (!this.db) {
      throw new DatabaseError("Database not initialized");
    }
    
    const columns = Object.keys(data);
    const values = Object.values(data);
    
    let setClause: string;
    let params: unknown[];
    
    if (this.dbSystem === "postgres") {
      // PostgreSQL uses $1, $2, etc. for parameters
      setClause = columns.map((col, i) => `${col} = $${i + 1}`).join(", ");
      
      // Adjust WHERE clause parameter placeholders
      let adjustedWhereClause = whereClause;
      for (let i = 0; i < whereParams.length; i++) {
        adjustedWhereClause = adjustedWhereClause.replace(
          this.dbSystem === "postgres" ? `$${i + 1}` : "?",
          `$${columns.length + i + 1}`
        );
      }
      
      params = [...values, ...whereParams];
      whereClause = adjustedWhereClause;
    } else {
      // SQLite uses ? for parameters
      setClause = columns.map(col => `${col} = ?`).join(", ");
      params = [...values, ...whereParams];
    }
    
    const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
    
    const result = await this.query(sql, params);
    return result.rowCount;
  }

  /**
   * Delete records from a table
   * @param table - Table name
   * @param whereClause - WHERE clause
   * @param whereParams - WHERE clause parameters
   * @returns Number of affected rows
   */
  async delete(
    table: string,
    whereClause: string,
    whereParams: unknown[] = []
  ): Promise<number> {
    if (!this.db) {
      throw new DatabaseError("Database not initialized");
    }
    
    const sql = `DELETE FROM ${table} WHERE ${whereClause}`;
    
    const result = await this.query(sql, whereParams);
    return result.rowCount;
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(): Promise<void> {
    if (!this.db) {
      throw new DatabaseError("Database not initialized");
    }
    
    if (this.inTransaction) {
      throw new DatabaseError("Transaction already in progress");
    }
    
    try {
      if (this.dbSystem === "postgres") {
        this.client = await (this.db as Pool).connect();
        await this.client.queryObject("BEGIN");
      } else {
        const db = this.db as DB;
        db.query("BEGIN TRANSACTION");
      }
      
      this.inTransaction = true;
      logger.debug("Transaction started");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to begin transaction", err);
      throw new DatabaseError("Failed to begin transaction", { 
        details: { error: err.message }
      });
    }
  }

  /**
   * Commit a transaction
   */
  async commitTransaction(): Promise<void> {
    if (!this.db) {
      throw new DatabaseError("Database not initialized");
    }
    
    if (!this.inTransaction) {
      throw new DatabaseError("No transaction in progress");
    }
    
    try {
      if (this.dbSystem === "postgres") {
        if (!this.client) {
          throw new DatabaseError("Transaction client not available");
        }
        
        await this.client.queryObject("COMMIT");
        this.client.release();
        this.client = null;
      } else {
        const db = this.db as DB;
        db.query("COMMIT");
      }
      
      this.inTransaction = false;
      logger.debug("Transaction committed");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to commit transaction", err);
      throw new DatabaseError("Failed to commit transaction", { 
        details: { error: err.message }
      });
    }
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(): Promise<void> {
    if (!this.db) {
      throw new DatabaseError("Database not initialized");
    }
    
    if (!this.inTransaction) {
      logger.warn("No transaction to rollback");
      return;
    }
    
    try {
      if (this.dbSystem === "postgres") {
        if (!this.client) {
          throw new DatabaseError("Transaction client not available");
        }
        
        await this.client.queryObject("ROLLBACK");
        this.client.release();
        this.client = null;
      } else {
        const db = this.db as DB;
        db.query("ROLLBACK");
      }
      
      this.inTransaction = false;
      logger.debug("Transaction rolled back");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Failed to rollback transaction", err);
      throw new DatabaseError("Failed to rollback transaction", { 
        details: { error: err.message }
      });
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (!this.db) {
      return;
    }
    
    try {
      if (this.inTransaction) {
        await this.rollbackTransaction();
      }
      
      if (this.dbSystem === "postgres") {
        if (this.client) {
          this.client.release();
          this.client = null;
        }
        
        await (this.db as Pool).end();
      } else {
        const db = this.db as DB;
        db.close();
      }
      
      this.db = null;
      this.dbSystem = null;
      logger.info("Database connection closed");
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Error closing database connection", err);
    }
  }
}

// Create and export a singleton instance
const dbService = new DatabaseService();
export default dbService; 