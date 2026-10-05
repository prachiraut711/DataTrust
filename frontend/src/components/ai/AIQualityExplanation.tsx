import { useState } from "react";
import {
  Sparkles,
  AlertTriangle,
  RefreshCw,
  Info,
  CheckCircle2,
  Lightbulb,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAIQualityExplanationApi } from "@/services/api";
import type { AIKeyIssue, AIQualityExplanation as AIQualityExplanationType, AISeverity } from "@/types/ai";

interface AIQualityExplanationProps {
  token: string;
  datasetId: string;
  datasetName: string;
}

export function AIQualityExplanation({
  token,
  datasetId,
  datasetName,
}: AIQualityExplanationProps) {
  const [explanation, setExplanation] = useState<AIQualityExplanationType | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateExplanation = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAIQualityExplanationApi(token, datasetId);
      setExplanation(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate AI explanation. Please check your configuration."
      );
    } finally {
      setLoading(false);
    }
  };

  const getSeverityBadge = (severity: AISeverity) => {
    switch (severity) {
      case "high":
        return {
          label: "High Severity",
          className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
        };
      case "medium":
        return {
          label: "Medium Severity",
          className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
        };
      case "low":
      default:
        return {
          label: "Low Severity",
          className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card className="border shadow-sm bg-gradient-to-br from-card via-card to-primary/5">
        <CardHeader className="p-6 pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
                <Sparkles className="h-4 w-4" />
                Gemini AI Assistance
              </div>
              <CardTitle className="text-lg font-bold tracking-tight text-foreground">
                AI-Powered Quality & Reliability Explanation
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Translate complex statistical profiles, quality rules, and anomaly scores into
                plain-language explanations, root-cause analyses, and actionable remediation steps.
              </CardDescription>
            </div>

            <Button
              size="sm"
              onClick={handleGenerateExplanation}
              disabled={loading}
              className="text-xs gap-1.5 font-semibold shadow-sm shrink-0"
            >
              {loading ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Generating Explanation...
                </>
              ) : explanation ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regenerate Explanation
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Explain Analysis
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        {/* Unconfigured / Error Alert */}
        {error && (
          <CardContent className="px-6 pb-6 pt-0">
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Unable to Generate Explanation</p>
                <p className="text-muted-foreground">{error}</p>
                {error.includes("GEMINI_API_KEY") && (
                  <p className="text-[11px] text-muted-foreground pt-1">
                    Tip: Set <code className="bg-muted px-1 py-0.5 rounded font-mono">GEMINI_API_KEY=your_key</code> in your backend <code className="bg-muted px-1 py-0.5 rounded font-mono">.env</code> file and restart the backend server.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        )}

        {/* Empty State before first run */}
        {!explanation && !loading && !error && (
          <CardContent className="px-6 pb-6 pt-0">
            <div className="rounded-lg border border-dashed p-6 text-center space-y-3 bg-muted/10">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">
                  Ready to explain {datasetName}
                </h4>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Click <strong>&quot;Explain Analysis&quot;</strong> to synthesize completeness metrics,
                  failing rule validations, and statistical outliers into clear executive insights.
                </p>
              </div>
            </div>
          </CardContent>
        )}

        {/* Loading Skeleton */}
        {loading && (
          <CardContent className="px-6 pb-6 pt-0 space-y-4">
            <div className="p-8 border rounded-lg bg-card text-center space-y-3">
              <RefreshCw className="h-7 w-7 animate-spin text-primary mx-auto" />
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  Synthesizing metrics with Google Gemini...
                </p>
                <p className="text-[11px] text-muted-foreground max-w-sm mx-auto">
                  Analyzing quality rules, completeness ratios, and Isolation Forest outliers without transmitting raw data rows.
                </p>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Populated Results View */}
      {explanation && !loading && (
        <div className="space-y-6">
          {/* Executive Summary */}
          <Card className="border shadow-sm">
            <CardHeader className="p-4 pb-2 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-primary" />
                  Executive Summary
                </CardTitle>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {new Date(explanation.generated_at).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                {explanation.summary}
              </p>
            </CardContent>
          </Card>

          {/* Reliability Score Reason */}
          <Card className="border shadow-sm border-primary/20 bg-primary/[0.02]">
            <CardHeader className="p-4 pb-2 border-b bg-muted/20">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                Why This Reliability Score?
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-5">
              <p className="text-xs sm:text-sm text-foreground leading-relaxed">
                {explanation.reliability_explanation}
              </p>
            </CardContent>
          </Card>

          {/* Key Issues Breakdown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-primary" />
                Key Detected Issues ({explanation.key_issues.length})
              </h3>
              <span className="text-[11px] text-muted-foreground">
                Ranked by potential analytical impact
              </span>
            </div>

            {explanation.key_issues.length === 0 ? (
              <Card className="border shadow-sm p-4 text-center text-xs text-muted-foreground">
                No major data quality or reliability defects were flagged by AI.
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {explanation.key_issues.map((issue: AIKeyIssue, index: number) => {
                  const badge = getSeverityBadge(issue.severity);
                  return (
                    <Card key={index} className="border shadow-sm flex flex-col justify-between">
                      <CardHeader className="p-4 pb-2 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-xs font-bold text-foreground">
                            {issue.title}
                          </h4>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border uppercase tracking-wider font-mono shrink-0 ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-1">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {issue.explanation}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actionable Recommendations */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Actionable Recommendations
            </h3>

            {explanation.recommendations.length === 0 ? (
              <Card className="border shadow-sm p-4 text-center text-xs text-muted-foreground">
                No immediate remediation actions required.
              </Card>
            ) : (
              <Card className="border shadow-sm divide-y">
                {explanation.recommendations.map((rec: string, index: number) => (
                  <div
                    key={index}
                    className="p-3.5 flex items-start gap-3 hover:bg-muted/30 transition-colors"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                      {index + 1}
                    </span>
                    <div className="space-y-0.5">
                      <p className="text-xs text-foreground leading-relaxed">{rec}</p>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </div>

          {/* Privacy & Trust Disclaimer Notice */}
          <div className="rounded-lg border bg-muted/20 p-3.5 text-xs text-muted-foreground flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Info className="h-3.5 w-3.5 text-primary shrink-0" />
              <span>
                AI explanations are generated from DataTrust&apos;s calculated quality metrics and do not directly analyze the uploaded file.
              </span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground shrink-0 uppercase tracking-wider">
              Gemini 2.5 Flash
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
