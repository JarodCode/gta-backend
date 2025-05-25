/**
 * Authentication Utilities
 * 
 * This file provides utilities for user authentication, including:
 * - Password hashing and verification
 * - JWT token generation and verification
 * - Authentication middleware
 */

import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
import { create, verify, decode } from "https://deno.land/x/djwt@v2.9.1/mod.ts";
import { Context, Next } from "https://deno.land/x/oak@v12.5.0/mod.ts";
import { AUTH } from "../config/constants.ts";
import { UnauthorizedError } from "./errors.ts";
import logger from "./logger.ts";

// Define types for JWT payload
export interface JwtPayload {
  sub: string;
  username: string;
  exp: number;
  iat: number;
}

// Define user type for authentication
export interface AuthUser {
  id: string;
  username: string;
}

// Extend Context type to include user
type AuthContext = Context & {
  state: {
    user?: AuthUser;
  };
};

/**
 * Hash a password using bcrypt
 * @param password - Plain text password
 * @returns Hashed password
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, AUTH.BCRYPT_SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 * @param password - Plain text password to verify
 * @param hash - Stored password hash
 * @returns Boolean indicating if the password matches
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    logger.error("Password verification error", error);
    return false;
  }
}

/**
 * Generate a JWT token for a user
 * @param user - User object with id and username
 * @returns JWT token string
 */
export async function generateToken(user: AuthUser): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(AUTH.JWT_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  
  return await create(
    { alg: "HS256", typ: "JWT" },
    {
      sub: user.id,
      username: user.username,
      exp: now + AUTH.TOKEN_EXPIRY,
      iat: now,
    },
    key
  );
}

/**
 * Verify and decode a JWT token
 * @param token - JWT token string
 * @returns Decoded JWT payload
 * @throws UnauthorizedError if token is invalid
 */
export async function verifyToken(token: string): Promise<JwtPayload> {
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(AUTH.JWT_SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const payload = await verify(token, key);
    return payload as JwtPayload;
  } catch (error) {
    logger.debug("Token verification failed", { error: error.message });
    throw new UnauthorizedError("Invalid or expired token");
  }
}

/**
 * Extract token from request
 * @param ctx - Oak context
 * @returns Token string or null if not found
 */
export function extractToken(ctx: Context): string | null {
  // Check authorization header
  const authHeader = ctx.request.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  
  // Check cookies
  const cookies = ctx.cookies;
  const tokenCookie = cookies.get(AUTH.COOKIE_NAME);
  if (tokenCookie) {
    return tokenCookie;
  }
  
  return null;
}

/**
 * Authentication middleware
 * Verifies JWT token and sets user in context state
 * @param ctx - Oak context
 * @param next - Next middleware function
 */
export async function authMiddleware(ctx: AuthContext, next: Next): Promise<void> {
  try {
    const token = extractToken(ctx);
    
    if (!token) {
      throw new UnauthorizedError("Authentication required");
    }
    
    const payload = await verifyToken(token);
    
    ctx.state.user = {
      id: payload.sub,
      username: payload.username,
    };
    
    await next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    
    throw new UnauthorizedError("Authentication failed");
  }
}

/**
 * Optional authentication middleware
 * Attempts to verify JWT token but continues if not present
 * @param ctx - Oak context
 * @param next - Next middleware function
 */
export async function optionalAuthMiddleware(ctx: AuthContext, next: Next): Promise<void> {
  try {
    const token = extractToken(ctx);
    
    if (token) {
      const payload = await verifyToken(token);
      
      ctx.state.user = {
        id: payload.sub,
        username: payload.username,
      };
    }
    
    await next();
  } catch (error) {
    // Continue without authentication
    logger.debug("Optional authentication failed", { error: error.message });
    await next();
  }
} 