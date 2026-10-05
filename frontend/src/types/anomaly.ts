export interface AnomalyColumnResult {
  column_name: string;
  data_type: string;
  total_values: number;
  anomaly_count: number;
  anomaly_percentage: number;
  status: 'success' | 'skipped';
  message: string | null;
  sample_anomalies: number[];
}

export interface AnomalyDetectionResponse {
  dataset_id: string;
  dataset_name: string;
  total_numeric_columns: number;
  columns_analyzed: number;
  total_anomalies: number;
  overall_anomaly_percentage: number;
  contamination: number;
  column_results: AnomalyColumnResult[];
}
