import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, conversations, messages } from "@workspace/db";
import {
  CreateOpenaiConversationBody,
  GetOpenaiConversationParams,
  DeleteOpenaiConversationParams,
  ListOpenaiMessagesParams,
  SendOpenaiMessageParams,
  SendOpenaiMessageBody,
} from "@workspace/api-zod";
import { streamChatResponse } from "../../lib/agent";

const router: IRouter = Router();

// List conversations
router.get("/openai/conversations", async (req, res): Promise<void> => {
  const rows = await db.select().from(conversations).orderBy(desc(conversations.updatedAt));
  res.json(rows.map((c) => ({ id: c.id, title: c.title, createdAt: c.createdAt, updatedAt: c.updatedAt })));
});

// Create conversation
router.post("/openai/conversations", async (req, res): Promise<void> => {
  const parsed = CreateOpenaiConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [conv] = await db.insert(conversations).values({ title: parsed.data.title }).returning();
  res.status(201).json({ id: conv.id, title: conv.title, createdAt: conv.createdAt, updatedAt: conv.updatedAt });
});

// Get conversation with messages
router.get("/openai/conversations/:id", async (req, res): Promise<void> => {
  const params = GetOpenaiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, params.data.id));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  const msgs = await db.select().from(messages).where(eq(messages.conversationId, conv.id)).orderBy(messages.createdAt);
  res.json({
    id: conv.id,
    title: conv.title,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    messages: msgs,
  });
});

// Delete conversation
router.delete("/openai/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteOpenaiConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(conversations).where(eq(conversations.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  res.sendStatus(204);
});

// List messages
router.get("/openai/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = ListOpenaiMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, params.data.id))
    .orderBy(messages.createdAt);
  res.json(msgs);
});

// Send message (SSE streaming)
router.post("/openai/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = SendOpenaiMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = SendOpenaiMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const convId = params.data.id;
  const [conv] = await db.select().from(conversations).where(eq(conversations.id, convId));
  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  // Save user message
  await db.insert(messages).values({ conversationId: convId, role: "user", content: body.data.content });

  // Get full history
  const history = await db.select().from(messages).where(eq(messages.conversationId, convId)).orderBy(messages.createdAt);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  try {
    fullResponse = await streamChatResponse({
      messages: history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      useWebSearch: body.data.useWebSearch ?? false,
      onContent: (content) => {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      },
    });

    // Save assistant message
    await db.insert(messages).values({ conversationId: convId, role: "assistant", content: fullResponse });

    // Update conversation timestamp
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, convId));

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    req.log.error({ err }, "Chat streaming error");
    res.write(`data: ${JSON.stringify({ error: "AI response failed" })}\n\n`);
  }
  res.end();
});

export default router;
