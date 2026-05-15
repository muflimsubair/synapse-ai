import { Router, type IRouter } from "express";
import { eq, desc, count } from "drizzle-orm";
import { db, conversations, messages, documents, reports } from "@workspace/db";
import { RunResearchBody, WebSearchBody, DeleteReportParams, GetReportParams } from "@workspace/api-zod";
import { runResearchAgent } from "../../lib/agent";
import { tavilySearch } from "../../lib/search";

const router: IRouter = Router();

// Run research agent (SSE streaming)
router.post("/research/run", async (req, res): Promise<void> => {
  const parsed = RunResearchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { query, conversationId, documentIds, mode } = parsed.data;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    // Load document contexts if requested
    const documentContexts: string[] = [];
    if (documentIds && documentIds.length > 0) {
      for (const docId of documentIds) {
        const [doc] = await db.select().from(documents).where(eq(documents.id, docId));
        if (doc?.contentText) {
          documentContexts.push(`Document: ${doc.originalName}\n${doc.contentText.slice(0, 3000)}`);
        }
      }
    }

    const { report, sources } = await runResearchAgent({
      query,
      mode: mode ?? "quick",
      documentContexts,
      onStep: (step) => {
        res.write(`data: ${JSON.stringify(step)}\n\n`);
      },
    });

    // Save report to DB
    const title = query.length > 80 ? query.slice(0, 77) + "..." : query;
    const [savedReport] = await db
      .insert(reports)
      .values({
        title,
        query,
        content: report,
        sources,
        conversationId: conversationId ?? null,
      })
      .returning();

    res.write(`data: ${JSON.stringify({ type: "saved", reportId: savedReport.id })}\n\n`);
  } catch (err) {
    req.log.error({ err }, "Research agent error");
    res.write(`data: ${JSON.stringify({ type: "error", error: "Research failed" })}\n\n`);
  }

  res.end();
});

// Web search
router.post("/research/search", async (req, res): Promise<void> => {
  const parsed = WebSearchBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const result = await tavilySearch(parsed.data.query, parsed.data.maxResults ?? 5);
  res.json(result);
});

// List reports
router.get("/reports", async (_req, res): Promise<void> => {
  const rows = await db.select().from(reports).orderBy(desc(reports.createdAt));
  res.json(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      query: r.query,
      content: r.content,
      sources: r.sources,
      conversationId: r.conversationId,
      createdAt: r.createdAt,
    }))
  );
});

// Get report
router.get("/reports/:id", async (req, res): Promise<void> => {
  const params = GetReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [report] = await db.select().from(reports).where(eq(reports.id, params.data.id));
  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json({
    id: report.id,
    title: report.title,
    query: report.query,
    content: report.content,
    sources: report.sources,
    conversationId: report.conversationId,
    createdAt: report.createdAt,
  });
});

// Delete report
router.delete("/reports/:id", async (req, res): Promise<void> => {
  const params = DeleteReportParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(reports).where(eq(reports.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.sendStatus(204);
});

// Stats overview
router.get("/stats/overview", async (_req, res): Promise<void> => {
  const [[convCount], [msgCount], [docCount], [reportCount]] = await Promise.all([
    db.select({ count: count() }).from(conversations),
    db.select({ count: count() }).from(messages),
    db.select({ count: count() }).from(documents),
    db.select({ count: count() }).from(reports),
  ]);

  // Recent activity: last 8 across all entity types
  const [recentConvs, recentDocs, recentReports] = await Promise.all([
    db.select({ id: conversations.id, title: conversations.title, createdAt: conversations.createdAt })
      .from(conversations).orderBy(desc(conversations.createdAt)).limit(3),
    db.select({ id: documents.id, originalName: documents.originalName, createdAt: documents.createdAt })
      .from(documents).orderBy(desc(documents.createdAt)).limit(3),
    db.select({ id: reports.id, title: reports.title, createdAt: reports.createdAt })
      .from(reports).orderBy(desc(reports.createdAt)).limit(3),
  ]);

  const recentActivity = [
    ...recentConvs.map((c) => ({ type: "conversation", label: c.title, createdAt: c.createdAt })),
    ...recentDocs.map((d) => ({ type: "document", label: d.originalName, createdAt: d.createdAt })),
    ...recentReports.map((r) => ({ type: "report", label: r.title, createdAt: r.createdAt })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  res.json({
    totalConversations: convCount?.count ?? 0,
    totalMessages: msgCount?.count ?? 0,
    totalDocuments: docCount?.count ?? 0,
    totalReports: reportCount?.count ?? 0,
    recentActivity,
  });
});

export default router;
