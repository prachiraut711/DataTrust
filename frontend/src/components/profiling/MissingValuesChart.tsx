import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ColumnProfile } from "@/types/profile";

interface MissingValuesChartProps {
  columns: ColumnProfile[];
}

export const MissingValuesChart: React.FC<MissingValuesChartProps> = ({ columns }) => {
  // Filter columns with missing values and sort descending
  const missingCols = columns
    .filter((c) => c.null_count > 0)
    .sort((a, b) => b.null_percentage - a.null_percentage);

  if (missingCols.length === 0) {
    return (
      <Card className="border shadow-sm">
        <CardHeader className="p-4 pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            Missing Values Distribution
          </CardTitle>
          <CardDescription className="text-xs">
            Column completeness assessment across the dataset.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-2">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <p className="font-semibold">Complete Dataset Integrity</p>
              <p className="text-[11px] opacity-90">
                All {columns.length} columns contain 0 missing values (100% data completeness).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = missingCols.map((c) => ({
    name: c.column_name,
    null_percentage: c.null_percentage,
    null_count: c.null_count,
  }));

  return (
    <Card className="border shadow-sm">
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Missing Values by Column
          </CardTitle>
          <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
            {missingCols.length} {missingCols.length === 1 ? "column has" : "columns have"} missing data
          </span>
        </div>
        <CardDescription className="text-xs">
          Columns with the highest missing-value percentages.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="h-52 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
              <XAxis
                type="number"
                domain={[0, 100]}
                unit="%"
                tick={{ fontSize: 11 }}
                className="text-xs text-muted-foreground"
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                className="text-xs font-mono text-muted-foreground"
                width={110}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-popover border text-popover-foreground text-xs rounded-md shadow-md p-2 space-y-1">
                        <p className="font-mono font-semibold">{data.name}</p>
                        <p className="text-amber-600 dark:text-amber-400">
                          Missing: {data.null_percentage}% ({data.null_count.toLocaleString()} rows)
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="null_percentage" radius={[0, 4, 4, 0]}>
                {chartData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill="#f59e0b" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};
