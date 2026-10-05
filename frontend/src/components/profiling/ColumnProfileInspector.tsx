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
import {
  BarChart2,
  Calendar,
  Layers,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ColumnProfile } from "@/types/profile";

interface ColumnProfileInspectorProps {
  column: ColumnProfile;
  totalRows?: number;
}

export const ColumnProfileInspector: React.FC<ColumnProfileInspectorProps> = ({
  column,
}) => {
  const formatNum = (val: number | null | undefined): string => {
    if (val === null || val === undefined) return "—";
    if (Math.abs(val) >= 1000) {
      return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 4 });
  };

  const getCategoryBadge = () => {
    switch (column.inferred_category) {
      case "numeric":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            Numeric
          </span>
        );
      case "categorical":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
            Categorical
          </span>
        );
      case "date":
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            Date / Temporal
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-muted text-muted-foreground border">
            Other
          </span>
        );
    }
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="p-4 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">
                Col #{column.column_index + 1}
              </span>
              <CardTitle className="text-base font-bold font-mono tracking-tight text-foreground">
                {column.column_name}
              </CardTitle>
              {getCategoryBadge()}
            </div>
            <CardDescription className="text-xs font-mono">
              Inferred Type: <span className="font-semibold text-foreground">{column.data_type}</span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-1 rounded bg-muted font-mono text-[11px]">
              Nulls: <span className={column.null_count > 0 ? "font-bold text-amber-600 dark:text-amber-400" : "text-foreground"}>
                {column.null_percentage}%
              </span> ({column.null_count})
            </span>
            <span className="px-2 py-1 rounded bg-muted font-mono text-[11px]">
              Distinct: <span className="font-bold text-foreground">{column.distinct_count}</span> ({column.unique_percentage}%)
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-6">
        {/* NUMERIC COLUMN PROFILE */}
        {column.inferred_category === "numeric" && column.numeric_statistics && (
          <div className="space-y-5">
            {/* 5-Number summary pills */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-[10px] uppercase font-mono text-muted-foreground">Minimum</p>
                <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                  {formatNum(column.numeric_statistics.min)}
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-[10px] uppercase font-mono text-muted-foreground">Maximum</p>
                <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                  {formatNum(column.numeric_statistics.max)}
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-[10px] uppercase font-mono text-muted-foreground">Mean</p>
                <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                  {formatNum(column.numeric_statistics.mean)}
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-[10px] uppercase font-mono text-muted-foreground">Median</p>
                <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                  {formatNum(column.numeric_statistics.median)}
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-[10px] uppercase font-mono text-muted-foreground">Std. Deviation</p>
                <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                  {formatNum(column.numeric_statistics.std_dev)}
                </p>
              </div>
            </div>

            {/* Distribution / Histogram Chart */}
            {column.numeric_statistics.histogram.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <BarChart2 className="h-3.5 w-3.5 text-blue-500" />
                    Value Distribution Histogram
                  </h4>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {column.numeric_statistics.histogram.length} equal-width buckets
                  </span>
                </div>
                <div className="h-44 w-full border rounded-lg p-2 bg-muted/10">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={column.numeric_statistics.histogram}
                      margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                      <XAxis
                        dataKey="bucket_label"
                        tick={{ fontSize: 10 }}
                        className="text-[10px] font-mono text-muted-foreground"
                        angle={-15}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis
                        tick={{ fontSize: 10 }}
                        className="text-[10px] font-mono text-muted-foreground"
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const d = payload[0].payload;
                            return (
                              <div className="bg-popover border text-popover-foreground text-xs rounded-md shadow-md p-2 space-y-1">
                                <p className="font-mono font-semibold">Range: {d.bucket_label}</p>
                                <p className="text-blue-600 dark:text-blue-400">
                                  Frequency: {d.count.toLocaleString()} rows
                                </p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {column.numeric_statistics.histogram.map((_, i) => (
                          <Cell key={`bar-${i}`} fill="#3b82f6" />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}

        {/* CATEGORICAL COLUMN PROFILE */}
        {column.inferred_category === "categorical" && column.categorical_statistics && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-[10px] uppercase font-mono text-muted-foreground">Distinct Cardinality</p>
                <p className="text-sm font-bold font-mono text-foreground mt-0.5">
                  {column.categorical_statistics.distinct_count.toLocaleString()} unique values
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-[10px] uppercase font-mono text-muted-foreground">Most Common Value</p>
                <p className="text-sm font-bold font-mono text-foreground mt-0.5 truncate" title={column.categorical_statistics.most_common_value || "—"}>
                  {column.categorical_statistics.most_common_value ?? "—"}
                </p>
              </div>
            </div>

            {/* Top 5 Frequencies Bar Chart & Table */}
            {column.categorical_statistics.top_values.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Horizontal Bar Chart */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <BarChart2 className="h-3.5 w-3.5 text-purple-500" />
                    Top Value Frequencies
                  </h4>
                  <div className="h-48 border rounded-lg p-2 bg-muted/10">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={column.categorical_statistics.top_values}
                        layout="vertical"
                        margin={{ top: 5, right: 25, left: 10, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
                        <XAxis type="number" tick={{ fontSize: 10 }} />
                        <YAxis
                          type="category"
                          dataKey="value"
                          tick={{ fontSize: 10 }}
                          width={95}
                          className="font-mono text-muted-foreground"
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-popover border text-popover-foreground text-xs rounded-md shadow-md p-2 space-y-1">
                                  <p className="font-mono font-semibold">{d.value}</p>
                                  <p className="text-purple-600 dark:text-purple-400">
                                    {d.count.toLocaleString()} occurrences ({d.percentage}%)
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {column.categorical_statistics.top_values.map((_, i) => (
                            <Cell key={`cat-${i}`} fill="#8b5cf6" />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Table representation */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                    <Layers className="h-3.5 w-3.5 text-purple-500" />
                    Top Values Ranking
                  </h4>
                  <div className="border rounded-lg overflow-hidden bg-background">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-muted/30 border-b text-muted-foreground font-mono text-[10px] uppercase">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          <th className="py-2 px-3">Category Value</th>
                          <th className="py-2 px-3 text-right">Count</th>
                          <th className="py-2 px-3 text-right">Ratio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-mono text-[11px]">
                        {column.categorical_statistics.top_values.map((item, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="py-2 px-3 text-muted-foreground">{idx + 1}</td>
                            <td className="py-2 px-3 font-medium text-foreground max-w-[120px] truncate" title={item.value}>
                              {item.value}
                            </td>
                            <td className="py-2 px-3 text-right text-foreground">
                              {item.count.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-right text-muted-foreground">
                              {item.percentage}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* DATE / TEMPORAL COLUMN PROFILE */}
        {column.inferred_category === "date" && column.date_statistics && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-[10px] uppercase font-mono text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-amber-500" />
                  Earliest Timestamp
                </p>
                <p className="text-sm font-bold font-mono text-foreground mt-1">
                  {column.date_statistics.earliest_date ?? "—"}
                </p>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-[10px] uppercase font-mono text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3 text-amber-500" />
                  Latest Timestamp
                </p>
                <p className="text-sm font-bold font-mono text-foreground mt-1">
                  {column.date_statistics.latest_date ?? "—"}
                </p>
              </div>

              <div className="p-3 rounded-lg border bg-muted/20">
                <p className="text-[10px] uppercase font-mono text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-amber-500" />
                  Future Dates
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm font-bold font-mono text-foreground">
                    {column.date_statistics.future_date_count.toLocaleString()}
                  </p>
                  {column.date_statistics.future_date_count > 0 && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold">
                      Anomalous
                    </span>
                  )}
                </div>
              </div>
            </div>

            {column.date_statistics.future_date_count > 0 && (
              <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <p>
                  This temporal column contains <strong>{column.date_statistics.future_date_count}</strong> record(s) with timestamps after the current system date.
                </p>
              </div>
            )}
          </div>
        )}

        {/* OTHER COMPLEX TYPES */}
        {column.inferred_category === "other" && (
          <div className="p-4 rounded-lg border bg-muted/10 text-center space-y-2">
            <HelpCircle className="h-6 w-6 text-muted-foreground mx-auto" />
            <p className="text-xs text-muted-foreground">
              Complex or binary data type ({column.data_type}). Basic null and distinct statistics are tracked above.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
