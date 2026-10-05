import { Link } from "react-router-dom";
import { History, ArrowRight, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardRecentActivityItem } from "@/types/dashboard";

interface RecentActivityProps {
  activity: DashboardRecentActivityItem[];
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours === 1 ? "" : "s"} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getTierBadgeClass(level: string) {
  switch (level) {
    case "Excellent":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
    case "Good":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
    case "Fair":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
    default:
      return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30";
  }
}

export function RecentActivity({ activity }: RecentActivityProps) {
  return (
    <Card className="border shadow-sm flex flex-col justify-between">
      <CardHeader className="p-4 pb-2 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <History className="h-4 w-4 text-primary" />
              Recent Dataset Activity
            </CardTitle>
            <CardDescription className="text-xs">
              Chronological log of historical quality and reliability runs across your workspace.
            </CardDescription>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            {activity.length} recent
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1">
        {activity.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <History className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
            <p className="text-xs font-semibold text-foreground">
              No recent analysis runs
            </p>
            <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
              No analysis runs recorded yet. Open a dataset to run your first quality & reliability evaluation.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border text-xs">
            {activity.map((item) => (
              <div
                key={item.run_id}
                className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground truncate">
                      {item.dataset_name}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.2 rounded text-[10px] font-medium border ${getTierBadgeClass(
                        item.reliability_level
                      )}`}
                    >
                      <Award className="h-3 w-3" />
                      {item.reliability_level}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{formatRelativeTime(item.created_at)}</span>
                    <span>•</span>
                    <span className="font-mono">
                      Reliability: <strong className="text-foreground">{item.reliability_score.toFixed(1)}</strong>
                    </span>
                    {item.notes && (
                      <>
                        <span>•</span>
                        <span className="italic truncate max-w-[200px]">&quot;{item.notes}&quot;</span>
                      </>
                    )}
                  </div>
                </div>

                <Link to={`/datasets/${item.dataset_id}`} className="shrink-0">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2.5">
                    View
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
