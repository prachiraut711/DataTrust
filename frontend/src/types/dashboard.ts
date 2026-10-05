export interface ReliabilityDistribution {
  excellent: number;
  good: number;
  fair: number;
  poor: number;
}

export interface DashboardDatasetItem {
  dataset_id: string;
  name: string;
  file_format: string;
  row_count: number | null;
  column_count: number | null;
  reliability_score: number | null;
  reliability_level: "Excellent" | "Good" | "Fair" | "Poor" | null;
  quality_score: number | null;
  completeness_score: number | null;
  anomaly_score: number | null;
  anomaly_percentage: number | null;
  last_run_at: string | null;
  has_runs: boolean;
}

export interface DashboardRecentActivityItem {
  run_id: string;
  dataset_id: string;
  dataset_name: string;
  reliability_score: number;
  reliability_level: "Excellent" | "Good" | "Fair" | "Poor";
  quality_score: number;
  completeness_score: number;
  anomaly_score: number;
  created_at: string;
  notes: string | null;
}

export interface DashboardSummaryResponse {
  total_datasets: number;
  average_reliability: number | null;
  datasets_needing_attention: number;
  recent_runs: number;
  reliability_distribution: ReliabilityDistribution;
  datasets: DashboardDatasetItem[];
  recent_activity: DashboardRecentActivityItem[];
  needs_attention: DashboardDatasetItem[];
}
