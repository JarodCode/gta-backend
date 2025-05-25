/**
 * Validation Utilities
 * 
 * This file contains utilities for validating request data using Zod.
 * It provides a consistent approach to input validation across the application.
 */

import { z } from "https://deno.land/x/zod@v3.21.4/mod.ts";
import { Context, Next } from "https://deno.land/x/oak@v12.5.0/mod.ts";
import { BadRequestError } from "./errors.ts";
import { AUTH, RATINGS } from "../config/constants.ts";

// Define the extended Context type with params
type RouterContext = Context & {
  params: Record<string, string>;
};

/**
 * User registration schema
 */
export const userRegistrationSchema = z.object({
  username: z.string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username cannot exceed 30 characters")
    .regex(/^[a-zA-Z0-9_-]+$/, "Username can only contain letters, numbers, underscores, and hyphens"),
  
  email: z.string()
    .email("Invalid email address"),
  
  password: z.string()
    .min(AUTH.MIN_PASSWORD_LENGTH, `Password must be at least ${AUTH.MIN_PASSWORD_LENGTH} characters`)
    .max(100, "Password cannot exceed 100 characters"),
});

/**
 * User login schema
 */
export const userLoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

/**
 * Review creation schema
 */
export const reviewCreationSchema = z.object({
  gameId: z.string().min(1, "Game ID is required"),
  rating: z.number()
    .int("Rating must be a whole number")
    .min(RATINGS.MIN_RATING, `Rating must be at least ${RATINGS.MIN_RATING}`)
    .max(RATINGS.MAX_RATING, `Rating cannot exceed ${RATINGS.MAX_RATING}`),
  content: z.string()
    .min(1, "Review content is required")
    .max(2000, "Review content cannot exceed 2000 characters"),
  gameTitle: z.string().optional(),
  gameCoverUrl: z.string().optional(),
});

/**
 * Review update schema
 */
export const reviewUpdateSchema = z.object({
  rating: z.number()
    .int("Rating must be a whole number")
    .min(RATINGS.MIN_RATING, `Rating must be at least ${RATINGS.MIN_RATING}`)
    .max(RATINGS.MAX_RATING, `Rating cannot exceed ${RATINGS.MAX_RATING}`)
    .optional(),
  content: z.string()
    .min(1, "Review content is required")
    .max(2000, "Review content cannot exceed 2000 characters")
    .optional(),
}).refine((data: Record<string, unknown>) => Object.keys(data).length > 0, {
  message: "At least one field must be provided for update"
});

/**
 * Game ID parameter schema
 */
export const gameIdParamSchema = z.object({
  id: z.string().min(1, "Game ID is required"),
});

/**
 * Review ID parameter schema
 */
export const reviewIdParamSchema = z.object({
  id: z.string().min(1, "Review ID is required"),
});

/**
 * Generic validation middleware factory
 * Creates a middleware function that validates request data against a Zod schema
 * 
 * @param schema - Zod schema to validate against
 * @param source - Source of the data to validate (body, params, query)
 * @returns Middleware function that validates the request data
 */
export function validateRequest<T>(
  schema: z.ZodType<T>,
  source: 'body' | 'params' | 'query' = 'body'
) {
  return async (ctx: RouterContext, next: Next) => {
    try {
      let data: unknown;
      
      // Get data from the specified source
      if (source === 'body') {
        data = await ctx.request.body.json();
      } else if (source === 'params') {
        data = ctx.params;
      } else if (source === 'query') {
        data = Object.fromEntries(ctx.request.url.searchParams);
      }
      
      // Validate data against schema
      const validatedData = schema.parse(data);
      
      // Store validated data in context state
      ctx.state.validatedData = validatedData;
      
      await next();
    } catch (error) {
      // If validation fails, throw a BadRequestError with the validation errors
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map((err: z.ZodIssue) => ({
          path: err.path.join('.'),
          message: err.message
        }));
        
        throw new BadRequestError("Validation failed", { errors: formattedErrors });
      }
      
      // Re-throw other errors
      throw error;
    }
  };
} 