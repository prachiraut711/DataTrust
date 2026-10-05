import { useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { BarChart3 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardDatasetItem } from "@/types/dashboard";

interface ReliabilityOverviewChartProps {
  datasets: DashboardDatasetItem[];
}

export function ReliabilityOverviewChart({ datasets }: ReliabilityOverviewChartProps) {
  const navigate = useNavigate();

  // Filter to analyzed datasets and take top 10
  const chartData = datasets
    .filter((d) => d.has_runs && d.reliability_score !== null)
    .slice(0, 10)
    .map((d) => ({
      id: d.dataset_id,
      name: d.name.length > 20 ? `${d.name.slice(0, 18)}...` : d.name,
      fullName: d.name,
      score: d.reliability_score ?? 0,
      level: d.reliability_level || "Analyzed",
    }));

  const getBarColor = (score: number) => {
    if (score >= 90) return "#10b981"; // emerald-500
    if (score >= 75) return "#3b82f6"; // blue-500
    if (score >= 60) return "#f59e0b"; // amber-500
    return "#f43f5e"; // rose-500
  };

  return (
    <Card className="border shadow-sm flex flex-col justify-between">
      <CardHeader className="p-4 pb-2 border-b bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Dataset Reliability Comparison
            </CardTitle>
            <CardDescription className="text-xs">
              Latest reliability scores across your top datasets (0–100 scale). Click a bar to inspect.
            </CardDescription>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground">
            Top {chartData.length}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-3 flex-1 flex flex-col justify-center">
        {chartData.length === 0 ? (
          <div className="py-12 text-center space-y-2 border border-dashed rounded-lg bg-muted/10">
            <BarChart3 className="h-8 w-8 text-muted-foreground mx-auto opacity-50" />
            <p className="text-xs font-semibold text-foreground">
              No analyzed datasets to compare
            </p>
            <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
              Run an analysis on your datasets to view the reliability comparison chart here.
            </p>
          </div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 8, right: 30, left: 10, bottom: 8 }}
                onClick={(e: any) => {
                  if (e && e.activePayload && e.activePayload.length > 0) {
                    const item = e.activePayload[0].payload;
                    if (item && item.id) {
                      navigate(`/datasets/${item.id}`);
                    }
                  }
                }}
                className="cursor-pointer"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#88888820" />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={{ fontSize: 11 }}
                  stroke="#888888"
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 11 }}
                  width={110}
                  stroke="#888888"
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border bg-popover p-2.5 shadow-md text-xs space-y-1">
                          <p className="font-bold text-popover-foreground">{data.fullName}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Reliability Score:</span>
                            <span
                              className="font-bold font-mono"
                              style={{ color: getBarColor(data.score) }}
                            >
                              {data.score.toFixed(1)} / 100
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Tier: {data.level} · Click to open dataset
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="score"
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getBarColor(entry.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
