/**
 * User Controller
 * 
 * Handles HTTP requests related to user operations:
 * - User registration and authentication
 * - User profile management
 * - User data retrieval
 */

import { Context } from "https://deno.land/x/oak@v12.5.0/mod.ts";
import { AUTH } from "../config/constants.ts";
import userService from "../services/user-service.ts";
import { BadRequestError, ConflictError, NotFoundError, UnauthorizedError } from "../utils/errors.ts";
import logger from "../utils/logger.ts";
import { sendCreated, sendSuccess, sendNoContent } from "../utils/response.ts";

/**
 * User controller class
 */
export class UserController {
  /**
   * Register a new user
   * @param ctx - Oak context
   */
  async register(ctx: Context): Promise<void> {
    try {
      // Get request body
      const body = await ctx.request.body.json();
      
      // Validate required fields
      if (!body.username || !body.email || !body.password) {
        throw new BadRequestError("Username, email, and password are required");
      }
      
      // Create user
      const user = await userService.createUser({
        username: body.username,
        email: body.email,
        password: body.password,
      });
      
      // Return created user
      sendCreated(ctx, { user });
    } catch (error) {
      // Handle specific errors
      if (error instanceof ConflictError) {
        throw error;
      }
      
      logger.error("User registration failed", error);
      throw new BadRequestError("User registration failed", { error: error.message });
    }
  }
  
  /**
   * Login a user
   * @param ctx - Oak context
   */
  async login(ctx: Context): Promise<void> {
    try {
      // Get request body
      const body = await ctx.request.body.json();
      
      // Validate required fields
      if (!body.username || !body.password) {
        throw new BadRequestError("Username and password are required");
      }
      
      // Authenticate user
      const { user, token } = await userService.authenticate(
        body.username,
        body.password
      );
      
      // Set cookie
      await ctx.cookies.set(AUTH.COOKIE_NAME, token, AUTH.COOKIE_OPTIONS);
      
      // Return user and token
      sendSuccess(ctx, { user, token });
    } catch (error) {
      // Handle specific errors
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      
      logger.error("User login failed", error);
      throw new BadRequestError("Login failed", { error: error.message });
    }
  }
  
  /**
   * Logout a user
   * @param ctx - Oak context
   */
  async logout(ctx: Context): Promise<void> {
    // Clear auth cookie
    await ctx.cookies.delete(AUTH.COOKIE_NAME);
    
    // Return success
    sendNoContent(ctx);
  }
  
  /**
   * Get current user profile
   * @param ctx - Oak context
   */
  async getCurrentUser(ctx: Context): Promise<void> {
    // Get user from context state (set by auth middleware)
    const userId = ctx.state.user?.id;
    
    if (!userId) {
      throw new UnauthorizedError("Authentication required");
    }
    
    // Get user details
    const user = await userService.findById(parseInt(userId));
    
    if (!user) {
      throw new NotFoundError("User not found");
    }
    
    // Return user without password
    const { password, ...userWithoutPassword } = user;
    sendSuccess(ctx, { user: userWithoutPassword });
  }
  
  /**
   * Update current user profile
   * @param ctx - Oak context
   */
  async updateCurrentUser(ctx: Context): Promise<void> {
    // Get user from context state (set by auth middleware)
    const userId = ctx.state.user?.id;
    
    if (!userId) {
      throw new UnauthorizedError("Authentication required");
    }
    
    // Get request body
    const body = await ctx.request.body.json();
    
    // Update user
    const user = await userService.updateUser(parseInt(userId), {
      email: body.email,
      password: body.password,
    });
    
    // Return updated user
    sendSuccess(ctx, { user });
  }
  
  /**
   * Get a user by ID
   * @param ctx - Oak context
   */
  async getUserById(ctx: Context): Promise<void> {
    // Get user ID from URL params
    const userId = ctx.params.id;
    
    if (!userId) {
      throw new BadRequestError("User ID is required");
    }
    
    // Get user details
    const user = await userService.findById(parseInt(userId));
    
    if (!user) {
      throw new NotFoundError("User not found");
    }
    
    // Return user without password
    const { password, ...userWithoutPassword } = user;
    sendSuccess(ctx, { user: userWithoutPassword });
  }
  
  /**
   * Get all users
   * @param ctx - Oak context
   */
  async getAllUsers(ctx: Context): Promise<void> {
    // Get pagination parameters
    const limit = parseInt(ctx.request.url.searchParams.get("limit") || "100");
    const offset = parseInt(ctx.request.url.searchParams.get("offset") || "0");
    
    // Get users with pagination
    const { users, total } = await userService.getAllUsers(limit, offset);
    
    // Return users with pagination metadata
    sendSuccess(ctx, { users }, 200, {
      pagination: {
        total,
        limit,
        offset,
      },
    });
  }
}

// Create and export a singleton instance
const userController = new UserController();
export default userController; 