import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Zap, Brain, ChevronDown, Check, FileText, Loader2,
  Globe, BookOpen, Lightbulb, PenLine, CheckCircle, AlertCircle
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useListDocuments, getListReportsQueryKey, getGetStatsOverviewQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";

type Mode = "quick" | "deep";
type StepType = "thinking" | "searching" | "search_results" | "writing" | "content" | "done" | "saved" | "error";

interface Step {
  type: StepType;
  content?: string;
  query?: string;
  results?: Array<{ title: string; url: string; content: string }>;
  report?: string;
  sources?: string[];
  reportId?: number;
  error?: string;
}

const stepIcon: Partial<Record<StepType, typeof Search>> = {
  thinking: Lightbulb,
  searching: Globe,
  search_results: BookOpen,
  writing: PenLine,
  done: CheckCircle,
};

export default function ResearchPage() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("quick");
  const [selectedDocs, setSelectedDocs] = useState<number[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [report, setReport] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const { data: documents } = useListDocuments();

  const runResearch = async () => {
    if (!query.trim() || running) return;
    setSteps([]);
    setReport("");
    setSources([]);
    setDone(false);
    setRunning(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const res = await fetch("/api/research/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          mode,
          documentIds: selectedDocs.length > 0 ? selectedDocs : undefined,
        }),
        signal: ctrl.signal,
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done: readerDone, value } = await reader.read();
          if (readerDone) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const parsed = JSON.parse(line.slice(6)) as Step;
              if (parsed.type === "content") {
                setReport((prev) => prev + (parsed.content ?? ""));
              } else if (parsed.type === "done") {
                setSources(parsed.sources ?? []);
                setDone(true);
              } else if (parsed.type === "saved") {
                qc.invalidateQueries({ queryKey: getListReportsQueryKey() });
                qc.invalidateQueries({ queryKey: getGetStatsOverviewQueryKey() });
              } else {
                setSteps((prev) => [...prev, parsed]);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setSteps((prev) => [...prev, { type: "error", error: "Research failed. Please try again." }]);
      }
    } finally {
      setRunning(false);
    }
  };

  const toggleDoc = (id: number) => {
    setSelectedDocs((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: config panel */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-border bg-sidebar overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-sm">Research Agent</h2>
          <p className="text-xs text-muted-foreground mt-0.5">AI-powered multi-step research</p>
        </div>

        <div className="p-4 space-y-5 flex-1">
          {/* Query */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Research Query</label>
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What would you like to research?"
              rows={3}
              className="resize-none text-sm bg-background"
              data-testid="input-research-query"
            />
          </div>

          {/* Mode */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Research Mode</label>
            <div className="grid grid-cols-2 gap-2">
              {(["quick", "deep"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  data-testid={`button-mode-${m}`}
                  className={cn(
                    "flex flex-col items-start px-3 py-2.5 rounded-lg border text-left transition-all",
                    mode === m
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border hover:border-primary/30 text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m === "quick" ? <Zap size={14} className="mb-1" /> : <Brain size={14} className="mb-1" />}
                  <span className="text-xs font-medium capitalize">{m}</span>
                  <span className="text-[10px] opacity-70 mt-0.5">
                    {m === "quick" ? "Single search" : "Multi-query deep dive"}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Documents */}
          {documents && documents.length > 0 && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">
                Include Documents ({selectedDocs.length} selected)
              </label>
              <div className="space-y-1.5">
                {documents.filter((d) => d.status === "ready").map((doc) => (
                  <button
                    key={doc.id}
                    onClick={() => toggleDoc(doc.id)}
                    data-testid={`button-doc-${doc.id}`}
                    className={cn(
                      "flex items-center gap-2 w-full px-2.5 py-2 rounded-lg border text-left transition-all text-xs",
                      selectedDocs.includes(doc.id)
                        ? "border-primary/50 bg-primary/10"
                        : "border-border hover:border-primary/30"
                    )}
                  >
                    <div className={cn(
                      "w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors",
                      selectedDocs.includes(doc.id) ? "bg-primary border-primary" : "border-border"
                    )}>
                      {selectedDocs.includes(doc.id) && <Check size={10} className="text-white" />}
                    </div>
                    <FileText size={12} className="flex-shrink-0 text-muted-foreground" />
                    <span className="truncate">{doc.originalName}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border">
          <Button
            onClick={runResearch}
            disabled={!query.trim() || running}
            className="w-full gap-2"
            data-testid="button-run-research"
          >
            {running ? (
              <><Loader2 size={14} className="animate-spin" />Running...</>
            ) : (
              <><Search size={14} />Run Research</>
            )}
          </Button>
        </div>
      </div>

      {/* Right: output */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Agent steps */}
        {steps.length > 0 && (
          <div className="border-b border-border px-6 py-3 bg-muted/20 max-h-48 overflow-y-auto">
            <div className="space-y-1.5">
              <AnimatePresence>
                {steps.map((step, i) => {
                  const Icon = stepIcon[step.type] ?? Lightbulb;
                  if (step.type === "error") {
                    return (
                      <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 text-destructive text-xs">
                        <AlertCircle size={13} />
                        {step.error}
                      </motion.div>
                    );
                  }
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon size={13} className="text-primary flex-shrink-0" />
                      {step.type === "thinking" && <span>{step.content}</span>}
                      {step.type === "searching" && <span>Searching: <em className="text-foreground">{step.query}</em></span>}
                      {step.type === "search_results" && <span>Found {step.results?.length ?? 0} results</span>}
                      {step.type === "writing" && <span>{step.content}</span>}
                      {step.type === "done" && <span className="text-emerald-400">Research complete</span>}
                    </motion.div>
                  );
                })}
                {running && !done && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 size={13} className="animate-spin text-primary" />
                    Processing...
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* Report / empty state */}
        <div className="flex-1 overflow-y-auto p-6">
          {!report && !running && steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Search size={28} className="text-primary" />
              </div>
              <h2 className="text-lg font-semibold mb-2">Ready to research</h2>
              <p className="text-muted-foreground text-sm max-w-sm">
                Enter a research query and choose your mode. The agent will search the web, synthesize findings, and generate a structured report.
              </p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {report && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Markdown content={report} streaming={running && !done} className="prose-base" />
                </motion.div>
              )}

              {done && sources.length > 0 && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                  className="mt-8 p-4 rounded-xl border border-border bg-muted/30">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sources</h3>
                  <div className="space-y-1.5">
                    {sources.map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors truncate">
                        <Globe size={11} className="flex-shrink-0" />
                        {src}
                      </a>
                    ))}
                  </div>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
