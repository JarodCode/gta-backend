// database.ts - Database connection and initialization
import { DB } from "https://deno.land/x/sqlite@v3.7.0/mod.ts";
import { Pool } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

// Try PostgreSQL first, with fallback to SQLite
let db: any;
let isPostgres = true;

export async function initDatabase() {
  try {
    // Try PostgreSQL connection
    const POSTGRES_URL = Deno.env.get("DATABASE_URL") || "postgres://gametrackr:gametrackrpass@localhost:5432/gametrackr";
    console.log("Attempting PostgreSQL connection...");
    
    // Set a short timeout for connection attempts
    const pool = new Pool(POSTGRES_URL, 2);
    const client = await Promise.race([
      pool.connect(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Connection timeout")), 3000)
      )
    ]) as any;
    
    // If we got here, PostgreSQL is available
    console.log("PostgreSQL connected successfully");
    db = pool;
    isPostgres = true;
    
    // Initialize schema
    try {
      const schemaSQL = await Deno.readTextFile("./database/schema.sql");
      await client.queryArray(schemaSQL);
      console.log("PostgreSQL schema initialized successfully");
    } finally {
      client.release();
    }
    return pool;
  } catch (error) {
    // Fallback to SQLite
    console.error("PostgreSQL connection failed:", error.message);
    console.log("Falling back to SQLite...");
    isPostgres = false;
    
    // Create SQLite database
    const DB_PATH = Deno.env.get("DATABASE_PATH") || "./data/database.sqlite";
    db = new DB(DB_PATH);
    
    // Initialize SQLite schema by converting PostgreSQL schema
    try {
      let schemaSQL = await Deno.readTextFile("./database/schema.sql");
      
      // Convert PostgreSQL schema to SQLite
      schemaSQL = schemaSQL
        .replace(/SERIAL PRIMARY KEY/g, "INTEGER PRIMARY KEY AUTOINCREMENT")
        .replace(/NOW\(\)/g, "CURRENT_TIMESTAMP")
        .replace(/TIMESTAMP DEFAULT/g, "TIMESTAMP DEFAULT")
        .replace(/\$(\d+)/g, "?");
      
      db.execute(schemaSQL);
      console.log("SQLite schema initialized successfully");
    } catch (e) {
      console.error("Error initializing SQLite schema:", e);
    }
    
    return db;
  }
}

export async function executeQuery(query: string, params: any[] = []) {
  if (isPostgres) {
    const client = await (db as Pool).connect();
    try {
      // Convert query placeholder style if needed
      const pgQuery = query.replace(/\?/g, (_, i) => `$${i + 1}`);
      return await client.queryArray(pgQuery, params);
    } finally {
      client.release();
    }
  } else {
    // SQLite execution
    return db.query(query, params);
  }
}

export async function executeQueryAndReturnId(query: string, params: any[] = []) {
  if (isPostgres) {
    const client = await (db as Pool).connect();
    try {
      // Convert query placeholder style if needed
      const pgQuery = query.replace(/\?/g, (_, i) => `$${i + 1}`);
      const result = await client.queryArray({ text: `${pgQuery} RETURNING id`, args: params });
      return result.rows[0]?.[0];
    } finally {
      client.release();
    }
  } else {
    // SQLite execution
    db.query(query, params);
    return db.lastInsertRowId;
  }
}

export async function executeQueryAndReturnResults<T>(query: string, params: any[] = []): Promise<T[]> {
  if (isPostgres) {
    const client = await (db as Pool).connect();
    try {
      // Convert query placeholder style if needed
      const pgQuery = query.replace(/\?/g, (_, i) => `$${i + 1}`);
      const result = await client.queryObject<T>(pgQuery, params);
      return result.rows;
    } finally {
      client.release();
    }
  } else {
    // SQLite execution (with simple mapping)
    const rows = db.queryEntries(query, params);
    return Array.from(rows) as T[];
  }
}