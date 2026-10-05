export interface QualityComponentBreakdown {
  score: number;
  weight: number;
  weighted_score: number;
  total_rules: number;
  passed_rules: number;
  failed_rules: number;
  description: string;
}

export interface CompletenessComponentBreakdown {
  score: number;
  weight: number;
  weighted_score: number;
  missing_percentage: number;
  total_cells: number;
  missing_cells: number;
  description: string;
}

export interface AnomalyHealthComponentBreakdown {
  score: number;
  weight: number;
  weighted_score: number;
  anomaly_percentage: number;
  total_anomalies: number;
  total_numeric_values: number;
  description: string;
}

export interface ReliabilityComponents {
  quality: QualityComponentBreakdown;
  completeness: CompletenessComponentBreakdown;
  anomaly_health: AnomalyHealthComponentBreakdown;
}

export interface ReliabilityScoreResponse {
  dataset_id: string;
  dataset_name: string;
  reliability_score: number;
  reliability_level: 'Excellent' | 'Good' | 'Fair' | 'Poor';
  formula: string;
  components: ReliabilityComponents;
  calculated_at: string;
}
