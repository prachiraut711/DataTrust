export type QualityRuleType =
  | "not_null"
  | "unique"
  | "numeric_range"
  | "allowed_values"
  | "email_format"
  | "no_future_dates";

export type QualityRuleStatus = "PASS" | "FAIL" | "SKIPPED";

export interface QualityRule {
  id: string;
  dataset_id: string;
  column_name: string;
  rule_type: QualityRuleType;
  rule_name: string;
  configuration: Record<string, any>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface QualityRuleCreate {
  column_name: string;
  rule_type: string;
  rule_name: string;
  configuration?: Record<string, any>;
  enabled?: boolean;
}

export interface QualityRuleUpdate {
  rule_name?: string;
  configuration?: Record<string, any>;
  enabled?: boolean;
}

export interface QualityRuleResult {
  rule_id: string;
  rule_name: string;
  rule_type: string;
  column_name: string;
  status: QualityRuleStatus;
  total_rows: number;
  passed_rows: number;
  failed_rows: number;
  failure_percentage: number;
  message: string;
  duplicate_count?: number | null;
}

export interface QualitySummary {
  total_rules: number;
  passed_rules: number;
  failed_rules: number;
  skipped_rules: number;
  total_rows: number;
  total_issues: number;
  quality_score: number;
}

export interface QualityEvaluationResponse {
  summary: QualitySummary;
  results: QualityRuleResult[];
}
