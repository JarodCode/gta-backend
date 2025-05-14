// chat.ts - Chat routes
import { Router, Context } from "https://deno.land/x/oak@v17.1.4/mod.ts";
import { executeQueryAndReturnResults, executeQueryAndReturnId } from "../database.ts";

const router = new Router({ prefix: "/api/chat" });

// Get recent chat messages
router.get("/messages", async (ctx: Context) => {
  try {
    // Get last 50 messages
    const messages = executeQueryAndReturnResults<{
      id: number;
      user_id: number;
      username: string;
      content: string;
      created_at: string;
    }>(
      `SELECT m.id, m.user_id, u.username, m.content, m.created_at 
       FROM chat_messages m
       JOIN users u ON m.user_id = u.id
       ORDER BY m.created_at DESC
       LIMIT 50`
    );

    // Sort messages by created_at in ascending order
    messages.sort((a, b) => {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      data: messages,
    };
  } catch (err) {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      message: err.message || "Failed to get chat messages",
    };
  }
});

// Create a new chat message
router.post("/messages", async (ctx: Context) => {
  try {
    if (!ctx.request.hasBody) {
      throw new Error("Request body is missing");
    }

    const body = await ctx.request.body({ type: "json" }).value;
    const { content } = body;
    const user = ctx.state.user;

    if (!content || content.trim() === "") {
      throw new Error("Message content is required");
    }

    // Insert the message
    const messageId = executeQueryAndReturnId(
      "INSERT INTO chat_messages (user_id, content) VALUES (?, ?)",
      [user.id, content]
    );

    // Get the inserted message with username
    const messages = executeQueryAndReturnResults<{
      id: number;
      user_id: number;
      username: string;
      content: string;
      created_at: string;
    }>(
      `SELECT m.id, m.user_id, u.username, m.content, m.created_at 
       FROM chat_messages m
       JOIN users u ON m.user_id = u.id
       WHERE m.id = ?`,
      [messageId]
    );

    ctx.response.status = 201;
    ctx.response.body = {
      success: true,
      message: "Message created successfully",
      data: messages[0],
    };
  } catch (err) {
    ctx.response.status = 400;
    ctx.response.body = {
      success: false,
      message: err.message || "Failed to create message",
    };
  }
});

export const chatRouter = router;
