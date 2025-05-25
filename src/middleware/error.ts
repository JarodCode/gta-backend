/**
 * Error Handling Middleware
 * 
 * This middleware provides centralized error handling for the application.
 * It catches errors thrown during request processing and returns appropriate responses.
 */

import { Context, isHttpError, Status } from "https://deno.land/x/oak@v12.5.0/mod.ts";
import { ApiError, NotFoundError } from "../utils/errors.ts";
import logger from "../utils/logger.ts";

/**
 * Error handling middleware
 * @param ctx - Oak context
 * @param next - Next middleware function
 */
export async function errorMiddleware(ctx: Context, next: Next): Promise<void> {
  try {
    // Process the request
    await next();
    
    // If no route matched, return 404
    if (ctx.response.status === 404 && !ctx.response.body) {
      throw new NotFoundError("Endpoint not found");
    }
  } catch (error) {
    // Log the error
    logger.error("Request error", error);
    
    // Format the error response
    let status = 500;
    let message = "Internal server error";
    let errorCode = "INTERNAL_SERVER_ERROR";
    let details: Record<string, unknown> | undefined;
    
    // Handle different error types
    if (error instanceof ApiError) {
      status = error.status;
      message = error.message;
      errorCode = error.code;
      details = error.details;
    } else if (isHttpError(error)) {
      status = error.status;
      message = error.message;
      errorCode = `HTTP_${error.status}`;
    } else if (error instanceof Error) {
      message = error.message;
    }
    
    // Set response
    ctx.response.status = status;
    ctx.response.body = {
      success: false,
      error: {
        code: errorCode,
        message,
        ...(details ? { details } : {}),
      },
    };
  } finally {
    // Log request completion
    const method = ctx.request.method;
    const path = ctx.request.url.pathname;
    const status = ctx.response.status;
    
    if (status >= 400) {
      logger.warn(`${method} ${path} ${status}`);
    }
  }
}

// Import Next type
import type { Next } from "https://deno.land/x/oak@v12.5.0/mod.ts"; 