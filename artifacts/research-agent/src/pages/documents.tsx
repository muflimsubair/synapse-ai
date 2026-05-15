import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, FileText, Trash2, Loader2, CheckCircle, AlertCircle, Clock, X } from "lucide-react";
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

export default function DocumentsPage() {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const { data: documents, isLoading } = useListDocuments();
  const uploadDoc = useUploadDocument();
  const deleteDoc = useDeleteDocument();

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (!file.type.includes("pdf")) continue;
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await uploadDoc.mutateAsync({
          data: {
            filename: file.name,
            originalName: file.name,
            contentBase64: base64,
            mimeType: file.type,
          },
        });
        qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetStatsOverviewQueryKey() });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDelete = async (id: number) => {
    await deleteDoc.mutateAsync({ id });
    qc.invalidateQueries({ queryKey: getListDocumentsQueryKey() });
    qc.invalidateQueries({ queryKey: getGetStatsOverviewQueryKey() });
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
        onClick={() => fileInputRef.current?.click()}
        data-testid="dropzone-upload"
        className={cn(
          "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all mb-6",
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
            <Upload size={22} className={cn("transition-colors", dragOver ? "text-primary" : "text-muted-foreground")} />
          </div>
          <div>
            <p className="text-sm font-medium">
              {uploadDoc.isPending ? "Uploading..." : "Drop PDFs here or click to upload"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Supports PDF files up to 50MB</p>
          </div>
          {uploadDoc.isPending && <Loader2 size={16} className="animate-spin text-primary" />}
        </div>
      </motion.div>

      {/* Document grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : !documents?.length ? (
        <div className="py-20 text-center">
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
              return (
                <motion.div
                  key={doc.id}
                  variants={item}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="group p-4 rounded-xl border border-border bg-card hover:border-border/80 hover:shadow-sm transition-all"
                  data-testid={`doc-card-${doc.id}`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <FileText size={18} className="text-primary" />
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`button-delete-doc-${doc.id}`}
                    >
                      <X size={15} className="text-muted-foreground hover:text-destructive transition-colors" />
                    </button>
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
