// auth.ts - User authentication routes with bcrypt and cookie support
import { Router } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { executeQuery, executeQueryAndReturnId, executeQueryAndReturnResults } from "../database.ts";
import { create, verify } from "https://deno.land/x/djwt@v3.0.0/mod.ts";
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";

const router = new Router();
const SECRET_KEY = Deno.env.get("JWT_SECRET") || "super-secret-jwt-key-for-game-tracking-app";
const COOKIE_NAME = "auth_token";
const COOKIE_OPTIONS = { httpOnly: true, secure: false, sameSite: "lax" as const };

// Convert string to crypto key for JWT
const getJwtKey = async () => {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SECRET_KEY);
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    true,
    ["sign", "verify"]
  );
};

// Generate secure password hash with bcrypt
async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password);
}

// Check if username is already taken
async function isUsernameTaken(username: string): Promise<boolean> {
  const result = await executeQueryAndReturnResults<{ count: number }>(
    "SELECT COUNT(*) as count FROM users WHERE username = ?",
    [username]
  );
  return result[0].count > 0;
}

// Check if email is already taken
async function isEmailTaken(email: string): Promise<boolean> {
  const result = await executeQueryAndReturnResults<{ count: number }>(
    "SELECT COUNT(*) as count FROM users WHERE email = ?",
    [email]
  );
  return result[0].count > 0;
}

// Helper to set JSON response
function setJsonResponse(ctx: any, status: number, data: any) {
  ctx.response.status = status;
  ctx.response.type = "application/json; charset=utf-8";
  
  // Ensure only clean JSON is sent
  if (typeof data === "object") {
    ctx.response.body = JSON.stringify(data);
  } else {
    ctx.response.body = JSON.stringify({ error: "Invalid response data" });
  }
}

// Set authentication cookie
function setAuthCookie(ctx: any, token: string) {
  ctx.cookies.set(COOKIE_NAME, token, COOKIE_OPTIONS);
}

// Register a new user
router.post("/register", async (ctx) => {
  try {
    console.log("Processing registration request");
    
    // Parse request body
    let body;
    try {
      body = await ctx.request.body.json();
      console.log("Registration request parsed", { username: body.username, email: body.email });
    } catch (e) {
      console.error("Failed to parse registration request body:", e);
      setJsonResponse(ctx, 400, { error: "Invalid request body. Expected JSON." });
      return;
    }
    
    const { username, email, password } = body;
    
    // Basic validation
    if (!username || !email || !password) {
      console.log("Registration validation failed - missing fields");
      setJsonResponse(ctx, 400, { error: "Username, email and password are required" });
      return;
    }
    
    if (password.length < 6) {
      console.log("Registration validation failed - password too short");
      setJsonResponse(ctx, 400, { error: "Password must be at least 6 characters" });
      return;
    }
    
    // Check if username or email is already taken
    if (await isUsernameTaken(username)) {
      console.log("Registration failed - username already taken:", username);
      setJsonResponse(ctx, 400, { error: "Username is already taken" });
      return;
    }
    
    if (await isEmailTaken(email)) {
      console.log("Registration failed - email already taken:", email);
      setJsonResponse(ctx, 400, { error: "Email is already taken" });
      return;
    }
    
    // Hash the password with bcrypt
    console.log("Hashing password with bcrypt");
    const passwordHash = await hashPassword(password);
    
    // Insert the new user
    console.log("Inserting new user into database");
    const userId = await executeQueryAndReturnId(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, passwordHash]
    );
    
    // Generate JWT token
    console.log("Generating JWT token for new user");
    const key = await getJwtKey();
    const jwt = await create(
      { alg: "HS256", typ: "JWT" },
      { user_id: userId, username, exp: Date.now() + 30 * 24 * 60 * 60 * 1000 }, // 30 days expiration
      key
    );
    
    // Set authentication cookie
    setAuthCookie(ctx, jwt);
    
    console.log("Registration successful for user:", username);
    
    // Format response as clean JSON
    setJsonResponse(ctx, 201, { 
      user: { id: userId, username, email },
      token: jwt
    });
  } catch (error) {
    console.error("Registration error:", error);
    setJsonResponse(ctx, 500, { error: "Registration failed: " + error.message });
  }
});

