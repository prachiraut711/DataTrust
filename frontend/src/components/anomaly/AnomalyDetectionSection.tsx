import { useState, useEffect } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { detectAnomaliesApi } from "@/services/api";
import type { AnomalyDetectionResponse } from "@/types/anomaly";

interface AnomalyDetectionSectionProps {
  token: string;
  datasetId: string;
}

export function AnomalyDetectionSection({
  token,
  datasetId,
}: AnomalyDetectionSectionProps) {
  const [anomalyData, setAnomalyData] = useState<AnomalyDetectionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [detecting, setDetecting] = useState<boolean>(false);
  const [contamination, setContamination] = useState<number>(0.05);
  const [error, setError] = useState<string | null>(null);

  const runAnomalyDetection = async (isManual = false) => {
    if (isManual) {
      setDetecting(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await detectAnomaliesApi(token, datasetId, contamination);
      setAnomalyData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run anomaly detection.");
    } finally {
      setLoading(false);
      setDetecting(false);
    }
  };

  useEffect(() => {
    runAnomalyDetection();
  }, [datasetId, token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border rounded-xl bg-card text-muted-foreground space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-medium">Running Isolation Forest statistical anomaly detection...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-purple-500" />
            Unsupervised Anomaly Detection
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Powered by scikit-learn Isolation Forest algorithm evaluating numeric feature distributions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-muted/50 px-2.5 py-1 rounded-lg border text-xs">
            <Sliders className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-muted-foreground font-medium">Contamination:</span>
            <select
              value={contamination}
              onChange={(e) => setContamination(parseFloat(e.target.value))}
              disabled={detecting}
              className="bg-transparent font-mono font-semibold text-foreground focus:outline-none cursor-pointer"
            >
              <option value="0.01">1% (0.01)</option>
              <option value="0.03">3% (0.03)</option>
              <option value="0.05">5% (0.05 - Default)</option>
              <option value="0.10">10% (0.10)</option>
            </select>
          </div>

          <Button
            size="sm"
            onClick={() => runAnomalyDetection(true)}
            disabled={detecting}
            className="text-xs gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${detecting ? "animate-spin" : ""}`} />
            {detecting ? "Analyzing..." : "Re-run Detection"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 border border-destructive/30 rounded-lg bg-destructive/5 text-destructive text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {anomalyData && (
        <>
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border shadow-sm">
              <CardHeader className="p-4 pb-1">
                <CardDescription className="text-[11px] font-medium">
                  Numeric Columns
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-2xl font-bold text-foreground">
                  {anomalyData.total_numeric_columns}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {anomalyData.columns_analyzed} successfully evaluated
                </p>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="p-4 pb-1">
                <CardDescription className="text-[11px] font-medium">
                  Total Outliers Detected
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {anomalyData.total_anomalies}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Across all analyzed numeric columns
                </p>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="p-4 pb-1">
                <CardDescription className="text-[11px] font-medium">
                  Overall Anomaly Rate
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-2xl font-bold text-foreground">
                  {anomalyData.overall_anomaly_percentage}%
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Of total numeric observations
                </p>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardHeader className="p-4 pb-1">
                <CardDescription className="text-[11px] font-medium">
                  Model Algorithm
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-base font-bold text-foreground truncate">
                  Isolation Forest
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                  contamination = {anomalyData.contamination}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Per-Column Anomaly Breakdown */}
          <Card className="border shadow-sm overflow-hidden">
            <CardHeader className="p-4 border-b bg-muted/20">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Column-Level Statistical Outlier Analysis
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {anomalyData.column_results.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  No numeric columns identified in this dataset for statistical anomaly detection.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b bg-muted/10 text-muted-foreground font-medium">
                        <th className="py-3 px-4">Column</th>
                        <th className="py-3 px-4">Type</th>
                        <th className="py-3 px-4 text-right">Observations</th>
                        <th className="py-3 px-4 text-right">Anomalies</th>
                        <th className="py-3 px-4">Outlier Rate</th>
                        <th className="py-3 px-4">Sample Outliers Discovered</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {anomalyData.column_results.map((col) => {
                        const isSuccess = col.status === "success";
                        return (
                          <tr key={col.column_name} className="hover:bg-muted/30 transition-colors">
                            <td className="py-3 px-4 font-semibold text-foreground">
                              {col.column_name}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                {col.data_type}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono">
                              {col.total_values.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-medium">
                              {isSuccess ? (
                                <span className={col.anomaly_count > 0 ? "text-purple-600 dark:text-purple-400 font-bold" : "text-muted-foreground"}>
                                  {col.anomaly_count}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 min-w-[140px]">
                              {isSuccess ? (
                                <div className="space-y-1">
                                  <div className="flex justify-between text-[10px] font-mono">
                                    <span>{col.anomaly_percentage}%</span>
                                  </div>
                                  <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${
                                        col.anomaly_percentage > 7
                                          ? "bg-rose-500"
                                          : col.anomaly_percentage > 3
                                          ? "bg-purple-500"
                                          : "bg-emerald-500"
                                      }`}
                                      style={{ width: `${Math.min(100, col.anomaly_percentage * 10)}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[11px] text-muted-foreground italic">
                                  {col.message || "Skipped"}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {col.sample_anomalies && col.sample_anomalies.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {col.sample_anomalies.map((val, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center gap-1 font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-medium"
                                    >
                                      {val}
                                    </span>
                                  ))}
                                </div>
                              ) : isSuccess ? (
                                <span className="text-[11px] text-muted-foreground">None detected</span>
                              ) : (
                                <span className="text-[11px] text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isSuccess ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3 w-3" />
                                  Analyzed
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                  <Info className="h-3 w-3" />
                                  Skipped
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
