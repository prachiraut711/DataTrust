import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Plus,
  Trash2,
  Edit2,
  ShieldCheck,
  RefreshCw,
  Sliders,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  deleteQualityRuleApi,
  evaluateQualityRulesApi,
  getQualityRulesApi,
  updateQualityRuleApi,
} from "@/services/api";
import type {
  QualityEvaluationResponse,
  QualityRule,
  QualityRuleResult,
} from "@/types/quality";
import type { ColumnProfile } from "@/types/profile";
import { CreateQualityRuleDialog } from "./CreateQualityRuleDialog";
import { EditQualityRuleDialog } from "./EditQualityRuleDialog";

interface QualityRulesSectionProps {
  token: string;
  datasetId: string;
  columns: ColumnProfile[];
  totalRows: number;
}

export const QualityRulesSection: React.FC<QualityRulesSectionProps> = ({
  token,
  datasetId,
  columns,
  totalRows,
}) => {
  const [rules, setRules] = useState<QualityRule[]>([]);
  const [loadingRules, setLoadingRules] = useState<boolean>(true);
  const [evaluation, setEvaluation] = useState<QualityEvaluationResponse | null>(null);
  const [evaluating, setEvaluating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [editingRule, setEditingRule] = useState<QualityRule | null>(null);

  const fetchRules = async () => {
    setLoadingRules(true);
    setError(null);
    try {
      const data = await getQualityRulesApi(token, datasetId);
      setRules(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load quality rules.");
    } finally {
      setLoadingRules(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, [token, datasetId]);

  const handleRunEvaluation = async () => {
    setEvaluating(true);
    setError(null);
    try {
      const result = await evaluateQualityRulesApi(token, datasetId);
      setEvaluation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to execute quality evaluation.");
    } finally {
      setEvaluating(false);
    }
  };

  const handleToggleEnabled = async (rule: QualityRule) => {
    try {
      const updated = await updateQualityRuleApi(token, datasetId, rule.id, {
        enabled: !rule.enabled,
      });
      setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to toggle rule.");
    }
  };

  const handleDeleteRule = async (ruleId: string, ruleName: string) => {
    if (!window.confirm(`Are you sure you want to delete rule "${ruleName}"?`)) return;
    try {
      await deleteQualityRuleApi(token, datasetId, ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      if (evaluation) {
        setEvaluation((prev) =>
          prev
            ? {
                ...prev,
                results: prev.results.filter((res) => res.rule_id !== ruleId),
              }
            : null
        );
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete rule.");
    }
  };

  // Map result by rule_id for quick badge lookups
  const resultMap = new Map<string, QualityRuleResult>();
  if (evaluation) {
    for (const res of evaluation.results) {
      resultMap.set(res.rule_id, res);
    }
  }

  // Format configuration object into readable string
  const formatConfig = (rule: QualityRule): string => {
    const cfg = rule.configuration || {};
    if (rule.rule_type === "numeric_range") {
      if (cfg.min !== undefined && cfg.max !== undefined) {
        return `[${cfg.min}, ${cfg.max}]`;
      } else if (cfg.min !== undefined) {
        return `>= ${cfg.min}`;
      } else if (cfg.max !== undefined) {
        return `<= ${cfg.max}`;
      }
    } else if (rule.rule_type === "allowed_values") {
      const items = cfg.allowed_values || [];
      return items.slice(0, 3).join(", ") + (items.length > 3 ? ` +${items.length - 3} more` : "");
    }
    return "Standard assertion";
  };

  const score = evaluation?.summary.quality_score ?? 100;
  const scoreColor =
    !evaluation
      ? "text-foreground"
      : score >= 80
      ? "text-emerald-600 dark:text-emerald-400"
      : score >= 50
      ? "text-amber-600 dark:text-amber-400"
      : "text-destructive";

  return (
    <div className="space-y-6">
      {/* Top Action Bar & Summary Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Data Quality Rules Engine
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure column validation assertions evaluated dynamically with DuckDB against the raw dataset.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsCreateOpen(true)}
            className="text-xs gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Quality Rule
          </Button>

          <Button
            size="sm"
            onClick={handleRunEvaluation}
            disabled={evaluating || rules.length === 0}
            className="text-xs gap-1.5"
          >
            <Play className={`h-3.5 w-3.5 ${evaluating ? "animate-spin" : ""}`} />
            {evaluating ? "Evaluating in DuckDB..." : "Run Quality Checks"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Quality Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Quality Score Card */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[11px] font-medium flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              Quality Score
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className={`text-2xl font-bold font-mono ${scoreColor}`}>
              {evaluation ? `${score.toFixed(1)}%` : "Not Evaluated"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {evaluation
                ? `${evaluation.summary.passed_rules} of ${
                    evaluation.summary.passed_rules + evaluation.summary.failed_rules
                  } applicable passed`
                : "Run checks to score dataset"}
            </p>
          </CardContent>
        </Card>

        {/* Total Rules */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[11px] font-medium flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-primary" />
              Configured Rules
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-foreground">
              {rules.length}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {rules.filter((r) => r.enabled).length} enabled assertions
            </p>
          </CardContent>
        </Card>

        {/* Passed vs Failed Checks */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[11px] font-medium flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              Passed / Failed Checks
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="flex items-center gap-3 text-lg font-bold mt-0.5">
              <span className="text-emerald-600 dark:text-emerald-400">
                ✓ {evaluation ? evaluation.summary.passed_rules : "—"}
              </span>
              <span className="text-destructive">
                ✕ {evaluation ? evaluation.summary.failed_rules : "—"}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {evaluation?.summary.skipped_rules ? `${evaluation.summary.skipped_rules} skipped (incompatible)` : "All rules evaluated"}
            </p>
          </CardContent>
        </Card>

        {/* Total Quality Issues */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[11px] font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
              Total Violating Rows
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className={`text-2xl font-bold ${evaluation && evaluation.summary.total_issues > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
              {evaluation ? evaluation.summary.total_issues.toLocaleString() : "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Out of {totalRows.toLocaleString()} rows inspected
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quality Issues Highlights (if failed checks exist) */}
      {evaluation && evaluation.summary.failed_rules > 0 && (
        <Card className="border border-destructive/30 bg-destructive/5 shadow-sm">
          <CardHeader className="p-4 pb-2 border-b border-destructive/20">
            <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Data Quality Issues Detected ({evaluation.summary.failed_rules})
            </CardTitle>
            <CardDescription className="text-xs text-destructive/80">
              The following rules failed validation when queried against the raw data.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {evaluation.results
                .filter((res) => res.status === "FAIL")
                .map((failRes) => (
                  <div
                    key={failRes.rule_id}
                    className="p-3 rounded-lg border border-destructive/20 bg-background space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-xs text-foreground font-mono">
                        {failRes.rule_name}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-destructive/10 text-destructive">
                        FAIL · {failRes.failure_percentage}%
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono flex items-center gap-2">
                      <span>Column: <strong>{failRes.column_name}</strong></span>
                      <span>•</span>
                      <span>Violations: <strong className="text-destructive">{failRes.failed_rows.toLocaleString()} rows</strong></span>
                    </div>
                    <p className="text-xs text-foreground/90 pt-0.5">
                      {failRes.message}
                    </p>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Rules Table */}
      <Card className="border shadow-sm">
        <CardHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sliders className="h-4 w-4 text-primary" />
              Validation Rules Catalog ({rules.length})
            </CardTitle>
            <span className="text-[11px] text-muted-foreground">
              Rules execute in-memory with DuckDB
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loadingRules ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <p className="text-xs">Loading quality rules...</p>
            </div>
          ) : rules.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <HelpCircle className="h-8 w-8 text-muted-foreground mx-auto" />
              <h4 className="text-sm font-semibold">No Quality Rules Configured</h4>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Define validation checks (such as required fields, unique constraints, numeric ranges, and regex) to verify dataset reliability.
              </p>
              <Button size="sm" onClick={() => setIsCreateOpen(true)} className="gap-1.5 text-xs">
                <Plus className="h-3.5 w-3.5" />
                Add First Rule
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/30 text-muted-foreground font-mono uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Status</th>
                    <th className="py-2.5 px-4 font-semibold">Rule Name</th>
                    <th className="py-2.5 px-4 font-semibold">Column</th>
                    <th className="py-2.5 px-4 font-semibold">Rule Type</th>
                    <th className="py-2.5 px-4 font-semibold">Configuration</th>
                    <th className="py-2.5 px-4 text-center font-semibold">Enabled</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rules.map((rule) => {
                    const result = resultMap.get(rule.id);
                    return (
                      <tr key={rule.id} className="hover:bg-muted/20 transition-colors">
                        {/* Status Column */}
                        <td className="py-2.5 px-4">
                          {!rule.enabled ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">
                              DISABLED
                            </span>
                          ) : !result ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-muted text-muted-foreground">
                              NOT RUN
                            </span>
                          ) : result.status === "PASS" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3" />
                              PASS
                            </span>
                          ) : result.status === "FAIL" ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-destructive/10 text-destructive border border-destructive/20 cursor-help"
                              title={`${result.failed_rows} violating rows (${result.failure_percentage}%)`}
                            >
                              <XCircle className="h-3 w-3" />
                              FAIL ({result.failed_rows})
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 cursor-help"
                              title={result.message}
                            >
                              <AlertTriangle className="h-3 w-3" />
                              SKIPPED
                            </span>
                          )}
                        </td>

                        {/* Rule Name */}
                        <td className="py-2.5 px-4 font-semibold text-foreground">
                          {rule.rule_name}
                        </td>

                        {/* Column Name */}
                        <td className="py-2.5 px-4 font-mono text-muted-foreground">
                          {rule.column_name}
                        </td>

                        {/* Rule Type */}
                        <td className="py-2.5 px-4">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-muted text-foreground uppercase">
                            {rule.rule_type}
                          </span>
                        </td>

                        {/* Configuration */}
                        <td className="py-2.5 px-4 font-mono text-[11px] text-muted-foreground truncate max-w-[160px]" title={JSON.stringify(rule.configuration)}>
                          {formatConfig(rule)}
                        </td>

                        {/* Enabled Toggle */}
                        <td className="py-2.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleEnabled(rule)}
                            className={`relative inline-flex h-4 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              rule.enabled ? "bg-primary" : "bg-muted"
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                                rule.enabled ? "translate-x-4" : "translate-x-0"
                              }`}
                            />
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingRule(rule)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                              title="Edit rule"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteRule(rule.id, rule.rule_name)}
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              title="Delete rule"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
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

      {/* Create Dialog */}
      <CreateQualityRuleDialog
        token={token}
        datasetId={datasetId}
        columns={columns}
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={fetchRules}
      />

      {/* Edit Dialog */}
      <EditQualityRuleDialog
        token={token}
        datasetId={datasetId}
        rule={editingRule}
        isOpen={!!editingRule}
        onClose={() => setEditingRule(null)}
        onSuccess={fetchRules}
      />
    </div>
  );
};
