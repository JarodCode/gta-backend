// auth.ts - Authentication routes
import { Router, Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { create as createJwt } from "https://deno.land/x/djwt/mod.ts";
import { hashSync, compareSync } from "https://deno.land/x/bcrypt/mod.ts";
import { executeQuery, executeQueryAndReturnResults, executeQueryAndReturnId } from "../database.ts";

const router = new Router({ prefix: "/api/auth" });
const JWT_SECRET = await crypto.subtle.generateKey(
  { name: "HMAC", hash: "SHA-512" },
  true,
  ["sign", "verify"]
);

export function getJwtSecret() {
  return JWT_SECRET;
}

// Register new user
router.post("/register", async (ctx: Context) => {
  try {
    if (!ctx.request.hasBody) {
      throw new Error("Request body is missing");
    }

    const body = await ctx.request.body({ type: "json" }).value;
    const { username, email, password } = body;

    // Validate input
    if (!username || !email || !password) {
      throw new Error("Username, email, and password are required");
    }

    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters long");
    }

    // Check if user already exists
    const existingUsers = executeQueryAndReturnResults<{ count: number }>(
      "SELECT COUNT(*) as count FROM users WHERE username = ? OR email = ?",
      [username, email]
    );

    if (existingUsers[0].count > 0) {
      throw new Error("Username or email already exists");
    }

    // Hash password
    const passwordHash = hashSync(password);

    // Insert new user
    const userId = executeQueryAndReturnId(
      "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
      [username, email, passwordHash]
    );

    // Generate JWT token
    const token = await createJwt(
      { alg: "HS512", typ: "JWT" },
      { id: userId, username, exp: Date.now() / 1000 + 60 * 60 * 24 }, // 24 hours expiration
      JWT_SECRET
    );

    ctx.response.status = 201;
    ctx.response.body = {
      success: true,
      message: "User registered successfully",
      data: {
        id: userId,
        username,
        token,
      },
    };
  } catch (err) {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      message: err.message || "Failed to register user",
    };
  }
});

// Login user
router.post("/login", async (ctx: Context) => {
  try {
    if (!ctx.request.hasBody) {
      throw new Error("Request body is missing");
    }

    const body = await ctx.request.body({ type: "json" }).value;
    const { username, password } = body;

    // Validate input
    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    // Get user from database
    const users = executeQueryAndReturnResults<{
      id: number;
      username: string;
      password_hash: string;
    }>("SELECT id, username, password_hash FROM users WHERE username = ?", [
      username,
    ]);

    if (users.length === 0) {
      throw new Error("Invalid username or password");
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = compareSync(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error("Invalid username or password");
    }

    // Generate JWT token
    const token = await createJwt(
      { alg: "HS512", typ: "JWT" },
      { id: user.id, username: user.username, exp: Date.now() / 1000 + 60 * 60 * 24 }, // 24 hours expiration
      JWT_SECRET
    );

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: "Login successful",
      data: {
        id: user.id,
        username: user.username,
        token,
      },
    };
  } catch (err) {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      message: err.message || "Failed to login",
    };
  }
});

// Get current user info
router.get("/me", async (ctx: Context) => {
  try {
    // This endpoint requires authentication, so the user should be in ctx.state
    const user = ctx.state.user;
    
    if (!user) {
      throw new Error("User not found");
    }

    const users = executeQueryAndReturnResults<{
      id: number;
      username: string;
      email: string;
      avatar_url: string;
      bio: string;
    }>("SELECT id, username, email, avatar_url, bio FROM users WHERE id = ?", [user.id]);

    if (users.length === 0) {
      throw new Error("User not found");
    }

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: users[0],
    };
  } catch (err) {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      message: err.message || "Failed to get user info",
    };
  }
});

export const authRouter = router;
