import { openai } from "@workspace/integrations-openai-ai-server";
import { tavilySearch } from "./search";
import { logger } from "./logger";

export type AgentStep =
  | { type: "thinking"; content: string }
  | { type: "searching"; query: string }
  | { type: "search_results"; results: Array<{ title: string; url: string; content: string }> }
  | { type: "writing"; content: string }
  | { type: "content"; content: string }
  | { type: "done"; report: string; sources: string[] };

export interface RunResearchOptions {
  query: string;
  mode?: "quick" | "deep";
  documentContexts?: string[];
  onStep: (step: AgentStep) => void;
}

export async function runResearchAgent(opts: RunResearchOptions): Promise<{ report: string; sources: string[] }> {
  const { query, mode = "quick", documentContexts = [], onStep } = opts;

  onStep({ type: "thinking", content: "Planning research approach..." });

  const searchQueries: string[] = [];
  const allSources: string[] = [];
  let contextBlocks = "";

  if (mode === "deep") {
    // Planner step: generate sub-queries
    const plannerResp = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 512,
      messages: [
        {
          role: "system",
          content:
            "You are a research planner. Given a research query, output 2-3 specific web search queries that together would comprehensively answer the main query. Output ONLY a JSON array of strings like: [\"query1\", \"query2\", \"query3\"]. No other text.",
        },
        { role: "user", content: query },
      ],
    });
    const raw = plannerResp.choices[0]?.message?.content ?? "[]";
    try {
      const parsed = JSON.parse(raw.trim()) as string[];
      searchQueries.push(...parsed);
    } catch {
      searchQueries.push(query);
    }
  } else {
    searchQueries.push(query);
  }

  // Research step: run searches
  for (const sq of searchQueries) {
    onStep({ type: "searching", query: sq });
    try {
      const { results } = await tavilySearch(sq, mode === "deep" ? 6 : 4);
      onStep({ type: "search_results", results });
      for (const r of results) {
        if (!allSources.includes(r.url)) {
          allSources.push(r.url);
          contextBlocks += `\n\n### Source: ${r.title}\nURL: ${r.url}\n${r.content.slice(0, 800)}`;
        }
      }
    } catch (err) {
      logger.warn({ err, sq }, "Search failed, continuing without results");
    }
  }

  // Add document contexts if provided
  if (documentContexts.length > 0) {
    contextBlocks += "\n\n### Uploaded Documents:\n" + documentContexts.join("\n\n---\n\n");
  }

  onStep({ type: "writing", content: "Synthesizing research into a structured report..." });

  // Summarizer / writer step
  const systemPrompt = `You are an expert research analyst. Write a comprehensive, well-structured research report answering the user's query.

Format your report in Markdown with:
- An executive summary
- Key findings with headers
- Analysis and insights
- Conclusion

Base your report on the provided sources. Be specific, cite facts, and be concise but thorough.`;

  const userPrompt = `Research Query: ${query}

Sources and Context:${contextBlocks || "\n\nNo external sources available. Use your knowledge."}

Write a comprehensive research report.`;

  let fullReport = "";
  const stream = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullReport += content;
      onStep({ type: "content", content });
    }
  }

  onStep({ type: "done", report: fullReport, sources: allSources });
  return { report: fullReport, sources: allSources };
}

export interface ChatOptions {
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  useWebSearch?: boolean;
  onContent: (content: string) => void;
}

export async function streamChatResponse(opts: ChatOptions): Promise<string> {
  const { messages, useWebSearch = false, onContent } = opts;

  let contextBlock = "";
  if (useWebSearch) {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMsg) {
      try {
        const { results } = await tavilySearch(lastUserMsg.content, 4);
        if (results.length > 0) {
          contextBlock =
            "\n\n[Web Search Results]\n" +
            results.map((r) => `- ${r.title}: ${r.content.slice(0, 400)}\n  Source: ${r.url}`).join("\n\n");
        }
      } catch {
        logger.warn("Web search failed for chat");
      }
    }
  }

  const systemMsg: { role: "system"; content: string } = {
    role: "system",
    content: `You are an expert AI research assistant. You help users research topics, analyze documents, and generate insights. Be helpful, precise, and well-organized. Use Markdown for formatting when appropriate.${contextBlock ? "\n\nUse these web search results to inform your response:" + contextBlock : ""}`,
  };

  const allMessages = [systemMsg, ...messages];
  let fullContent = "";

  const stream = await openai.chat.completions.create({
    model: "gpt-5.1",
    max_completion_tokens: 4096,
    messages: allMessages,
    stream: true,
  });

  for await (const chunk of stream) {
    const content = chunk.choices[0]?.delta?.content;
    if (content) {
      fullContent += content;
      onContent(content);
    }
  }

  return fullContent;
}
