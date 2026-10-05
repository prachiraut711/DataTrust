import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ReliabilityDistribution } from "@/types/dashboard";

interface ReliabilityDistributionChartProps {
  distribution: ReliabilityDistribution;
}

const TIER_CONFIG = [
  { key: "excellent", label: "Excellent (90–100)", color: "#10b981", bg: "bg-emerald-500" },
  { key: "good", label: "Good (75–89)", color: "#3b82f6", bg: "bg-blue-500" },
  { key: "fair", label: "Fair (60–74)", color: "#f59e0b", bg: "bg-amber-500" },
  { key: "poor", label: "Poor (0–59)", color: "#f43f5e", bg: "bg-rose-500" },
];

export function ReliabilityDistributionChart({
  distribution,
}: ReliabilityDistributionChartProps) {
  const chartData = [
    { name: "Excellent", value: distribution.excellent, color: "#10b981" },
    { name: "Good", value: distribution.good, color: "#3b82f6" },
    { name: "Fair", value: distribution.fair, color: "#f59e0b" },
    { name: "Poor", value: distribution.poor, color: "#f43f5e" },
  ].filter((item) => item.value > 0);

  const totalAnalyzed =
    distribution.excellent + distribution.good + distribution.fair + distribution.poor;

  return (
    <Card className="border shadow-sm flex flex-col justify-between">
      <CardHeader className="p-4 pb-2 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <PieIcon className="h-4 w-4 text-primary" />
              Reliability Distribution
            </CardTitle>
            <CardDescription className="text-xs">
              Breakdown of datasets across DataTrust reliability health tiers.
            </CardDescription>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            {totalAnalyzed} analyzed
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-3 flex-1 flex flex-col justify-center">
        {totalAnalyzed === 0 ? (
          <div className="py-12 text-center space-y-2 border border-dashed rounded-lg bg-muted/10">
            <PieIcon className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
            <p className="text-xs font-semibold text-foreground">
              No reliability distribution yet
            </p>
            <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
              Run an analysis on your datasets to see reliability distribution across tiers.
            </p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-around gap-4 py-2">
            {/* Donut Chart */}
            <div className="h-48 w-48 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0];
                        const pct = totalAnalyzed > 0
                          ? Math.round(((data.value as number) / totalAnalyzed) * 100)
                          : 0;
                        return (
                          <div className="rounded-lg border bg-popover p-2 shadow-md text-xs">
                            <span className="font-bold text-popover-foreground">
                              {data.name}:
                            </span>{" "}
                            <span className="font-mono">
                              {data.value} dataset{data.value === 1 ? "" : "s"} ({pct}%)
                            </span>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={70}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {totalAnalyzed}
                </span>
                <span className="text-[9px] uppercase font-bold text-muted-foreground">
                  Datasets
                </span>
              </div>
            </div>

            {/* Legend Breakdown */}
            <div className="space-y-2 w-full sm:w-auto min-w-[180px]">
              {TIER_CONFIG.map((tier) => {
                const count =
                  tier.key === "excellent"
                    ? distribution.excellent
                    : tier.key === "good"
                    ? distribution.good
                    : tier.key === "fair"
                    ? distribution.fair
                    : distribution.poor;
                const pct = totalAnalyzed > 0 ? Math.round((count / totalAnalyzed) * 100) : 0;
                return (
                  <div
                    key={tier.key}
                    className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-muted/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${tier.bg}`} />
                      <span className="text-muted-foreground">{tier.label.split(" ")[0]}</span>
                    </div>
                    <div className="font-mono text-[11px] font-semibold text-foreground flex items-center gap-2">
                      <span>{count}</span>
                      <span className="text-muted-foreground text-[10px] w-8 text-right">
                        ({pct}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
