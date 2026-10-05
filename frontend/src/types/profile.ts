export interface TopCategoryValue {
  value: string;
  count: number;
  percentage: number;
}

export interface CategoricalStatistics {
  distinct_count: number;
  top_values: TopCategoryValue[];
  most_common_value: string | null;
}

export interface HistogramBucket {
  bucket_label: string;
  min_value: number;
  max_value: number;
  count: number;
}

export interface NumericStatistics {
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  std_dev: number | null;
  histogram: HistogramBucket[];
}

export interface DateStatistics {
  earliest_date: string | null;
  latest_date: string | null;
  future_date_count: number;
}

export type ColumnCategory = 'numeric' | 'categorical' | 'date' | 'other';

export interface ColumnProfile {
  column_name: string;
  column_index: number;
  data_type: string;
  inferred_category: ColumnCategory;
  null_count: number;
  null_percentage: number;
  distinct_count: number;
  unique_percentage: number;
  numeric_statistics: NumericStatistics | null;
  categorical_statistics: CategoricalStatistics | null;
  date_statistics: DateStatistics | null;
}

export interface DatasetProfileResponse {
  dataset_id: string;
  dataset_name: string;
  file_format: string;
  file_size: number;
  total_rows: number;
  total_columns: number;
  duplicate_rows: number;
  duplicate_row_percentage: number;
  total_missing_values: number;
  missing_value_percentage: number;
  numeric_columns: number;
  categorical_columns: number;
  date_columns: number;
  other_columns: number;
  unique_value_columns: number;
  columns: ColumnProfile[];
}
