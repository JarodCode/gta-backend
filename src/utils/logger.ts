/**
 * Logger Utility
 * 
 * This file provides a consistent logging interface for the application.
 * It supports different log levels and formats based on the environment.
 */

import { colors } from "https://deno.land/x/cliffy@v1.0.0-rc.3/ansi/colors.ts";
import { SERVER } from "../config/constants.ts";

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

// Current log level based on environment
const currentLogLevel = !SERVER.IS_DEVELOPMENT ? LogLevel.INFO : LogLevel.DEBUG;

/**
 * Format the current timestamp for logging
 * @returns Formatted timestamp string
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Format a log message with timestamp, level, and optional context
 * @param level - Log level
 * @param message - Log message
 * @param context - Additional context data
 * @returns Formatted log message
 */
function formatLogMessage(level: string, message: string, context?: Record<string, unknown>): string {
  const timestamp = getTimestamp();
  let logMessage = `[${timestamp}] [${level}] ${message}`;
  
  if (context) {
    try {
      const contextStr = JSON.stringify(context);
      logMessage += ` ${contextStr}`;
    } catch (error) {
      logMessage += ` [Context serialization failed: ${error.message}]`;
    }
  }
  
  return logMessage;
}

/**
 * Log a debug message
 * @param message - Log message
 * @param context - Additional context data
 */
export function debug(message: string, context?: Record<string, unknown>): void {
  if (currentLogLevel <= LogLevel.DEBUG) {
    const formattedMessage = formatLogMessage("DEBUG", message, context);
    console.debug(colors.gray(formattedMessage));
  }
}

/**
 * Log an info message
 * @param message - Log message
 * @param context - Additional context data
 */
export function info(message: string, context?: Record<string, unknown>): void {
  if (currentLogLevel <= LogLevel.INFO) {
    const formattedMessage = formatLogMessage("INFO", message, context);
    console.info(colors.blue(formattedMessage));
  }
}

/**
 * Log a warning message
 * @param message - Log message
 * @param context - Additional context data
 */
export function warn(message: string, context?: Record<string, unknown>): void {
  if (currentLogLevel <= LogLevel.WARN) {
    const formattedMessage = formatLogMessage("WARN", message, context);
    console.warn(colors.yellow(formattedMessage));
  }
}

/**
 * Log an error message
 * @param message - Log message
 * @param error - Error object
 * @param context - Additional context data
 */
export function error(message: string, error?: Error, context?: Record<string, unknown>): void {
  if (currentLogLevel <= LogLevel.ERROR) {
    const errorContext = {
      ...context,
      ...(error && {
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack,
      }),
    };
    
    const formattedMessage = formatLogMessage("ERROR", message, errorContext);
    console.error(colors.red(formattedMessage));
  }
}

/**
 * Log a fatal error message
 * @param message - Log message
 * @param error - Error object
 * @param context - Additional context data
 */
export function fatal(message: string, error?: Error, context?: Record<string, unknown>): void {
  if (currentLogLevel <= LogLevel.FATAL) {
    const errorContext = {
      ...context,
      ...(error && {
        errorName: error.name,
        errorMessage: error.message,
        stack: error.stack,
      }),
    };
    
    const formattedMessage = formatLogMessage("FATAL", message, errorContext);
    console.error(colors.bgRed(colors.white(formattedMessage)));
  }
}

/**
 * Log HTTP request details
 * @param method - HTTP method
 * @param url - Request URL
 * @param status - Response status code
 * @param responseTime - Response time in milliseconds
 */
export function httpRequest(method: string, url: string, status: number, responseTime: number): void {
  let statusColor = colors.green;
  
  if (status >= 400 && status < 500) {
    statusColor = colors.yellow;
  } else if (status >= 500) {
    statusColor = colors.red;
  }
  
  const formattedStatus = statusColor(`${status}`);
  const formattedMethod = colors.cyan(method.padEnd(7));
  const formattedTime = colors.magenta(`${responseTime}ms`);
  
  info(`${formattedMethod} ${url} ${formattedStatus} ${formattedTime}`);
}

// Export default logger object with all methods
export default {
  debug,
  info,
  warn,
  error,
  fatal,
  httpRequest,
}; 