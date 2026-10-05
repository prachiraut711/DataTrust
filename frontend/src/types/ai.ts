export type AISeverity = "high" | "medium" | "low";

export interface AIKeyIssue {
  title: string;
  explanation: string;
  severity: AISeverity;
}

export interface AIQualityExplanation {
  summary: string;
  key_issues: AIKeyIssue[];
  recommendations: string[];
  reliability_explanation: string;
  generated_at: string;
}
