import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { conversations } from "./conversations";

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  query: text("query").notNull(),
  content: text("content").notNull(),
  sources: text("sources").array().notNull().default([]),
  conversationId: integer("conversation_id").references(() => conversations.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = z.infer<typeof insertReportSchema>;
