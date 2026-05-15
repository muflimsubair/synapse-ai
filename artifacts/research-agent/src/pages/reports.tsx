import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Trash2, ExternalLink, Calendar, Globe, X, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListReports,
  useDeleteReport,
  getListReportsQueryKey,
  getGetStatsOverviewQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Markdown } from "@/lib/markdown";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, format } from "date-fns";

interface Report {
  id: number;
  title: string;
  query: string;
  content: string;
  sources: string[];
  createdAt: string;
}

function ReportModal({ report, onClose }: { report: Report; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-end p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 60, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-2xl h-[calc(100vh-2rem)] bg-background border border-border rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-border flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            <h2 className="font-semibold text-base leading-snug">{report.title}</h2>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
              <Calendar size={11} />
              {format(new Date(report.createdAt), "MMM d, yyyy 'at' h:mm a")}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4 px-3 py-2.5 rounded-lg bg-muted/40 border border-border">
            <p className="text-xs text-muted-foreground mb-0.5">Query</p>
            <p className="text-sm font-medium">{report.query}</p>
          </div>

          <Markdown content={report.content} className="prose-sm" />

          {report.sources.length > 0 && (
            <div className="mt-6 p-4 rounded-xl border border-border bg-muted/20">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sources</h3>
              <div className="space-y-2">
                {report.sources.map((src, i) => (
                  <a
                    key={i}
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-xs text-muted-foreground hover:text-primary transition-colors group"
                  >
                    <Globe size={11} className="flex-shrink-0" />
                    <span className="truncate group-hover:underline underline-offset-2">{src}</span>
                    <ExternalLink size={10} className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function ReportsPage() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Report | null>(null);
  const [search, setSearch] = useState("");

  const { data: reports, isLoading } = useListReports();
  const deleteReport = useDeleteReport();

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteReport.mutateAsync({ id });
    qc.invalidateQueries({ queryKey: getListReportsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetStatsOverviewQueryKey() });
    if (selected?.id === id) setSelected(null);
  };

  const filtered = reports?.filter(
    (r) =>
      !search ||
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.query.toLowerCase().includes(search.toLowerCase())
  );

  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Research Reports</h1>
            <p className="text-muted-foreground text-sm mt-1">Saved research outputs with sources</p>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search reports..."
              className="pl-8 pr-3 py-2 text-xs bg-muted/40 border border-border rounded-lg focus:outline-none focus:border-primary/50 w-52"
              data-testid="input-search-reports"
            />
          </div>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44 rounded-xl" />)}
        </div>
      ) : !filtered?.length ? (
        <div className="py-20 text-center">
          <BookOpen size={40} className="text-muted-foreground/25 mx-auto mb-4" />
          {search ? (
            <>
              <p className="text-muted-foreground font-medium">No reports match "{search}"</p>
              <Button variant="ghost" size="sm" className="mt-3" onClick={() => setSearch("")}>Clear search</Button>
            </>
          ) : (
            <>
              <p className="text-muted-foreground font-medium">No reports yet</p>
              <p className="text-muted-foreground/60 text-sm mt-1">Run the research agent to generate reports</p>
            </>
          )}
        </div>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <AnimatePresence>
            {filtered.map((report) => (
              <motion.div
                key={report.id}
                variants={item}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group p-5 rounded-xl border border-border bg-card hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => setSelected(report)}
                data-testid={`report-card-${report.id}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <BookOpen size={15} className="text-primary" />
                  </div>
                  <button
                    onClick={(e) => handleDelete(report.id, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`button-delete-report-${report.id}`}
                  >
                    <Trash2 size={14} className="text-muted-foreground hover:text-destructive transition-colors" />
                  </button>
                </div>

                <h3 className="font-semibold text-sm mb-1.5 line-clamp-2">{report.title}</h3>

                <p className="text-xs text-muted-foreground line-clamp-2 mb-3 italic">"{report.query}"</p>

                <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mb-4">
                  {report.content.replace(/[#*`]/g, "").slice(0, 180)}...
                </p>

                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Globe size={10} />
                    {report.sources.length} source{report.sources.length !== 1 ? "s" : ""}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar size={10} />
                    {formatDistanceToNow(new Date(report.createdAt), { addSuffix: true })}
                  </span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <AnimatePresence>
        {selected && <ReportModal report={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
