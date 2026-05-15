import { logger } from "./logger";

export interface SearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

export interface SearchResponse {
  results: SearchResult[];
  query: string;
}

export async function tavilySearch(query: string, maxResults = 5): Promise<SearchResponse> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY is not configured");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error({ status: response.status, body: text }, "Tavily search failed");
    throw new Error(`Tavily search failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    results?: Array<{ title: string; url: string; content: string; score?: number }>;
  };

  return {
    query,
    results: (data.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      content: r.content,
      score: r.score,
    })),
  };
}
