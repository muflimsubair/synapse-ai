import { useState, useEffect } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, MessageSquare, FileText, Zap, Globe, Brain, ArrowRight,
  Cpu, ChevronRight, CheckCircle, Lightbulb, PenLine, BarChart2,
  BookOpen, Layers, Network, Sparkles, ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Markdown } from "@/lib/markdown";

/* ─── Agent pipeline ─────────────────────────────────────────── */
const PIPELINE_STAGES = [
  { id: "planner",    label: "Planner",          icon: Lightbulb,   color: "text-violet-400", bg: "bg-violet-500/15", desc: "Decomposes the query into research sub-tasks and decides which tools to use" },
  { id: "researcher", label: "Researcher",        icon: Search,      color: "text-blue-400",   bg: "bg-blue-500/15",   desc: "Searches the web and retrieves relevant documents, ranking by credibility" },
  { id: "analyst",    label: "Analyst",           icon: BarChart2,   color: "text-cyan-400",   bg: "bg-cyan-500/15",   desc: "Cross-references sources, resolves conflicts, and extracts structured insights" },
  { id: "reporter",   label: "Report Generator",  icon: PenLine,     color: "text-emerald-400",bg: "bg-emerald-500/15",desc: "Synthesizes findings into a citation-backed, structured Markdown report" },
];

/* ─── Live status animation ──────────────────────────────────── */
const STATUS_STEPS = [
  { icon: Lightbulb, label: "Planning research...",      stage: 0 },
  { icon: Globe,     label: "Searching web...",          stage: 1 },
  { icon: BookOpen,  label: "Reading documents...",      stage: 1 },
  { icon: BarChart2, label: "Synthesizing findings...", stage: 2 },
  { icon: PenLine,   label: "Generating report...",     stage: 3 },
];

