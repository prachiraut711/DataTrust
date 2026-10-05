import React, { useState, useEffect } from "react";
import { Plus, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createQualityRuleApi } from "@/services/api";
import type { QualityRuleCreate, QualityRuleType } from "@/types/quality";
import type { ColumnProfile } from "@/types/profile";

interface CreateQualityRuleDialogProps {
  token: string;
  datasetId: string;
  columns: ColumnProfile[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const RULE_TYPE_OPTIONS: { label: string; value: QualityRuleType; description: string }[] = [
  {
    label: "Required (Not Null)",
    value: "not_null",
    description: "Assert that column values must not be missing or empty.",
  },
  {
    label: "Unique",
    value: "unique",
    description: "Assert that all non-null values must be distinct.",
  },
  {
    label: "Numeric Range",
    value: "numeric_range",
    description: "Assert that numbers fall within specified min and/or max bounds.",
  },
  {
    label: "Allowed Values Set",
    value: "allowed_values",
    description: "Assert that values belong to an explicit permitted category list.",
  },
  {
    label: "Email Format",
    value: "email_format",
    description: "Assert that text values conform to standard email syntax.",
  },
  {
    label: "No Future Dates",
    value: "no_future_dates",
    description: "Assert that timestamps occur in the past or present.",
  },
];

export const CreateQualityRuleDialog: React.FC<CreateQualityRuleDialogProps> = ({
  token,
  datasetId,
  columns,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const [ruleType, setRuleType] = useState<QualityRuleType>("not_null");
  const [ruleName, setRuleName] = useState<string>("");
  const [enabled, setEnabled] = useState<boolean>(true);

  // Rule specific configs
  const [minVal, setMinVal] = useState<string>("");
  const [maxVal, setMaxVal] = useState<string>("");
  const [allowedValuesInput, setAllowedValuesInput] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize selected column and name
  useEffect(() => {
    if (columns.length > 0 && !selectedColumn) {
      setSelectedColumn(columns[0].column_name);
    }
  }, [columns, selectedColumn]);

  // Auto-generate sensible rule name on column or type change
  useEffect(() => {
    if (!selectedColumn) return;
    const formatName = (col: string, type: QualityRuleType) => {
      const colTitle = col
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

      switch (type) {
        case "not_null":
          return `${colTitle} Required`;
        case "unique":
          return `${colTitle} Must Be Unique`;
        case "numeric_range":
          return `${colTitle} Numeric Range`;
        case "allowed_values":
          return `${colTitle} Permitted Values`;
        case "email_format":
          return `${colTitle} Valid Email`;
        case "no_future_dates":
          return `${colTitle} No Future Dates`;
        default:
          return `${colTitle} Check`;
      }
    };

    setRuleName(formatName(selectedColumn, ruleType));
  }, [selectedColumn, ruleType]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!ruleName.trim()) {
      setError("Please provide a name for this quality rule.");
      return;
    }

    const config: Record<string, any> = {};

    if (ruleType === "numeric_range") {
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
    } else if (ruleType === "allowed_values") {
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

    const payload: QualityRuleCreate = {
      column_name: selectedColumn,
      rule_type: ruleType,
      rule_name: ruleName.trim(),
      configuration: config,
      enabled: enabled,
    };

    setLoading(true);
    try {
      await createQualityRuleApi(token, datasetId, payload);
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create quality rule.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-xl border bg-card p-6 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            <h3 className="text-base font-semibold text-foreground">
              Add Quality Assertion Rule
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
          {/* Column Selector */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Target Column</label>
            <select
              value={selectedColumn}
              onChange={(e) => setSelectedColumn(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring font-mono"
            >
              {columns.map((col) => (
                <option key={col.column_name} value={col.column_name}>
                  {col.column_name} ({col.data_type} · {col.inferred_category})
                </option>
              ))}
            </select>
          </div>

          {/* Rule Type Selector */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Rule Type</label>
            <select
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as QualityRuleType)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {RULE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              {RULE_TYPE_OPTIONS.find((o) => o.value === ruleType)?.description}
            </p>
          </div>

          {/* Rule Name */}
          <div className="space-y-1.5">
            <label className="font-semibold text-foreground">Rule Name</label>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="e.g. Customer ID Must Be Unique"
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* Conditional Configuration: Numeric Range */}
          {ruleType === "numeric_range" && (
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
                    placeholder="Optional (e.g. 0)"
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
                    placeholder="Optional (e.g. 1000)"
                    className="w-full h-8 rounded-md border border-input bg-background px-2 text-xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Conditional Configuration: Allowed Values */}
          {ruleType === "allowed_values" && (
            <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
              <label className="font-semibold text-foreground block">
                Permitted Values (Comma-Separated)
              </label>
              <textarea
                value={allowedValuesInput}
                onChange={(e) => setAllowedValuesInput(e.target.value)}
                placeholder="e.g. Pending, Processing, Shipped, Delivered, Cancelled"
                rows={2}
                className="w-full rounded-md border border-input bg-background p-2 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Values will be matched against string-cast representations.
              </p>
            </div>
          )}

          {/* Enabled Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="enableRule"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="enableRule" className="text-xs font-medium text-foreground cursor-pointer">
              Enable this rule immediately for quality evaluations
            </label>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="gap-1.5">
              {loading ? "Saving..." : "Create Rule"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
