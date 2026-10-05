import { History, Calendar } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { QualityRun } from "@/types/qualityRun";

interface QualityRunHistoryProps {
  runs: QualityRun[];
}

export function QualityRunHistory({ runs }: QualityRunHistoryProps) {
  const getScoreBadge = (score: number) => {
    if (score >= 90) {
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    }
    if (score >= 75) {
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    }
    if (score >= 60) {
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    }
    return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
  };

  if (runs.length === 0) {
    return null; // Empty state is already cleanly presented by ReliabilityTrendChart
  }

  return (
    <Card className="border shadow-sm overflow-hidden">
      <CardHeader className="p-4 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Historical Quality Runs ({runs.length})
          </CardTitle>
          <span className="text-[11px] text-muted-foreground">
            Latest 50 snapshots recorded
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b bg-muted/10 text-muted-foreground font-medium">
                <th className="py-3 px-4">Run Timestamp</th>
                <th className="py-3 px-4 text-center">Reliability</th>
                <th className="py-3 px-4 text-right">Quality</th>
                <th className="py-3 px-4 text-right">Completeness</th>
                <th className="py-3 px-4 text-right">Anomaly Health</th>
                <th className="py-3 px-4 text-right">Anomaly %</th>
                <th className="py-3 px-4 text-right">Rows / Cols</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {runs.map((run, idx) => {
                const isLatest = idx === 0;
                const d = new Date(run.created_at);
                return (
                  <tr
                    key={run.id}
                    className={`hover:bg-muted/30 transition-colors ${
                      isLatest ? "bg-primary/5 font-medium" : ""
                    }`}
                  >
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-foreground font-semibold">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{d.toLocaleDateString()} {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                          {isLatest && (
                            <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-primary text-primary-foreground ml-1">
                              Current
                            </span>
                          )}
                        </div>
                        {run.notes && (
                          <p className="text-[11px] text-muted-foreground italic truncate max-w-xs">
                            {run.notes}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center font-mono font-bold text-xs px-2.5 py-0.5 rounded-full border ${getScoreBadge(
                          run.reliability_score
                        )}`}
                      >
                        {run.reliability_score.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {run.quality_score.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {run.completeness_score.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {run.anomaly_score.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                      {run.anomaly_percentage.toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-muted-foreground">
                      {run.row_count.toLocaleString()} · {run.column_count}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
