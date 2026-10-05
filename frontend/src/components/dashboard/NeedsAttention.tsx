import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardDatasetItem } from "@/types/dashboard";

interface NeedsAttentionProps {
  datasets: DashboardDatasetItem[];
}

export function NeedsAttention({ datasets }: NeedsAttentionProps) {
  return (
    <Card className="border shadow-sm">
      <CardHeader className="p-4 pb-2 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Datasets Needing Attention ({datasets.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Datasets with reliability scores below 75 requiring rule review or outlier sanitization.
            </CardDescription>
          </div>
          {datasets.length > 0 && (
            <span className="text-[11px] font-mono text-amber-600 dark:text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
              Action Recommended
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4">
        {datasets.length === 0 ? (
          <div className="py-6 flex flex-col sm:flex-row items-center justify-center gap-3 text-center sm:text-left rounded-lg border border-dashed bg-emerald-500/5 p-4 text-xs">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                All analyzed datasets are currently in Good or Excellent condition.
              </p>
              <p className="text-muted-foreground text-[11px] mt-0.5">
                No datasets are below the 75-point reliability threshold. Continue monitoring with automated runs.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {datasets.map((ds) => (
              <div
                key={ds.dataset_id}
                className="rounded-lg border p-3.5 bg-card flex flex-col justify-between space-y-3 hover:border-amber-500/40 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-bold text-xs text-foreground truncate">
                      {ds.name}
                    </h4>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border font-mono uppercase tracking-wider shrink-0 ${
                        ds.reliability_level === "Fair"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                      }`}
                    >
                      {ds.reliability_level}
                    </span>
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground">
                    Reliability:{" "}
                    <strong className="text-foreground">
                      {ds.reliability_score !== null ? ds.reliability_score.toFixed(1) : "N/A"}
                    </strong>{" "}
                    / 100
                  </p>
                  {ds.last_run_at && (
                    <p className="text-[10px] text-muted-foreground">
                      Last evaluated: {new Date(ds.last_run_at).toLocaleDateString()}
                    </p>
                  )}
                </div>

                <div className="pt-2 border-t flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {ds.row_count ? `${ds.row_count.toLocaleString()} rows` : "Metadata available"}
                  </span>
                  <Link to={`/datasets/${ds.dataset_id}`}>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 px-2.5">
                      Inspect Issues
                      <ArrowRight className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
