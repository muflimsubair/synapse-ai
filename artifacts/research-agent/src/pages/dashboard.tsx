import { motion } from "framer-motion";
import { MessageSquare, FileText, BarChart2, BookOpen, Clock, TrendingUp } from "lucide-react";
import { useGetStatsOverview } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDistanceToNow } from "date-fns";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

function StatCard({ icon: Icon, label, value, color }: { icon: typeof MessageSquare; label: string; value: number | undefined; color: string }) {
  return (
    <motion.div variants={fadeUp} className="p-5 rounded-xl border border-border bg-card">
      <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center mb-4`}>
        <Icon size={18} className="text-white" />
      </div>
      {value === undefined ? (
        <Skeleton className="h-8 w-16 mb-1" />
      ) : (
        <p className="text-3xl font-bold tabular-nums">{value.toLocaleString()}</p>
      )}
      <p className="text-muted-foreground text-xs mt-1">{label}</p>
    </motion.div>
  );
}

const activityIcon: Record<string, typeof MessageSquare> = {
  conversation: MessageSquare,
  document: FileText,
  report: BookOpen,
};

const activityColor: Record<string, string> = {
  conversation: "text-violet-400",
  document: "text-blue-400",
  report: "text-emerald-400",
};

export default function DashboardPage() {
  const { data: stats, isLoading } = useGetStatsOverview();

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Research activity overview</p>
      </motion.div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        <StatCard icon={MessageSquare} label="Conversations" value={isLoading ? undefined : (stats?.totalConversations ?? 0)} color="bg-violet-500" />
        <StatCard icon={TrendingUp} label="Messages" value={isLoading ? undefined : (stats?.totalMessages ?? 0)} color="bg-blue-500" />
        <StatCard icon={FileText} label="Documents" value={isLoading ? undefined : (stats?.totalDocuments ?? 0)} color="bg-emerald-500" />
        <StatCard icon={BookOpen} label="Reports" value={isLoading ? undefined : (stats?.totalReports ?? 0)} color="bg-orange-500" />
      </motion.div>

      {/* Recent activity */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border border-border bg-card p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Clock size={15} className="text-muted-foreground" />
          <h2 className="font-semibold text-sm">Recent Activity</h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="w-7 h-7 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-3.5 w-48 mb-1" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : !stats?.recentActivity?.length ? (
          <div className="py-12 text-center">
            <BarChart2 size={32} className="text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No activity yet</p>
            <p className="text-muted-foreground/60 text-xs mt-1">Start a chat or run a research query to see activity here</p>
          </div>
        ) : (
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-1">
            {stats.recentActivity.map((item, i) => {
              const Icon = activityIcon[item.type] ?? MessageSquare;
              const colorClass = activityColor[item.type] ?? "text-muted-foreground";
              return (
                <motion.div
                  key={i}
                  variants={fadeUp}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/40 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon size={13} className={colorClass} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground capitalize">{item.type}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </span>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
