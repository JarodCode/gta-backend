/**
 * User Service
 * 
 * This service handles user-related operations such as:
 * - User registration and authentication
 * - User profile management
 * - User data retrieval
 */

import db from "./database-service.ts";
import { hashPassword, verifyPassword, generateToken } from "../utils/auth.ts";
import { ConflictError, NotFoundError, UnauthorizedError } from "../utils/errors.ts";
import logger from "../utils/logger.ts";
import { RowObject } from "./database-service.ts";

/**
 * User interface
 */
export interface User extends RowObject {
  id: number;
  username: string;
  email: string;
  password: string;
  created_at: string;
  updated_at: string;
}

/**
 * User creation data
 */
export interface UserCreateData {
  username: string;
  email: string;
  password: string;
}

/**
 * User update data
 */
export interface UserUpdateData {
  email?: string;
  password?: string;
}

/**
 * User service class
 */
export class UserService {
  /**
   * Create a new user
   * @param userData - User data for creation
   * @returns Created user (without password)
   * @throws ConflictError if username or email already exists
   */
  async createUser(userData: UserCreateData): Promise<Omit<User, "password">> {
    // Check if username already exists
    const existingUsername = await this.findByUsername(userData.username);
    if (existingUsername) {
      throw new ConflictError("Username already exists");
    }
    
    // Check if email already exists
    const existingEmail = await this.findByEmail(userData.email);
    if (existingEmail) {
      throw new ConflictError("Email already exists");
    }
    
    // Hash the password
    const hashedPassword = await hashPassword(userData.password);
    
    // Create user record
    const userId = await db.insert("users", {
      username: userData.username,
      email: userData.email,
      password: hashedPassword,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    // Retrieve the created user
    const user = await this.findById(userId);
    if (!user) {
      throw new Error("Failed to retrieve created user");
    }
    
    // Return user without password
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }
  
  /**
   * Authenticate a user
   * @param username - Username
   * @param password - Password
   * @returns Authentication result with user data and token
   * @throws UnauthorizedError if authentication fails
   */
  async authenticate(username: string, password: string): Promise<{
    user: Omit<User, "password">;
    token: string;
  }> {
    // Find user by username
    const user = await this.findByUsername(username);
    if (!user) {
      logger.debug(`Authentication failed: User ${username} not found`);
      throw new UnauthorizedError("Invalid username or password");
    }
    
    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password);
    if (!isPasswordValid) {
      logger.debug(`Authentication failed: Invalid password for user ${username}`);
      throw new UnauthorizedError("Invalid username or password");
    }
    
    // Generate JWT token
    const token = await generateToken({
      id: user.id.toString(),
      username: user.username,
    });
    
    // Return user without password and token
    const { password: _, ...userWithoutPassword } = user;
    return {
      user: userWithoutPassword,
      token,
    };
  }
  
  /**
   * Find a user by ID
   * @param id - User ID
   * @returns User or null if not found
   */
  async findById(id: number): Promise<User | null> {
    const result = await db.query<User>(
      "SELECT * FROM users WHERE id = ?",
      [id]
    );
    
    return result.rows[0] || null;
  }
  
  /**
   * Find a user by username
   * @param username - Username
   * @returns User or null if not found
   */
  async findByUsername(username: string): Promise<User | null> {
    const result = await db.query<User>(
      "SELECT * FROM users WHERE username = ?",
      [username]
    );
    
    return result.rows[0] || null;
  }
  
  /**
   * Find a user by email
   * @param email - Email
   * @returns User or null if not found
   */
  async findByEmail(email: string): Promise<User | null> {
    const result = await db.query<User>(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );
    
    return result.rows[0] || null;
  }
  
  /**
   * Update a user
   * @param id - User ID
   * @param userData - User data for update
   * @returns Updated user (without password)
   * @throws NotFoundError if user not found
   * @throws ConflictError if email already exists
   */
  async updateUser(id: number, userData: UserUpdateData): Promise<Omit<User, "password">> {
    // Check if user exists
    const existingUser = await this.findById(id);
    if (!existingUser) {
      throw new NotFoundError(`User with ID ${id} not found`);
    }
    
    // Check if email already exists (if updating email)
    if (userData.email && userData.email !== existingUser.email) {
      const existingEmail = await this.findByEmail(userData.email);
      if (existingEmail) {
        throw new ConflictError("Email already exists");
      }
    }
    
    // Prepare update data
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    
    // Add email if provided
    if (userData.email) {
      updateData.email = userData.email;
    }
    
    // Add hashed password if provided
    if (userData.password) {
      updateData.password = await hashPassword(userData.password);
    }
    
    // Update user
    await db.update("users", updateData, "id = ?", [id]);
    
    // Retrieve updated user
    const updatedUser = await this.findById(id);
    if (!updatedUser) {
      throw new Error("Failed to retrieve updated user");
    }
    
    // Return user without password
    const { password, ...userWithoutPassword } = updatedUser;
    return userWithoutPassword;
  }
  
  /**
   * Delete a user
   * @param id - User ID
   * @returns True if user was deleted
   * @throws NotFoundError if user not found
   */
  async deleteUser(id: number): Promise<boolean> {
    // Check if user exists
    const existingUser = await this.findById(id);
    if (!existingUser) {
      throw new NotFoundError(`User with ID ${id} not found`);
    }
    
    // Delete user
    const result = await db.delete("users", "id = ?", [id]);
    
    return result > 0;
  }
  
  /**
   * Get all users
   * @param limit - Maximum number of users to return
   * @param offset - Number of users to skip
   * @returns List of users (without passwords)
   */
  async getAllUsers(limit = 100, offset = 0): Promise<{
    users: Array<Omit<User, "password">>;
    total: number;
  }> {
    // Get total count
    const countResult = await db.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM users"
    );
    const total = countResult.rows[0]?.count || 0;
    
    // Get users with pagination
    const result = await db.query<User>(
      "SELECT * FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [limit, offset]
    );
    
    // Remove passwords
    const users = result.rows.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });
    
    return { users, total };
  }
}

// Create and export a singleton instance
const userService = new UserService();
export default userService; 