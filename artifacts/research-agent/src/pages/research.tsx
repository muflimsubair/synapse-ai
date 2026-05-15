import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Zap, Brain, Check, FileText, Loader2,
  Globe, BookOpen, Lightbulb, PenLine, CheckCircle,
  AlertCircle, Sparkles, BarChart2, X, Layers, ChevronDown
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
  sources?: string[];
  reportId?: number;
  error?: string;
}

const STEP_DISPLAY: Record<string, { icon: typeof Search; label: string }> = {
  thinking:       { icon: Lightbulb,   label: "Planning research..." },
  searching:      { icon: Globe,       label: "Searching web..." },
  search_results: { icon: BookOpen,    label: "Reading documents..." },
  writing:        { icon: PenLine,     label: "Synthesizing findings..." },
  done:           { icon: CheckCircle, label: "Generating report..." },
};

const SUGGESTED_PROMPTS = [
  { icon: Brain,     label: "Summarize",      query: "Summarize this document and highlight the main points" },
  { icon: Sparkles,  label: "Key insights",   query: "Extract the key insights and important findings from this document" },
  { icon: BarChart2, label: "Full report",    query: "Generate a comprehensive research report based on this document" },
  { icon: Search,    label: "Analyze topics", query: "Identify and analyze the main topics, skills, and themes in this document" },
  { icon: Globe,     label: "Web comparison", query: "Compare the content of this document with current web research on the same topic" },
];

const MODE_CONFIG = {
  quick: {
    icon: Zap,
    label: "Quick",
    badge: null as string | null,
    desc: "Single targeted search, results in ~10s",
    detail: null as string[] | null,
  },
  deep: {
    icon: Layers,
    label: "Deep Research",
    badge: "Recommended",
    desc: "Multi-query, source comparison, long-form report",
    detail: [
      "Multiple parallel web searches",
      "Source credibility scoring",
      "Conflict resolution across sources",
      "Long-form structured report saved to library",
    ],
  },
};

const PIPELINE_STAGES = [
  { key: "plan",       label: "Planning",     icon: Lightbulb },
  { key: "search",     label: "Searching",    icon: Globe     },
  { key: "read",       label: "Reading",      icon: BookOpen  },
  { key: "synthesize", label: "Synthesizing", icon: BarChart2 },
  { key: "generate",   label: "Generating",   icon: PenLine   },
];

const STEP_TO_STAGE: Partial<Record<StepType, number>> = {
  thinking:       0,
  searching:      1,
  search_results: 2,
  writing:        3,
  content:        4,
  done:           4,
  saved:          4,
};

function PipelineBar({ steps, running, done }: { steps: Step[]; running: boolean; done: boolean }) {
  const lastStep = steps[steps.length - 1];
  const activeStage = done ? 5 : (running && lastStep ? (STEP_TO_STAGE[lastStep.type] ?? 0) : -1);

  return (
    <div className="flex items-center gap-0 px-6 py-3 border-b border-border bg-muted/20">
      {PIPELINE_STAGES.map((stage, i) => {
        const complete = activeStage > i || done;
        const active = activeStage === i && running && !done;
        const Icon = stage.icon;
        return (
          <div key={stage.key} className="flex items-center">
            <motion.div
              animate={active ? { opacity: [1, 0.5, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all",
                complete && "text-emerald-400",
                active && "text-primary bg-primary/10",
                !complete && !active && "text-muted-foreground/40"
              )}
            >
              {complete ? (
                <CheckCircle size={11} className="text-emerald-400" />
              ) : active ? (
                <div className="w-2.5 h-2.5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              ) : (
                <Icon size={11} />
              )}
              <span className="hidden sm:inline">{stage.label}</span>
            </motion.div>
            {i < PIPELINE_STAGES.length - 1 && (
              <div className={cn("w-4 h-px mx-0.5 transition-colors", complete ? "bg-emerald-400/40" : "bg-border")} />
            )}
          </div>
        );
      })}
      {done && (
        <motion.div
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium"
        >
          <CheckCircle size={11} />
          Report saved
        </motion.div>
      )}
      {running && !done && (
        <div className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Loader2 size={10} className="animate-spin" />
          {lastStep && STEP_DISPLAY[lastStep.type]?.label}
        </div>
      )}
    </div>
  );
}

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    docId: params.get("docId") ? parseInt(params.get("docId")!) : null,
    query: params.get("query") ?? "",
  };
}

