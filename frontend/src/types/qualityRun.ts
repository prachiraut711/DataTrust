export interface QualityRun {
  id: string;
  dataset_id: string;
  workspace_id: string;
  created_at: string;
  row_count: number;
  column_count: number;
  quality_score: number;
  completeness_score: number;
  anomaly_score: number;
  reliability_score: number;
  anomaly_percentage: number;
  notes: string | null;
}
