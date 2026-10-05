import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  LineChart as LineChartIcon,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { QualityRun } from "@/types/qualityRun";

interface ReliabilityTrendChartProps {
  runs: QualityRun[];
}

export function ReliabilityTrendChart({ runs }: ReliabilityTrendChartProps) {
  // Runs arrive newest first; reverse chronologically for time-series visualization
  const chartData = useMemo(() => {
    return [...runs].reverse().map((run, idx) => {
      const d = new Date(run.created_at);
      const formattedDate = `${d.getMonth() + 1}/${d.getDate()} ${d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })}`;

      return {
        runNumber: idx + 1,
        formattedDate,
        fullTimestamp: d.toLocaleString(),
        reliability_score: Number(run.reliability_score.toFixed(1)),
        quality_score: Number(run.quality_score.toFixed(1)),
        completeness_score: Number(run.completeness_score.toFixed(1)),
        anomaly_score: Number(run.anomaly_score.toFixed(1)),
        notes: run.notes,
      };
    });
  }, [runs]);

  // Calculate trend interpretation between the 2 most recent runs
  const trendInsight = useMemo(() => {
    if (runs.length < 2) return null;
    const latest = runs[0].reliability_score;
    const previous = runs[1].reliability_score;
    const diff = Number((latest - previous).toFixed(1));

    if (diff > 0.5) {
      return {
        type: "positive",
        diff: `+${diff}`,
        icon: TrendingUp,
        color: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
        message: `Reliability improved by +${diff} pts compared to the previous run.`,
      };
    } else if (diff < -0.5) {
      return {
        type: "negative",
        diff: `${diff}`,
        icon: TrendingDown,
        color: "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20",
        message: `Reliability decreased by ${Math.abs(diff)} pts compared to the previous run.`,
      };
    }
    return {
      type: "neutral",
      diff: "0.0",
      icon: Minus,
      color: "text-muted-foreground bg-muted/40 border-muted",
      message: "Reliability has remained stable compared to the previous run.",
    };
  }, [runs]);

  if (runs.length === 0) {
    return (
      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <LineChartIcon className="h-4 w-4 text-primary" />
            Reliability Score Trend
          </CardTitle>
          <CardDescription className="text-xs">
            Historical progression of DataTrust reliability across consecutive evaluations
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center space-y-2">
          <Info className="h-8 w-8 text-muted-foreground/50" />
          <p className="font-medium text-foreground">No historical runs recorded yet.</p>
          <p className="max-w-md">
            Click <strong>Run Analysis & Save Snapshot</strong> above to establish a baseline quality and reliability metric snapshot.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (runs.length === 1) {
    const singleRun = runs[0];
    return (
      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <LineChartIcon className="h-4 w-4 text-primary" />
            Reliability Score Trend
          </CardTitle>
          <CardDescription className="text-xs">
            Historical progression of DataTrust reliability across consecutive evaluations
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 text-center text-xs text-muted-foreground space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-semibold text-xs border border-primary/20">
            Initial Baseline Snapshot Established: {singleRun.reliability_score.toFixed(1)} / 100
          </div>
          <p className="max-w-md mx-auto text-muted-foreground">
            A single historical run is currently recorded. As new rules or dataset updates are analyzed,
            a trend line comparing consecutive reliability scores will automatically render here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader className="p-4 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <LineChartIcon className="h-4 w-4 text-primary" />
              Reliability Score Trend
            </CardTitle>
            <CardDescription className="text-xs">
              Tracking reliability score evolution across {runs.length} recorded evaluation runs
            </CardDescription>
          </div>

          {trendInsight && (
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${trendInsight.color}`}
            >
              <trendInsight.icon className="h-3.5 w-3.5" />
              <span>{trendInsight.message}</span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-4 space-y-4">
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#88888820" />
              <XAxis
                dataKey="formattedDate"
                stroke="#888888"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                stroke="#888888"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `${value}%`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-md text-xs space-y-1.5">
                        <div className="font-semibold text-foreground border-b pb-1">
                          Run #{data.runNumber} — {data.fullTimestamp}
                        </div>
                        {data.notes && (
                          <div className="italic text-muted-foreground pb-1">
                            &quot;{data.notes}&quot;
                          </div>
                        )}
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-medium text-primary">Reliability:</span>
                          <span className="font-bold text-foreground font-mono">
                            {data.reliability_score}%
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-muted-foreground">
                          <span>Quality:</span>
                          <span className="font-mono">{data.quality_score}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-muted-foreground">
                          <span>Completeness:</span>
                          <span className="font-mono">{data.completeness_score}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-4 text-muted-foreground">
                          <span>Anomaly Health:</span>
                          <span className="font-mono">{data.anomaly_score}%</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="reliability_score"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "hsl(var(--primary))" }}
                activeDot={{ r: 6 }}
                name="Reliability Score"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
