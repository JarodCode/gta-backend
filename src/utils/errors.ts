/**
 * Custom Error Classes
 * 
 * This file contains custom error classes used throughout the application
 * to provide consistent error handling and responses.
 */

/**
 * Base API Error class
 * Extends the native Error class with additional properties for API error handling
 */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    status = 500,
    code = "INTERNAL_SERVER_ERROR",
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.code = code;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Converts the error to a response-ready object
   */
  toJSON(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.message,
        ...(this.details ? { details: this.details } : {})
      }
    };
  }
}

/**
 * 400 Bad Request Error
 * Used when the client sends a request with invalid data
 */
export class BadRequestError extends ApiError {
  constructor(message = "Bad request", details?: Record<string, unknown>) {
    super(message, 400, "BAD_REQUEST", details);
  }
}

/**
 * 401 Unauthorized Error
 * Used when authentication is required but not provided or invalid
 */
export class UnauthorizedError extends ApiError {
  constructor(message = "Authentication required", details?: Record<string, unknown>) {
    super(message, 401, "UNAUTHORIZED", details);
  }
}

/**
 * 403 Forbidden Error
 * Used when the user doesn't have permission to access the resource
 */
export class ForbiddenError extends ApiError {
  constructor(message = "Access denied", details?: Record<string, unknown>) {
    super(message, 403, "FORBIDDEN", details);
  }
}

/**
 * 404 Not Found Error
 * Used when the requested resource doesn't exist
 */
export class NotFoundError extends ApiError {
  constructor(message = "Resource not found", details?: Record<string, unknown>) {
    super(message, 404, "NOT_FOUND", details);
  }
}

/**
 * 409 Conflict Error
 * Used when there's a conflict with the current state of the resource
 */
export class ConflictError extends ApiError {
  constructor(message = "Resource conflict", details?: Record<string, unknown>) {
    super(message, 409, "CONFLICT", details);
  }
}

/**
 * 422 Unprocessable Entity Error
 * Used when the server understands the content type but can't process the data
 */
export class UnprocessableEntityError extends ApiError {
  constructor(message = "Unprocessable entity", details?: Record<string, unknown>) {
    super(message, 422, "UNPROCESSABLE_ENTITY", details);
  }
}

/**
 * 500 Internal Server Error
 * Used for unexpected server errors
 */
export class InternalServerError extends ApiError {
  constructor(message = "Internal server error", details?: Record<string, unknown>) {
    super(message, 500, "INTERNAL_SERVER_ERROR", details);
  }
}

/**
 * 503 Service Unavailable Error
 * Used when the server is temporarily unavailable
 */
export class ServiceUnavailableError extends ApiError {
  constructor(message = "Service temporarily unavailable", details?: Record<string, unknown>) {
    super(message, 503, "SERVICE_UNAVAILABLE", details);
  }
}

/**
 * Database Error
 * Specialized error for database-related issues
 */
export class DatabaseError extends ApiError {
  constructor(message = "Database error", details?: Record<string, unknown>) {
    super(message, 500, "DATABASE_ERROR", details);
  }
}

/**
 * Authentication Error
 * Specialized error for authentication-related issues
 */
export class AuthenticationError extends UnauthorizedError {
  constructor(message = "Authentication failed", details?: Record<string, unknown>) {
    super(message, details);
    this.code = "AUTHENTICATION_ERROR";
  }
}

/**
 * Validation Error
 * Specialized error for validation-related issues
 */
export class ValidationError extends BadRequestError {
  constructor(message = "Validation failed", details?: Record<string, unknown>) {
    super(message, details);
    this.code = "VALIDATION_ERROR";
  }
} 