export default function ResearchPage() {
  const qc = useQueryClient();
  const { docId: initialDocId, query: initialQuery } = getUrlParams();

  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<Mode>("quick");
  const [selectedDocs, setSelectedDocs] = useState<number[]>(initialDocId ? [initialDocId] : []);
  const [steps, setSteps] = useState<Step[]>([]);
  const [report, setReport] = useState("");
  const [sources, setSources] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [fromDoc, setFromDoc] = useState<number | null>(initialDocId);
  const [deepExpanded, setDeepExpanded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const { data: documents } = useListDocuments();

  useEffect(() => {
    if (initialDocId && documents) {
      const found = documents.find((d) => d.id === initialDocId);
      if (found) setSelectedDocs([initialDocId]);
    }
  }, [documents, initialDocId]);

  useEffect(() => {
    if (fromDoc && !selectedDocs.includes(fromDoc)) setFromDoc(null);
  }, [selectedDocs, fromDoc]);

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

  const toggleDoc = (id: number) =>
    setSelectedDocs((prev) => prev.includes(id) ? prev.filter((d) => d !== id) : [...prev, id]);

  const fromDocName = fromDoc ? documents?.find((d) => d.id === fromDoc)?.originalName : null;
  const showPipeline = running || (done && steps.length > 0);

  return (
    <div className="flex h-full overflow-hidden">

      {/* ── Left config panel ─────────────────────────────────── */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-border bg-sidebar overflow-y-auto">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-sm">Research Agent</h2>
          <p className="text-xs text-muted-foreground mt-0.5">AI-powered multi-step research</p>
        </div>

        <div className="p-4 space-y-5 flex-1">

          {/* From-document context banner */}
          <AnimatePresence>
            {fromDocName && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                className="flex items-start gap-2.5 px-3 py-2.5 rounded-lg bg-primary/10 border border-primary/25"
              >
                <FileText size={14} className="text-primary flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-primary">Document loaded</p>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{fromDocName}</p>
                </div>
                <button
                  onClick={() => { setFromDoc(null); setSelectedDocs([]); }}
                  className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  data-testid="button-clear-doc-context"
                >
                  <X size={13} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

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

          {/* Suggested prompts when doc loaded */}
          <AnimatePresence>
            {fromDoc && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <label className="text-xs font-medium text-muted-foreground mb-2 block">Suggested actions</label>
                <div className="space-y-1">
                  {SUGGESTED_PROMPTS.map(({ icon: Icon, label, query: q }) => (
                    <motion.button
                      key={label}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setQuery(q)}
                      data-testid={`button-prompt-${label.toLowerCase().replace(/\s+/g, "-")}`}
                      className={cn(
                        "flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left transition-all group",
                        query === q
                          ? "bg-primary/15 border border-primary/30"
                          : "hover:bg-muted/60 border border-transparent"
                      )}
                    >
                      <Icon size={13} className={cn(
                        "flex-shrink-0 transition-colors",
                        query === q ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                      )} />
                      <span className={cn(
                        "text-xs transition-colors",
                        query === q ? "text-primary font-medium" : "text-muted-foreground group-hover:text-foreground"
                      )}>{label}</span>
                      {query === q && <Check size={11} className="text-primary ml-auto" />}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mode selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-2 block">Research Mode</label>
            <div className="space-y-2">
              {(["quick", "deep"] as Mode[]).map((m) => {
                const cfg = MODE_CONFIG[m];
                const Icon = cfg.icon;
                const isSelected = mode === m;
                const isDeep = m === "deep";
                return (
                  <div key={m}>
                    <button
                      onClick={() => { setMode(m); if (isDeep) setDeepExpanded(true); }}
                      data-testid={`button-mode-${m}`}
                      className={cn(
                        "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg border text-left transition-all",
                        isSelected
                          ? "border-primary/50 bg-primary/10"
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                        isSelected ? "bg-primary/20" : "bg-muted"
                      )}>
                        <Icon size={14} className={isSelected ? "text-primary" : "text-muted-foreground"} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs font-semibold", isSelected ? "text-primary" : "text-foreground/80")}>{cfg.label}</span>
                          {cfg.badge && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/25">
                              {cfg.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{cfg.desc}</p>
                      </div>
                      {isDeep && isSelected && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeepExpanded((v) => !v); }}
                          className="text-muted-foreground/60 hover:text-muted-foreground transition-colors flex-shrink-0"
                        >
                          <ChevronDown size={13} className={cn("transition-transform", deepExpanded && "rotate-180")} />
                        </button>
                      )}
                    </button>

                    <AnimatePresence>
                      {isDeep && isSelected && deepExpanded && cfg.detail && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-1.5 ml-3 pl-3 border-l-2 border-primary/20 space-y-1.5 py-1">
                            {cfg.detail.map((d) => (
                              <div key={d} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                <div className="w-1 h-1 rounded-full bg-primary/60 flex-shrink-0" />
                                {d}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Document selector */}
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

        <div className="p-4 border-t border-border space-y-2">
          <Button
            onClick={runResearch}
            disabled={!query.trim() || running}
            className="w-full gap-2"
            data-testid="button-run-research"
          >
            {running ? (
              <><Loader2 size={14} className="animate-spin" />Running...</>
            ) : mode === "deep" ? (
              <><Layers size={14} />Run Deep Research</>
            ) : (
              <><Search size={14} />Run Research</>
            )}
          </Button>
          {mode === "deep" && !running && (
            <p className="text-[10px] text-center text-muted-foreground">
              Deep mode runs multiple searches and may take 30–60s
            </p>
          )}
        </div>
      </div>

      {/* ── Right: output ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Animated pipeline status bar */}
        <AnimatePresence>
          {showPipeline && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <PipelineBar steps={steps} running={running} done={done} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Step log */}
        <AnimatePresence>
          {steps.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-border bg-muted/10 overflow-hidden max-h-36 overflow-y-auto"
            >
              <div className="px-6 py-2.5 space-y-1.5">
                <AnimatePresence initial={false}>
                  {steps.map((step, i) => {
                    const cfg = STEP_DISPLAY[step.type];
                    if (!cfg && step.type !== "error") return null;
                    const Icon = cfg?.icon ?? AlertCircle;
                    const isLast = i === steps.length - 1;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 text-xs"
                      >
                        {step.type === "error" ? (
                          <AlertCircle size={12} className="text-destructive flex-shrink-0" />
                        ) : isLast && running && !done ? (
                          <div className="w-3 h-3 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                        ) : (
                          <CheckCircle size={12} className="text-emerald-400/70 flex-shrink-0" />
                        )}
                        <Icon size={12} className={isLast && running && !done ? "text-primary" : "text-muted-foreground/60"} />
                        <span className={cn("font-mono", isLast && running && !done ? "text-primary" : "text-muted-foreground/60",
                          step.type === "error" && "text-destructive")}>
                          {step.type === "thinking" && step.content}
                          {step.type === "searching" && <>Searching: <em className="not-italic text-foreground/80">{step.query}</em></>}
                          {step.type === "search_results" && <>Read {step.results?.length ?? 0} results</>}
                          {step.type === "writing" && step.content}
                          {step.type === "done" && "Research complete — generating report"}
                          {step.type === "error" && step.error}
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main report area */}
        <div className="flex-1 overflow-y-auto p-6">
          {!report && !running && steps.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              {fromDocName ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <FileText size={28} className="text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold mb-2">Document ready for research</h2>
                  <p className="text-muted-foreground text-sm max-w-sm mb-6">
                    Select a suggested action on the left or write your own query, then run the agent.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center max-w-md">
                    {SUGGESTED_PROMPTS.map(({ icon: Icon, label, query: q }) => (
                      <button
                        key={label}
                        onClick={() => setQuery(q)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card hover:border-primary/40 hover:bg-primary/5 transition-all text-xs text-muted-foreground hover:text-foreground"
                        data-testid={`chip-${label.toLowerCase().replace(/\s+/g, "-")}`}
                      >
                        <Icon size={11} />{label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                    <Search size={28} className="text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold mb-2">Ready to research</h2>
                  <p className="text-muted-foreground text-sm max-w-sm mb-6">
                    Enter a query, choose Quick or Deep Research mode, then run the agent.
                  </p>
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="flex items-start gap-3 px-4 py-3 rounded-xl border border-primary/20 bg-primary/5 text-left max-w-sm"
                  >
                    <Layers size={18} className="text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-semibold text-primary mb-0.5">Try Deep Research Mode</p>
                      <p className="text-[11px] text-muted-foreground leading-snug">
                        Runs multiple searches, compares sources, and generates a long-form report — automatically saved to your Reports library.
                      </p>
                    </div>
                  </motion.div>
                </>
              )}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {report && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Markdown content={report} streaming={running && !done} className="prose-base" />
                </motion.div>
              )}

              {!report && running && (
                <div className="flex items-center gap-3 text-muted-foreground text-sm py-8">
                  <Loader2 size={16} className="animate-spin text-primary" />
                  {mode === "deep" ? "Running deep research — this may take a moment..." : "Researching..."}
                </div>
              )}

              {done && sources.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="mt-8 p-4 rounded-xl border border-border bg-muted/30"
                >
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Globe size={11} />
                    Sources ({sources.length})
                  </h3>
                  <div className="space-y-1.5">
                    {sources.map((src, i) => (
                      <a key={i} href={src} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors">
                        <div className="w-4 h-4 rounded bg-muted flex items-center justify-center flex-shrink-0 text-[9px] font-mono">
                          {i + 1}
                        </div>
                        <span className="truncate hover:underline underline-offset-2">{src}</span>
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
