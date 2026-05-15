import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, documents } from "@workspace/db";
import {
  GetDocumentParams,
  DeleteDocumentParams,
  UploadDocumentBody,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../../lib/logger";

const router: IRouter = Router();

// List documents
router.get("/documents", async (_req, res): Promise<void> => {
  const rows = await db.select().from(documents).orderBy(desc(documents.createdAt));
  res.json(
    rows.map((d) => ({
      id: d.id,
      filename: d.filename,
      originalName: d.originalName,
      size: d.size,
      status: d.status,
      pageCount: d.pageCount,
      summary: d.summary,
      createdAt: d.createdAt,
    }))
  );
});

// Get document
router.get("/documents/:id", async (req, res): Promise<void> => {
  const params = GetDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [doc] = await db.select().from(documents).where(eq(documents.id, params.data.id));
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json({
    id: doc.id,
    filename: doc.filename,
    originalName: doc.originalName,
    size: doc.size,
    status: doc.status,
    pageCount: doc.pageCount,
    summary: doc.summary,
    createdAt: doc.createdAt,
  });
});

// Upload document (base64 encoded PDF content)
router.post("/documents/upload", async (req, res): Promise<void> => {
  const parsed = UploadDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { filename, originalName, contentBase64 } = parsed.data;
  const buffer = Buffer.from(contentBase64, "base64");
  const size = buffer.length;

  // Insert document as processing
  const [doc] = await db
    .insert(documents)
    .values({ filename, originalName, size, status: "processing" })
    .returning();

  res.status(201).json({
    id: doc.id,
    filename: doc.filename,
    originalName: doc.originalName,
    size: doc.size,
    status: doc.status,
    pageCount: doc.pageCount,
    summary: doc.summary,
    createdAt: doc.createdAt,
  });

  // Process asynchronously
  setImmediate(async () => {
    try {
      let extractedText = "";
      let pageCount: number | null = null;

      // Extract text from PDF
      try {
        const pdfParse = (await import("pdf-parse")).default;
        const pdfData = await pdfParse(buffer);
        extractedText = pdfData.text;
        pageCount = pdfData.numpages;
      } catch (e) {
        logger.warn({ e }, "PDF parsing failed, storing without text");
        extractedText = "(Could not extract text from PDF)";
      }

      // Generate AI summary
      let summary: string | null = null;
      try {
        const summaryResp = await openai.chat.completions.create({
          model: "gpt-5-mini",
          max_completion_tokens: 512,
          messages: [
            {
              role: "system",
              content: "Summarize the following document in 3-5 sentences. Be concise and factual.",
            },
            {
              role: "user",
              content: extractedText.slice(0, 8000),
            },
          ],
        });
        summary = summaryResp.choices[0]?.message?.content ?? null;
      } catch (e) {
        logger.warn({ e }, "Summary generation failed");
      }

      await db
        .update(documents)
        .set({
          status: "ready",
          pageCount,
          summary,
          contentText: extractedText.slice(0, 50000),
        })
        .where(eq(documents.id, doc.id));
    } catch (err) {
      logger.error({ err, docId: doc.id }, "Document processing failed");
      await db.update(documents).set({ status: "error" }).where(eq(documents.id, doc.id));
    }
  });
});

// Delete document
router.delete("/documents/:id", async (req, res): Promise<void> => {
  const params = DeleteDocumentParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(documents).where(eq(documents.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
