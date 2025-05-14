// chat.ts - WebSockets setup for real-time chat
import { Application, isHttpError } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { verify } from "https://deno.land/x/djwt/mod.ts";
import { getJwtSecret } from "../routes/auth.ts";
import { executeQueryAndReturnId } from "../database.ts";

// Store active WebSocket connections
const chatClients = new Map<string, WebSocket>();

interface ChatMessage {
  type: string;
  userId: number;
  username: string;
  content: string;
  timestamp: string;
}

export function setupWebsockets(app: Application) {
  // Setup WebSocket server for chat
  app.use(async (ctx, next) => {
    if (ctx.request.url.pathname === "/ws/chat") {
      if (!ctx.isUpgradable) {
        ctx.throw(501);
        return;
      }

      // Get token from query param
      const token = ctx.request.url.searchParams.get("token");
      if (!token) {
        ctx.throw(401, "Authentication token required");
        return;
      }

      let userId: number;
      let username: string;

      try {
        // Verify JWT token
        const payload = await verify(token, await getJwtSecret());
        userId = payload.id;
        username = payload.username;
      } catch (err) {
        ctx.throw(401, "Invalid token");
        return;
      }

      // Upgrade connection to WebSocket
      const ws = await ctx.upgrade();
      const clientId = crypto.randomUUID();

      // Store client connection
      chatClients.set(clientId, ws);

      // Send welcome message
      ws.send(JSON.stringify({
        type: "system",
        content: "Welcome to the chat!",
        timestamp: new Date().toISOString()
      }));

      // Broadcast user joined message
      broadcastMessage({
        type: "system",
        userId: 0,
        username: "System",
        content: `${username} has joined the chat`,
        timestamp: new Date().toISOString()
      });

      // Handle incoming messages
      ws.onmessage = async (e) => {
        try {
          const data = JSON.parse(e.data);
          
          if (data.type === "message" && data.content) {
            // Store message in database
            const messageId = executeQueryAndReturnId(
              "INSERT INTO chat_messages (user_id, content) VALUES (?, ?)",
              [userId, data.content]
            );

            // Broadcast message to all clients
            broadcastMessage({
              type: "message",
              userId,
              username,
              content: data.content,
              timestamp: new Date().toISOString()
            });
          }
        } catch (err) {
          console.error("Error processing WebSocket message:", err);
        }
      };

      // Handle client disconnection
      ws.onclose = () => {
        // Remove client from active connections
        chatClients.delete(clientId);
        
        // Broadcast user left message
        broadcastMessage({
          type: "system",
          userId: 0,
          username: "System",
          content: `${username} has left the chat`,
          timestamp: new Date().toISOString()
        });
      };

      return;
    }

    await next();
  });
}

// Broadcast message to all connected clients
function broadcastMessage(message: ChatMessage) {
  const messageString = JSON.stringify(message);
  
  for (const client of chatClients.values()) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageString);
    }
  }
}