function LiveStatusWidget() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done) {
      const t = setTimeout(() => { setStep(0); setDone(false); }, 2500);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      if (step < STATUS_STEPS.length - 1) setStep((s) => s + 1);
      else setDone(true);
    }, 1100);
    return () => clearTimeout(t);
  }, [step, done]);

  const activeStage = done ? 4 : STATUS_STEPS[step].stage;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Terminal header */}
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border bg-muted/30">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-amber-500/70" />
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
        <span className="ml-2 text-[10px] font-mono text-muted-foreground">synapse — research agent</span>
      </div>

      <div className="p-4 space-y-2 min-h-[160px]">
        <div className="text-[11px] font-mono text-muted-foreground mb-3">
          <span className="text-primary">$</span> synapse run --query &quot;Impact of quantum computing on cryptography&quot; --mode deep
        </div>

        <AnimatePresence initial={false}>
          {(done ? STATUS_STEPS : STATUS_STEPS.slice(0, step + 1)).map((s, i) => {
            const Icon = s.icon;
            const isActive = !done && i === step;
            const isDone = done || i < step;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-center gap-2.5 text-xs font-mono"
              >
                {isActive ? (
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin flex-shrink-0" />
                ) : isDone ? (
                  <CheckCircle size={14} className="text-emerald-400 flex-shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-border flex-shrink-0" />
                )}
                <Icon size={12} className={isDone ? "text-emerald-400" : isActive ? "text-primary" : "text-muted-foreground/40"} />
                <span className={isDone ? "text-foreground/80" : isActive ? "text-primary" : "text-muted-foreground/40"}>
                  {s.label}
                </span>
                {isActive && <span className="text-primary animate-pulse">|</span>}
                {isDone && <span className="text-emerald-400 ml-auto">done</span>}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {done && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-xs font-mono mt-1"
          >
            <CheckCircle size={14} className="text-emerald-400" />
            <span className="text-emerald-400">Report saved</span>
            <span className="text-muted-foreground ml-auto">3.2s</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/* ─── Agent pipeline visual ──────────────────────────────────── */
function PipelineSection() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <section className="px-6 py-16 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/40 text-xs text-muted-foreground mb-4">
          <Network size={12} />
          Multi-Agent Orchestration
        </div>
        <h2 className="text-2xl font-bold mb-3">The Agent Pipeline</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Every research query is handled by a coordinated chain of specialized agents — not a single model doing everything.
        </p>
      </motion.div>

      {/* Pipeline visual */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="flex flex-col md:flex-row items-stretch gap-0 mb-6"
      >
        {PIPELINE_STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const isActive = active === stage.id;
          return (
            <div key={stage.id} className="flex-1 flex flex-col md:flex-row items-stretch">
              <motion.button
                onHoverStart={() => setActive(stage.id)}
                onHoverEnd={() => setActive(null)}
                whileHover={{ y: -3 }}
                className={`flex-1 flex flex-col items-center gap-2.5 px-4 py-5 rounded-xl border transition-all cursor-default ${
                  isActive
                    ? `border-primary/40 ${stage.bg}`
                    : "border-border bg-card hover:border-border/60"
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  isActive ? stage.bg : "bg-muted"
                }`}>
                  <Icon size={20} className={isActive ? stage.color : "text-muted-foreground"} />
                </div>
                <div className="text-center">
                  <p className={`text-xs font-semibold mb-0.5 transition-colors ${isActive ? stage.color : "text-foreground"}`}>
                    {stage.label}
                  </p>
                  <AnimatePresence>
                    {isActive && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="text-[10px] text-muted-foreground leading-snug max-w-[140px]"
                      >
                        {stage.desc}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </motion.button>

              {i < PIPELINE_STAGES.length - 1 && (
                <div className="flex items-center justify-center px-1.5 py-2 md:py-0">
                  <ChevronRight size={16} className="text-muted-foreground/40 rotate-90 md:rotate-0" />
                </div>
              )}
            </div>
          );
        })}
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="text-center text-xs text-muted-foreground"
      >
        Hover each stage to see what it does. All agents run in coordinated sequence, sharing context.
      </motion.p>
    </section>
  );
}

/* ─── Sample report preview ──────────────────────────────────── */
const SAMPLE_REPORTS = [
  {
    title: "The State of AGI: 2025 Assessment",
    query: "Current state of AGI development and milestones in 2025",
    preview: `## Key Findings

| Benchmark | Human | Best AI (2025) |
|-----------|-------|----------------|
| MMLU | 89.8% | 94.7% |
| ARC-AGI | 85% | 78% |
| HLE | 68% | 31.2% |

Reasoning models now solve PhD-level mathematics with formal proof verification. Multi-modal agents execute 30+ step workflows with <15% error rates.`,
    sources: 5,
    tag: "Technology",
    tagColor: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  },
  {
    title: "Quantum Computing: Commercial Readiness",
    query: "Which industries are closest to quantum advantage?",
    preview: `## Readiness Matrix

| Sector | Timeline | Investment |
|--------|----------|------------|
| Drug Discovery | 2026-28 | $4.2B |
| Logistics | 2025-27 | $1.1B |
| Cryptography | 2028-35 | $3.6B |

Logistics optimization is the most mature application — Volkswagen demonstrated 10% fuel savings with D-Wave annealing.`,
    sources: 5,
    tag: "Science",
    tagColor: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  },
];

function SampleReportsSection() {
  const [active, setActive] = useState(0);
  const report = SAMPLE_REPORTS[active];

  return (
    <section className="px-6 py-16 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/40 text-xs text-muted-foreground mb-4">
          <FileText size={12} />
          Example Outputs
        </div>
        <h2 className="text-2xl font-bold mb-3">Research-grade reports</h2>
        <p className="text-muted-foreground text-sm max-w-md mx-auto">
          Every query produces a structured, citation-backed report. Here's what Synapse AI generates.
        </p>
      </motion.div>

      {/* Report selector tabs */}
      <div className="flex gap-2 mb-4">
        {SAMPLE_REPORTS.map((r, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={`flex-1 px-4 py-2.5 rounded-lg border text-left transition-all text-xs ${
              active === i
                ? "border-primary/40 bg-primary/10 text-primary font-medium"
                : "border-border bg-card text-muted-foreground hover:border-primary/20"
            }`}
          >
            <p className="font-medium truncate">{r.title}</p>
            <p className="opacity-70 mt-0.5 truncate">{r.query}</p>
          </button>
        ))}
      </div>

      {/* Report preview */}
      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl border border-border bg-card overflow-hidden"
        >
          {/* Report header */}
          <div className="flex items-start justify-between px-5 py-4 border-b border-border">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${report.tagColor}`}>
                  {report.tag}
                </span>
                <span className="text-[10px] text-muted-foreground">{report.sources} sources</span>
              </div>
              <h3 className="font-semibold text-sm">{report.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 italic">"{report.query}"</p>
            </div>
            <Link href="/research">
              <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7 flex-shrink-0 ml-4">
                Run similar <ExternalLink size={11} />
              </Button>
            </Link>
          </div>

          {/* Markdown body */}
          <div className="px-5 py-4">
            <Markdown content={report.preview} className="text-xs" />
          </div>

          <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">Synthesized from {report.sources} sources · Generated by Synapse AI</span>
            <Link href="/reports">
              <button className="text-[10px] text-primary hover:underline underline-offset-2">View all reports →</button>
            </Link>
          </div>
        </motion.div>
      </AnimatePresence>
    </section>
  );
}

/* ─── Deep Research Mode callout ─────────────────────────────── */
function DeepResearchSection() {
  return (
    <section className="px-6 pb-20 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="relative rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-violet-500/5 to-transparent overflow-hidden p-8"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-primary/10 blur-[80px]" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-start gap-8">
          <div className="flex-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-semibold mb-4">
              <Sparkles size={11} />
              Deep Research Mode
            </div>
            <h2 className="text-2xl font-bold mb-3">Go beyond a single search</h2>
            <p className="text-muted-foreground text-sm leading-relaxed mb-5 max-w-md">
              Deep Research Mode sends multiple parallel queries, compares source credibility, resolves contradictions, and produces a long-form report — the kind that usually takes an analyst a full day.
            </p>

            <div className="space-y-2.5 mb-6">
              {[
                { icon: Globe,   text: "Multiple parallel web searches across diverse sources" },
                { icon: BarChart2, text: "Source credibility scoring and conflict resolution" },
                { icon: Brain,   text: "Long-form structured report with executive summary" },
                { icon: FileText, text: "Persistent findings stored and searchable in Reports" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-2.5 text-sm text-foreground/80">
                  <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Icon size={11} className="text-primary" />
                  </div>
                  {text}
                </div>
              ))}
            </div>

            <Link href="/research">
              <Button className="gap-2" data-testid="button-deep-research">
                <Layers size={15} />
                Try Deep Research
                <ArrowRight size={14} />
              </Button>
            </Link>
          </div>

          {/* Live status widget */}
          <div className="w-full md:w-80 flex-shrink-0">
            <LiveStatusWidget />
          </div>
        </div>
      </motion.div>
    </section>
  );
}

/* ─── Features grid ──────────────────────────────────────────── */
const features = [
  { icon: MessageSquare, title: "Intelligent Chat",      description: "Converse with an AI that understands context, remembers history, and delivers precise answers." },
  { icon: Globe,         title: "Live Web Research",     description: "Real-time Tavily-powered search built directly into your research workflow." },
  { icon: FileText,      title: "PDF Intelligence",      description: "Upload documents and query them semantically. The agent reads, understands, and synthesizes." },
  { icon: Brain,         title: "Multi-Agent Pipeline",  description: "Planner → Researcher → Analyst → Report Generator. Coordinated intelligence, not a single prompt." },
  { icon: Zap,           title: "Streaming Responses",   description: "Watch your research materialize in real time with server-sent event streaming." },
  { icon: BookOpen,      title: "Structured Reports",    description: "Every session produces a saved, citation-backed Markdown report with sourced claims." },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { duration: 0.4 } } };

/* ─── Page ───────────────────────────────────────────────────── */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex flex-col items-center gap-6 max-w-3xl"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium">
            <Cpu size={12} />
            Synapse AI
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight">
            Autonomous intelligence
            <br />
            <span className="bg-gradient-to-r from-primary via-violet-400 to-blue-400 bg-clip-text text-transparent">
              for modern research
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
            A multi-agent research cockpit — plan, search, analyze, and generate publication-ready reports in seconds, not hours.
          </p>

          <div className="flex items-center gap-3 mt-2">
            <Link href="/research">
              <Button size="lg" className="gap-2 px-6" data-testid="button-get-started">
                Run Research Agent
                <ArrowRight size={16} />
              </Button>
            </Link>
            <Link href="/chat">
              <Button size="lg" variant="outline" className="gap-2 px-6" data-testid="button-chat">
                Open Chat
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features grid */}
      <section className="px-6 pb-8 max-w-5xl mx-auto">
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-100px" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {features.map((f) => (
            <motion.div
              key={f.title}
              variants={item}
              className="group p-5 rounded-xl border border-border bg-card hover:border-primary/30 hover:bg-card/80 transition-all duration-300"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <f.icon size={18} className="text-primary" />
              </div>
              <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <PipelineSection />
      <SampleReportsSection />
      <DeepResearchSection />
    </div>
  );
}
