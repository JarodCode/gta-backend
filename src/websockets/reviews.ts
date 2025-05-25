// reviews.ts - WebSockets setup for real-time review notifications
import { Application } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { verify, Payload } from "https://deno.land/x/djwt@v3.0.0/mod.ts";
import { getJwtSecret } from "../routes/auth.ts";

// Store active WebSocket connections
const reviewClients = new Map<string, WebSocket>();

interface ReviewNotification {
  type: string;
  gameId: string;
  review: {
    id: string;
    userId: number;
    username: string;
    rating: number;
    content: string;
    createdAt: string;
  };
}

// Extend the JWT payload interface
interface JwtPayload extends Payload {
  user_id: number;
  username: string;
}

export function setupReviewWebsockets(app: Application) {
  // Setup WebSocket server for review notifications
  app.use(async (ctx, next) => {
    if (ctx.request.url.pathname === "/ws/reviews") {
      if (!ctx.isUpgradable) {
        ctx.throw(501);
        return;
      }

      // Get token from query param (optional - we can allow anonymous connections for notifications)
      const token = ctx.request.url.searchParams.get("token");
      let userId: number | null = null;
      let username: string | null = null;

      if (token) {
        try {
          // Verify JWT token if provided
          const key = await getJwtSecret();
          const keyData = new TextEncoder().encode(key);
          const cryptoKey = await crypto.subtle.importKey(
            "raw",
            keyData,
            { name: "HMAC", hash: "SHA-256" },
            true,
            ["verify"]
          );
          
          const payload = await verify(token, cryptoKey);
          // Type assertion with unknown intermediate step to avoid direct casting
          const jwtPayload = payload as unknown as JwtPayload;
          userId = jwtPayload.user_id;
          username = jwtPayload.username;
          console.log(`Authenticated WebSocket connection for user: ${username}`);
        } catch (err) {
          console.warn("Invalid token provided for WebSocket connection:", err);
          // Continue without authentication - still allow connection for notifications
        }
      }

      try {
        // Upgrade connection to WebSocket
        const ws = await ctx.upgrade();
        const clientId = crypto.randomUUID();

        console.log(`New review notification WebSocket connection: ${clientId}`);

        // Store client connection
        reviewClients.set(clientId, ws);

        // Send welcome message safely
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "system",
              message: "Connected to review notification system",
              timestamp: new Date().toISOString()
            }));
          }
        } catch (error) {
          console.error("Error sending welcome message:", error);
        }

        // Handle client disconnection
        ws.onclose = () => {
          // Remove client from active connections
          reviewClients.delete(clientId);
          console.log(`WebSocket client disconnected: ${clientId}`);
        };

        // Handle errors
        ws.onerror = (event) => {
          console.error(`WebSocket error for client ${clientId}:`, event);
          reviewClients.delete(clientId);
        };
      } catch (error) {
        console.error("Error upgrading to WebSocket:", error);
      }

      return;
    }

    await next();
  });
}

// Broadcast review notification to all connected clients
export function broadcastReviewNotification(notification: ReviewNotification) {
  const messageString = JSON.stringify(notification);
  console.log(`Broadcasting review notification to ${reviewClients.size} clients`);
  
  // Keep track of clients to remove (those with closed connections)
  const clientsToRemove: string[] = [];
  
  for (const [clientId, client] of reviewClients.entries()) {
    try {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      } else if (client.readyState === WebSocket.CLOSED || client.readyState === WebSocket.CLOSING) {
        // Mark for removal if connection is closed or closing
        clientsToRemove.push(clientId);
      }
    } catch (error) {
      console.error(`Error sending message to client ${clientId}:`, error);
      clientsToRemove.push(clientId);
    }
  }
  
  // Clean up closed connections
  for (const clientId of clientsToRemove) {
    reviewClients.delete(clientId);
    console.log(`Removed closed WebSocket client: ${clientId}`);
  }
} 