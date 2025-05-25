/**
 * Environment Variables Loader
 * 
 * This script loads environment variables from the .env file.
 * It should be run before starting the server.
 */

import { load } from "https://deno.land/std@0.207.0/dotenv/mod.ts";
import { join } from "https://deno.land/std@0.207.0/path/mod.ts";

async function loadEnvVariables() {
  try {
    // Determine environment
    const environment = Deno.env.get("ENVIRONMENT") || "development";
    console.log(`Loading environment variables for ${environment} environment`);

    // Load .env file
    const envPath = join(Deno.cwd(), ".env");
    const result = await load({ envPath });

    console.log("Environment variables loaded successfully:");
    console.log(`DATABASE_URL: ${Deno.env.get("DATABASE_URL") ? "********" : "Not set"}`);
    console.log(`DATABASE_PATH: ${Deno.env.get("DATABASE_PATH") || "Not set"}`);
    console.log(`JWT_SECRET: ${Deno.env.get("JWT_SECRET") ? "********" : "Not set"}`);
    console.log(`PORT: ${Deno.env.get("PORT") || "Not set"}`);
    console.log(`ENVIRONMENT: ${Deno.env.get("ENVIRONMENT") || "Not set"}`);
  } catch (error) {
    console.error("Failed to load environment variables:", error);
    Deno.exit(1);
  }
}

// Run the script
await loadEnvVariables(); 