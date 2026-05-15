import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, Trash2, Loader2, CheckCircle, AlertCircle,
  Clock, X, ArrowRight, Sparkles, BarChart2, Brain, Search, Globe
} from "lucide-react";
import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListDocuments,
  useUploadDocument,
  useDeleteDocument,
  getListDocumentsQueryKey,
  getGetStatsOverviewQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const statusConfig = {
  processing: { icon: Loader2, label: "Processing", color: "text-amber-400", spin: true },
  ready: { icon: CheckCircle, label: "Ready", color: "text-emerald-400", spin: false },
  error: { icon: AlertCircle, label: "Error", color: "text-destructive", spin: false },
};

const SUGGESTED_ACTIONS = [
  { icon: Brain, label: "Summarize this document", query: "Summarize this document and highlight the main points" },
  { icon: Sparkles, label: "Extract key insights", query: "Extract the key insights and important findings from this document" },
  { icon: BarChart2, label: "Generate a report", query: "Generate a comprehensive research report based on this document" },
  { icon: Search, label: "Analyze skills & topics", query: "Identify and analyze the main topics, skills, and themes in this document" },
  { icon: Globe, label: "Compare with web research", query: "Compare the content of this document with current web research on the same topic" },
];

interface UploadedDoc {
  id: number;
  originalName: string;
}

export default function DocumentsPage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [justUploaded, setJustUploaded] = useState<UploadedDoc | null>(null);

  const { data: documents, isLoading } = useListDocuments();
  const uploadDoc = useUploadDocument();
  const deleteDoc = useDeleteDocument();

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    setJustUploaded(null);
    for (const file of Array.from(files)) {
      if (!file.type.includes("pdf")) continue;
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        const uploaded = await uploadDoc.mutateAsync({
          data: {
            filename: file.name,
            originalName: file.name,
            contentBase64: base64,
            mimeType: file.type,
          },
        });
        qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetStatsOverviewQueryKey() });
        setJustUploaded({ id: uploaded.id, originalName: uploaded.originalName });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteDoc.mutateAsync({ id });
    qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetStatsOverviewQueryKey() });
    if (justUploaded?.id === id) setJustUploaded(null);
  };

  const goResearch = (docId: number, query: string) => {
    navigate(`/research?docId=${docId}&query=${encodeURIComponent(query)}`);
  };

  const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-muted-foreground text-sm mt-1">Upload PDFs to analyze with the research agent</p>
      </motion.div>

      {/* Drop zone */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => !uploadDoc.isPending && fileInputRef.current?.click()}
        data-testid="dropzone-upload"
        className={cn(
          "border-2 border-dashed rounded-xl p-10 text-center transition-all mb-4",
          uploadDoc.isPending ? "cursor-default opacity-70" : "cursor-pointer",
          dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
          data-testid="input-file-upload"
        />
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
            dragOver ? "bg-primary/20" : "bg-muted"
          )}>
            {uploadDoc.isPending
              ? <Loader2 size={22} className="animate-spin text-primary" />
              : <Upload size={22} className={cn("transition-colors", dragOver ? "text-primary" : "text-muted-foreground")} />
            }
          </div>
          <div>
            <p className="text-sm font-medium">
              {uploadDoc.isPending ? "Uploading..." : "Drop PDFs here or click to upload"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Supports PDF files up to 50MB</p>
          </div>
        </div>
      </motion.div>

      {/* Post-upload action panel */}
      <AnimatePresence>
        {justUploaded && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", damping: 22, stiffness: 300 }}
            className="mb-6 rounded-xl border border-primary/30 bg-primary/5 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-primary/20">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle size={13} className="text-emerald-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    <span className="text-primary truncate max-w-[260px] inline-block align-bottom">{justUploaded.originalName}</span>
                    <span className="text-foreground"> uploaded</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">What would you like to do with this document?</p>
                </div>
              </div>
              <button
                onClick={() => setJustUploaded(null)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                data-testid="button-dismiss-upload-panel"
              >
                <X size={14} />
              </button>
            </div>

            {/* Suggested actions */}
            <div className="p-3 flex flex-col gap-1.5">
              {SUGGESTED_ACTIONS.map(({ icon: Icon, label, query }) => (
                <motion.button
                  key={label}
                  whileHover={{ x: 3 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => goResearch(justUploaded.id, query)}
                  data-testid={`button-action-${label.toLowerCase().replace(/\s+/g, "-")}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-primary/10 transition-colors group w-full"
                >
                  <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                    <Icon size={14} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-sm text-foreground/80 group-hover:text-foreground transition-colors flex-1">{label}</span>
                  <ArrowRight size={13} className="text-muted-foreground/40 group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
                </motion.button>
              ))}
            </div>

            {/* Primary CTA */}
            <div className="px-4 pb-3">
              <Button
                onClick={() => goResearch(justUploaded.id, "")}
                className="w-full gap-2"
                size="sm"
                data-testid="button-research-this-document"
              >
                <Search size={14} />
                Research This Document
                <ArrowRight size={13} />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Document grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : !documents?.length ? (
        <div className="py-16 text-center">
          <FileText size={40} className="text-muted-foreground/25 mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">No documents yet</p>
          <p className="text-muted-foreground/60 text-sm mt-1">Upload a PDF to get started</p>
        </div>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AnimatePresence>
            {documents.map((doc) => {
              const { icon: StatusIcon, label, color, spin } = statusConfig[doc.status as keyof typeof statusConfig] ?? statusConfig.processing;
              const isNew = justUploaded?.id === doc.id;
              return (
                <motion.div
                  key={doc.id}
                  variants={item}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={cn(
                    "group p-4 rounded-xl border bg-card hover:shadow-sm transition-all",
                    isNew ? "border-primary/40 ring-1 ring-primary/20" : "border-border hover:border-border/80"
                  )}
                  data-testid={`doc-card-${doc.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={cn(
                      "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                      isNew ? "bg-primary/20" : "bg-primary/10"
                    )}>
                      <FileText size={18} className="text-primary" />
                    </div>
                    <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {doc.status === "ready" && (
                        <button
                          onClick={() => goResearch(doc.id, "")}
                          data-testid={`button-research-doc-${doc.id}`}
                          className="flex items-center gap-1 text-[10px] font-medium text-primary bg-primary/10 hover:bg-primary/20 px-1.5 py-1 rounded-md transition-colors"
                        >
                          <Search size={10} />
                          Research
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(doc.id)}
                        data-testid={`button-delete-doc-${doc.id}`}
                      >
                        <X size={15} className="text-muted-foreground hover:text-destructive transition-colors" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm font-medium truncate mb-1" title={doc.originalName}>{doc.originalName}</p>

                  <div className="flex items-center gap-1.5 mb-3">
                    <StatusIcon size={12} className={cn(color, spin && "animate-spin")} />
                    <span className={cn("text-xs", color)}>{label}</span>
                    {doc.pageCount && (
                      <>
                        <span className="text-muted-foreground/40 text-xs">·</span>
                        <span className="text-xs text-muted-foreground">{doc.pageCount}p</span>
                      </>
                    )}
                    <span className="text-muted-foreground/40 text-xs">·</span>
                    <span className="text-xs text-muted-foreground">{formatSize(doc.size)}</span>
                  </div>

                  {doc.summary && (
                    <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">{doc.summary}</p>
                  )}

                  <div className="flex items-center gap-1 mt-3 text-[10px] text-muted-foreground">
                    <Clock size={10} />
                    {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
