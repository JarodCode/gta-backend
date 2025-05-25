/**
 * Response Utilities
 * 
 * This file provides utilities for creating standardized API responses.
 * It ensures consistent response formats across the application.
 */

import { Context } from "https://deno.land/x/oak@v12.5.0/mod.ts";

/**
 * Standard API response structure
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    [key: string]: unknown;
  };
}

/**
 * Send a success response
 * @param ctx - Oak context
 * @param data - Response data
 * @param status - HTTP status code (default: 200)
 * @param meta - Optional metadata
 */
export function sendSuccess<T>(
  ctx: Context,
  data: T,
  status = 200,
  meta?: ApiResponse["meta"]
): void {
  ctx.response.status = status;
  ctx.response.body = {
    success: true,
    data,
    ...(meta ? { meta } : {}),
  };
}

/**
 * Send an error response
 * @param ctx - Oak context
 * @param message - Error message
 * @param status - HTTP status code (default: 500)
 * @param code - Error code (default: "INTERNAL_SERVER_ERROR")
 * @param details - Error details
 */
export function sendError(
  ctx: Context,
  message: string,
  status = 500,
  code = "INTERNAL_SERVER_ERROR",
  details?: Record<string, unknown>
): void {
  ctx.response.status = status;
  ctx.response.body = {
    success: false,
    error: {
      code,
      message,
      ...(details ? { details } : {}),
    },
  };
}

/**
 * Send a created response (201)
 * @param ctx - Oak context
 * @param data - Response data
 * @param meta - Optional metadata
 */
export function sendCreated<T>(
  ctx: Context,
  data: T,
  meta?: ApiResponse["meta"]
): void {
  sendSuccess(ctx, data, 201, meta);
}

/**
 * Send a no content response (204)
 * @param ctx - Oak context
 */
export function sendNoContent(ctx: Context): void {
  ctx.response.status = 204;
  ctx.response.body = null;
}

/**
 * Send a bad request response (400)
 * @param ctx - Oak context
 * @param message - Error message
 * @param details - Error details
 */
export function sendBadRequest(
  ctx: Context,
  message = "Bad request",
  details?: Record<string, unknown>
): void {
  sendError(ctx, message, 400, "BAD_REQUEST", details);
}

/**
 * Send an unauthorized response (401)
 * @param ctx - Oak context
 * @param message - Error message
 * @param details - Error details
 */
export function sendUnauthorized(
  ctx: Context,
  message = "Authentication required",
  details?: Record<string, unknown>
): void {
  sendError(ctx, message, 401, "UNAUTHORIZED", details);
}

/**
 * Send a forbidden response (403)
 * @param ctx - Oak context
 * @param message - Error message
 * @param details - Error details
 */
export function sendForbidden(
  ctx: Context,
  message = "Access denied",
  details?: Record<string, unknown>
): void {
  sendError(ctx, message, 403, "FORBIDDEN", details);
}

/**
 * Send a not found response (404)
 * @param ctx - Oak context
 * @param message - Error message
 * @param details - Error details
 */
export function sendNotFound(
  ctx: Context,
  message = "Resource not found",
  details?: Record<string, unknown>
): void {
  sendError(ctx, message, 404, "NOT_FOUND", details);
}

/**
 * Send a conflict response (409)
 * @param ctx - Oak context
 * @param message - Error message
 * @param details - Error details
 */
export function sendConflict(
  ctx: Context,
  message = "Resource conflict",
  details?: Record<string, unknown>
): void {
  sendError(ctx, message, 409, "CONFLICT", details);
}

/**
 * Send a validation error response (422)
 * @param ctx - Oak context
 * @param message - Error message
 * @param details - Validation error details
 */
export function sendValidationError(
  ctx: Context,
  message = "Validation failed",
  details?: Record<string, unknown>
): void {
  sendError(ctx, message, 422, "VALIDATION_ERROR", details);
}

/**
 * Send a server error response (500)
 * @param ctx - Oak context
 * @param message - Error message
 * @param details - Error details
 */
export function sendServerError(
  ctx: Context,
  message = "Internal server error",
  details?: Record<string, unknown>
): void {
  sendError(ctx, message, 500, "INTERNAL_SERVER_ERROR", details);
}

/**
 * Send a paginated response
 * @param ctx - Oak context
 * @param data - Response data
 * @param page - Current page number
 * @param limit - Items per page
 * @param total - Total number of items
 * @param additionalMeta - Additional metadata
 */
export function sendPaginated<T>(
  ctx: Context,
  data: T[],
  page: number,
  limit: number,
  total: number,
  additionalMeta?: Record<string, unknown>
): void {
  const meta = {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    ...additionalMeta,
  };
  
  sendSuccess(ctx, data, 200, meta);
} 