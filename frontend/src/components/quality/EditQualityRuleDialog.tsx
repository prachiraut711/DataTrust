import React, { useState, useEffect } from "react";
import { Edit2, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateQualityRuleApi } from "@/services/api";
import type { QualityRule, QualityRuleUpdate } from "@/types/quality";

interface EditQualityRuleDialogProps {
  token: string;
  datasetId: string;
  rule: QualityRule | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditQualityRuleDialog: React.FC<EditQualityRuleDialogProps> = ({
  token,
  datasetId,
  rule,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [ruleName, setRuleName] = useState<string>("");
  const [enabled, setEnabled] = useState<boolean>(true);
  const [minVal, setMinVal] = useState<string>("");
  const [maxVal, setMaxVal] = useState<string>("");
  const [allowedValuesInput, setAllowedValuesInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (rule) {
      setRuleName(rule.rule_name);
      setEnabled(rule.enabled);
      if (rule.rule_type === "numeric_range") {
        setMinVal(rule.configuration?.min !== undefined && rule.configuration?.min !== null ? String(rule.configuration.min) : "");
        setMaxVal(rule.configuration?.max !== undefined && rule.configuration?.max !== null ? String(rule.configuration.max) : "");
      } else if (rule.rule_type === "allowed_values") {
        const list = rule.configuration?.allowed_values || [];
        setAllowedValuesInput(list.join(", "));
      }
    }
  }, [rule]);

  if (!isOpen || !rule) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ruleName.trim()) {
      setError("Rule name cannot be empty.");
      return;
    }

    const config: Record<string, any> = {};

    if (rule.rule_type === "numeric_range") {
      const minNum = minVal.trim() !== "" ? parseFloat(minVal) : null;
      const maxNum = maxVal.trim() !== "" ? parseFloat(maxVal) : null;

      if (minNum === null && maxNum === null) {
        setError("Numeric Range rule requires at least a minimum or maximum bound.");
        return;
      }
      if (minNum !== null && isNaN(minNum)) {
        setError("Minimum bound must be a valid number.");
        return;
      }
      if (maxNum !== null && isNaN(maxNum)) {
        setError("Maximum bound must be a valid number.");
        return;
      }
      if (minNum !== null && maxNum !== null && minNum > maxNum) {
        setError(`Minimum (${minNum}) cannot be greater than Maximum (${maxNum}).`);
        return;
      }
      if (minNum !== null) config.min = minNum;
      if (maxNum !== null) config.max = maxNum;
    } else if (rule.rule_type === "allowed_values") {
      const items = allowedValuesInput
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      if (items.length === 0) {
        setError("Please enter at least one allowed value (comma-separated).");
        return;
      }
      config.allowed_values = items;
    }

    const payload: QualityRuleUpdate = {
      rule_name: ruleName.trim(),
      configuration: Object.keys(config).length > 0 ? config : rule.configuration,
      enabled: enabled,
    };

    setLoading(true);
    try {
      await updateQualityRuleApi(token, datasetId, rule.id, payload);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update quality rule.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Edit2 className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">
              Edit Quality Rule
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-muted-foreground">Target Column & Type</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-foreground px-2 py-1 rounded bg-muted">
                {rule.column_name}
              </span>
              <span className="px-2 py-1 rounded text-[11px] font-mono bg-primary/10 text-primary uppercase font-medium">
                {rule.rule_type}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Rule Name</label>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Conditional Numeric Range editing */}
          {rule.rule_type === "numeric_range" && (
            <div className="p-3 rounded-lg border bg-muted/20 space-y-3">
              <span className="font-semibold text-foreground block">
                Numeric Range Boundaries
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Minimum Bound</label>
                  <input
                    type="number"
                    step="any"
                    value={minVal}
                    onChange={(e) => setMinVal(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-muted-foreground">Maximum Bound</label>
                  <input
                    type="number"
                    step="any"
                    value={maxVal}
                    onChange={(e) => setMaxVal(e.target.value)}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Conditional Allowed Values editing */}
          {rule.rule_type === "allowed_values" && (
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
              <label className="font-semibold text-foreground block">
                Permitted Values (Comma-Separated)
              </label>
              <textarea
                value={allowedValuesInput}
                onChange={(e) => setAllowedValuesInput(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-input bg-background p-2 text-xs font-mono"
              />
            </div>
          )}

          {/* Enabled Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="editEnableRule"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="editEnableRule" className="text-xs font-medium text-foreground cursor-pointer">
              Enabled (included in evaluation runs)
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
