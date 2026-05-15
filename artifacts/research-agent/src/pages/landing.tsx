import { Link } from "wouter";
import { motion } from "framer-motion";
import { Search, MessageSquare, FileText, Zap, Globe, Brain, ArrowRight, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: MessageSquare,
    title: "Intelligent Chat",
    description: "Converse with an AI that understands context, remembers history, and delivers precise answers.",
  },
  {
    icon: Globe,
    title: "Live Web Research",
    description: "Real-time Tavily-powered search built directly into your research workflow.",
  },
  {
    icon: FileText,
    title: "PDF Intelligence",
    description: "Upload documents and query them semantically. The agent reads, understands, and synthesizes.",
  },
  {
    icon: Brain,
    title: "Multi-Agent Research",
    description: "A Planner → Researcher → Synthesizer pipeline that produces publication-ready reports.",
  },
  {
    icon: Zap,
    title: "Streaming Responses",
    description: "Watch your research materialize in real time with server-sent event streaming.",
  },
  {
    icon: Search,
    title: "Structured Reports",
    description: "Every research session generates a saved, searchable Markdown report with citations.",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center min-h-[80vh] px-6 text-center">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex flex-col items-center gap-6 max-w-3xl"
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium">
            <Cpu size={12} />
            Synapse AI
          </div>

          <h1 className="text-5xl md:text-6xl font-bold leading-tight tracking-tight">
            Research at the
            <br />
            <span className="bg-gradient-to-r from-primary via-violet-400 to-blue-400 bg-clip-text text-transparent">
              speed of thought
            </span>
          </h1>

          <p className="text-lg text-muted-foreground max-w-xl leading-relaxed">
            An autonomous AI research cockpit — chat, search the web, analyze PDFs, and generate structured reports with a multi-agent pipeline.
          </p>

          <div className="flex items-center gap-3 mt-2">
            <Link href="/chat">
              <Button size="lg" className="gap-2 px-6" data-testid="button-get-started">
                Start Researching
                <ArrowRight size={16} />
              </Button>
            </Link>
            <Link href="/research">
              <Button size="lg" variant="outline" className="gap-2 px-6" data-testid="button-research">
                Run Research Agent
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="px-6 pb-24 max-w-5xl mx-auto">
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
    </div>
  );
}
