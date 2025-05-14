// logger.ts - Logging middleware
import { Context, Next } from "https://deno.land/x/oak@v17.1.4/mod.ts";

export async function loggerMiddleware(ctx: Context, next: Next) {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  const status = ctx.response.status;
  const method = ctx.request.method;
  const url = ctx.request.url.pathname;
  
  // Log format: [TIMESTAMP] METHOD URL STATUS - RESPONSE_TIME ms
  console.log(`[${new Date().toISOString()}] ${method} ${url} ${status} - ${ms}ms`);
}