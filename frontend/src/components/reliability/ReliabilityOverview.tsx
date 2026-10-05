import { useState, useEffect } from "react";
import {
  Award,
  AlertTriangle,
  RefreshCw,
  Info,
  ShieldCheck,
  Database,
  Activity,
  Zap,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { getReliabilityApi, createQualityRunApi } from "@/services/api";
import type { ReliabilityScoreResponse } from "@/types/reliability";

interface ReliabilityOverviewProps {
  token: string;
  datasetId: string;
  datasetName: string;
  onRunCreated?: () => void;
}

export function ReliabilityOverview({
  token,
  datasetId,
  onRunCreated,
}: ReliabilityOverviewProps) {
  const [reliability, setReliability] = useState<ReliabilityScoreResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [savingRun, setSavingRun] = useState<boolean>(false);
  const [lastSavedMessage, setLastSavedMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchReliability = async (isManual = false) => {
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await getReliabilityApi(token, datasetId);
      setReliability(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to calculate reliability score.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRunAnalysisAndSave = async () => {
    setSavingRun(true);
    setError(null);
    setLastSavedMessage(null);
    try {
      await createQualityRunApi(token, datasetId);
      const data = await getReliabilityApi(token, datasetId);
      setReliability(data);
      setLastSavedMessage(
        `Snapshot saved at ${new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}`
      );
      if (onRunCreated) {
        onRunCreated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record historical run.");
    } finally {
      setSavingRun(false);
    }
  };

  useEffect(() => {
    fetchReliability();
  }, [datasetId, token]);

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "Excellent":
        return {
          bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
          desc: "Highly reliable dataset ready for machine learning and production analytics.",
        };
      case "Good":
        return {
          bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
          desc: "Suitable for analytics with minor quality or completeness observations.",
        };
      case "Fair":
        return {
          bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
          desc: "Moderate quality issues or anomalies detected. Review failing rules.",
        };
      default:
        return {
          bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
          desc: "Significant data quality violations or anomalies. Requires cleaning.",
        };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 75) return "text-blue-600 dark:text-blue-400";
    if (score >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-rose-600 dark:text-rose-400";
  };

  const getScoreProgressBg = (score: number) => {
    if (score >= 90) return "bg-emerald-500";
    if (score >= 75) return "bg-blue-500";
    if (score >= 60) return "bg-amber-500";
    return "bg-rose-500";
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 border rounded-xl bg-card text-muted-foreground space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-medium">Computing composite DataTrust reliability score...</p>
      </div>
    );
  }

  if (error || !reliability) {
    return (
      <div className="p-6 border border-destructive/30 rounded-xl bg-destructive/5 space-y-4">
        <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
          <AlertTriangle className="h-4 w-4" />
          Reliability Evaluation Error
        </div>
        <p className="text-xs text-muted-foreground">{error || "Could not load reliability score."}</p>
        <Button size="sm" variant="outline" onClick={() => fetchReliability(true)}>
          Retry Evaluation
        </Button>
      </div>
    );
  }

  const levelInfo = getLevelBadge(reliability.reliability_level);
  const { quality, completeness, anomaly_health } = reliability.components;

  return (
    <div className="space-y-6">
      {/* Top Banner: Composite Score & Action */}
      <Card className="border shadow-sm overflow-hidden bg-gradient-to-br from-card to-muted/20">
        <CardContent className="p-6 sm:p-8">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              {/* Circular Gauge Representation */}
              <div className="relative flex items-center justify-center h-28 w-28 rounded-full border-4 border-muted/50 bg-background shadow-inner">
                <div className="text-center">
                  <span className={`text-3xl font-extrabold tracking-tight ${getScoreColor(reliability.reliability_score)}`}>
                    {reliability.reliability_score.toFixed(1)}
                  </span>
                  <span className="block text-[10px] uppercase font-bold text-muted-foreground">
                    / 100
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold tracking-tight text-foreground">
                    DataTrust Reliability Score
                  </h2>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold border ${levelInfo.bg}`}
                  >
                    <Award className="h-3.5 w-3.5" />
                    {reliability.reliability_level}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground max-w-xl">
                  {levelInfo.desc}
                </p>
                <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-muted-foreground">
                  <Zap className="h-3 w-3 text-amber-500" />
                  <span>Formula: 50% Quality Rules + 25% Completeness + 25% Anomaly Health</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              {lastSavedMessage && (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  <CheckCircle className="h-3 w-3" />
                  {lastSavedMessage}
                </span>
              )}
              <Button
                size="sm"
                onClick={handleRunAnalysisAndSave}
                disabled={savingRun || refreshing}
                className="text-xs gap-1.5 font-semibold shadow-sm"
              >
                <Sparkles className={`h-3.5 w-3.5 ${savingRun ? "animate-spin" : ""}`} />
                {savingRun ? "Analyzing & Saving..." : "Run Analysis & Save Snapshot"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchReliability(true)}
                disabled={refreshing || savingRun}
                className="text-xs gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
                {refreshing ? "Re-calculating..." : "Refresh Score"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Component Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Component 1: Quality Rules (50%) */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Data Quality (50%)
              </CardDescription>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted font-bold">
                Weight 0.50
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className={`text-2xl font-bold ${getScoreColor(quality.score)}`}>
                {quality.score.toFixed(1)}%
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                +{(quality.weighted_score).toFixed(2)} pts
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${getScoreProgressBg(quality.score)}`}
                style={{ width: `${Math.min(100, Math.max(0, quality.score))}%` }}
              />
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {quality.description}
            </p>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t text-muted-foreground">
              <span>Active Rules: {quality.total_rules}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {quality.passed_rules} Passed
              </span>
              {quality.failed_rules > 0 && (
                <span className="text-rose-600 dark:text-rose-400 font-medium">
                  {quality.failed_rules} Failed
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Component 2: Completeness (25%) */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Database className="h-4 w-4 text-blue-500" />
                Data Completeness (25%)
              </CardDescription>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted font-bold">
                Weight 0.25
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className={`text-2xl font-bold ${getScoreColor(completeness.score)}`}>
                {completeness.score.toFixed(1)}%
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                +{(completeness.weighted_score).toFixed(2)} pts
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${getScoreProgressBg(completeness.score)}`}
                style={{ width: `${Math.min(100, Math.max(0, completeness.score))}%` }}
              />
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {completeness.description}
            </p>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t text-muted-foreground">
              <span>Missing Values:</span>
              <span className="font-mono font-medium text-foreground">
                {completeness.missing_cells.toLocaleString()} ({completeness.missing_percentage}%)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Component 3: Statistical Anomaly Health (25%) */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Activity className="h-4 w-4 text-purple-500" />
                Anomaly Health (25%)
              </CardDescription>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted font-bold">
                Weight 0.25
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className={`text-2xl font-bold ${getScoreColor(anomaly_health.score)}`}>
                {anomaly_health.score.toFixed(1)}%
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                +{(anomaly_health.weighted_score).toFixed(2)} pts
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${getScoreProgressBg(anomaly_health.score)}`}
                style={{ width: `${Math.min(100, Math.max(0, anomaly_health.score))}%` }}
              />
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {anomaly_health.description}
            </p>

            <div className="flex items-center justify-between text-[11px] pt-1 border-t text-muted-foreground">
              <span>Detected Outliers:</span>
              <span className="font-mono font-medium text-foreground">
                {anomaly_health.total_anomalies} ({anomaly_health.anomaly_percentage}%)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Formula Explanation Alert */}
      <div className="rounded-lg border bg-muted/20 p-4 text-xs text-muted-foreground flex items-start gap-3">
        <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-semibold text-foreground">How is the Reliability Score calculated?</span>
          <p>
            DataTrust applies a transparent, interview-explainable formula balancing 3 pillars:
            <strong> 50% Quality Rules compliance</strong> (evaluates domain assertions like min/max ranges, allowed values, regex patterns),
            <strong> 25% Data Completeness</strong> (penalizes empty cells and missingness across all attributes), and
            <strong> 25% Anomaly Health</strong> (penalizes statistical outliers detected by Isolation Forest in numeric dimensions).
          </p>
        </div>
      </div>
    </div>
  );
}
