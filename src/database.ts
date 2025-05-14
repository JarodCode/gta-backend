// database.ts - Database connection and initialization
import { DB } from "https://deno.land/x/oak@v17.1.4/mod.ts";

let db: DB;

export async function initDatabase() {
  // Create or open the SQLite database
  db = new DB("./database/gta.db");
  
  // Initialize schema - create tables if they don't exist
  const schemaSQL = await Deno.readTextFile("./database/schema.sql");
  const statements = schemaSQL.split(";").filter(stmt => stmt.trim());
  
  for (const statement of statements) {
    if (statement.trim()) {
      db.query(statement);
    }
  }
  
  console.log("Database initialized successfully");
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error("Database not initialized");
  }
  return db;
}

// Helper functions for database operations
export function executeQuery(query: string, params: any[] = []) {
  return db.query(query, params);
}

export function executeQueryAndReturnId(query: string, params: any[] = []) {
  db.query(query, params);
  return db.lastInsertId;
}

export function executeQueryAndReturnResults<T>(query: string, params: any[] = []): T[] {
  const rows = db.query(query, params);
  const results: T[] = [];
  for (const row of rows) {
    const obj: any = {};
    for (let i = 0; i < row.length; i++) {
      obj[rows.columns[i]] = row[i];
    }
    results.push(obj as T);
  }
  return results;
}