// Login user
router.post("/login", async (ctx) => {
  try {
    console.log("Processing login request");
    
    // Parse request body
    let body;
    try {
      body = await ctx.request.body.json();
      console.log("Login request parsed", { username: body?.username || 'missing' });
    } catch (e) {
      console.error("Failed to parse login request body:", e);
      setJsonResponse(ctx, 400, { error: "Invalid request body. Expected JSON." });
      return;
    }
    
    // Validate required fields
    const { username, password } = body || {};
    
    if (!username || !password) {
      console.log("Login validation failed - missing fields", { 
        hasUsername: !!username, 
        hasPassword: !!password 
      });
      setJsonResponse(ctx, 400, { error: "Username and password are required" });
      return;
    }
    
    console.log("Looking up user in database for:", username);
    try {
      // Find the user
      const users = await executeQueryAndReturnResults<{ id: number, username: string, email: string, password_hash: string }>(
        "SELECT id, username, email, password_hash FROM users WHERE username = ?",
        [username]
      );
      
      console.log(`User lookup result: found ${users.length} users`);
      
      if (users.length === 0) {
        console.log(`User not found: ${username}`);
        setJsonResponse(ctx, 401, { error: "Invalid username or password" });
        return;
      }
      
      const user = users[0];
      console.log(`Found user: ${user.username} (ID: ${user.id})`);
      
      try {
        // Verify password using bcrypt
        console.log("Verifying password");
        const isPasswordValid = await bcrypt.compare(password, user.password_hash);
        
        if (!isPasswordValid) {
          console.log(`Invalid password for user: ${username}`);
          setJsonResponse(ctx, 401, { error: "Invalid username or password" });
          return;
        }
        
        // Generate JWT token
        console.log("Password verified, generating JWT token");
        const key = await getJwtKey();
        const jwt = await create(
          { alg: "HS256", typ: "JWT" },
          { user_id: user.id, username: user.username, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }, // 7 days expiration
          key
        );
        
        // Set authentication cookie
        setAuthCookie(ctx, jwt);
        
        console.log("Login successful for user:", username);
        
        // Return successful response
        setJsonResponse(ctx, 200, {
          token: jwt,
          user: {
            id: user.id,
            username: user.username,
            email: user.email
          }
        });
      } catch (passwordError) {
        console.error("Password verification error:", passwordError);
        setJsonResponse(ctx, 500, { error: "Authentication error: " + passwordError.message });
      }
    } catch (dbError) {
      console.error("Database query error:", dbError);
      setJsonResponse(ctx, 500, { error: "Database error: " + dbError.message });
    }
  } catch (error) {
    console.error("Login route error:", error);
    setJsonResponse(ctx, 500, { error: "Login failed: " + error.message });
  }
});

// Get current user (verify token)
router.get("/me", async (ctx) => {
  try {
    console.log("Processing /me request");
    
    // Try to get token from cookie first
    let token = ctx.cookies.get(COOKIE_NAME);
    let source = "cookie";
    
    // If no cookie, try authorization header
    if (!token) {
      const authHeader = ctx.request.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
        source = "header";
      }
    }
    
    if (!token) {
      console.log("Auth failed - no token found in cookie or header");
      setJsonResponse(ctx, 401, { error: "Unauthorized - missing token" });
      return;
    }
    
    console.log(`Token received from ${source}, validating...`);
    
    // Verify token
    try {
      const key = await getJwtKey();
      const payload = await verify(token, key);
      console.log("Token valid for user_id:", payload.user_id);
      
      // Get user details
      console.log("Querying database for user details");
      const users = await executeQueryAndReturnResults<{ id: number, username: string, email: string }>(
        "SELECT id, username, email FROM users WHERE id = ?",
        [payload.user_id]
      );
      
      if (users.length === 0) {
        console.log("User not found in database for id:", payload.user_id);
        setJsonResponse(ctx, 404, { error: "User not found" });
        return;
      }
      
      console.log("User found, returning details for:", users[0].username);
      
      // Format response as clean JSON
      setJsonResponse(ctx, 200, { user: users[0] });
    } catch (error) {
      console.error("Token validation error:", error);
      setJsonResponse(ctx, 401, { error: "Invalid or expired token: " + error.message });
    }
  } catch (error) {
    console.error("Auth verification error:", error);
    setJsonResponse(ctx, 500, { error: "Authentication verification failed: " + error.message });
  }
});

// Logout user
router.post("/logout", async (ctx) => {
  try {
    // Clear the auth cookie
    ctx.cookies.delete(COOKIE_NAME);
    setJsonResponse(ctx, 200, { message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    setJsonResponse(ctx, 500, { error: "Logout failed: " + error.message });
  }
});

export default router;