export interface DatasetColumn {
  id: string;
  dataset_id: string;
  column_name: string;
  data_type: string;
  null_count: number;
  null_percentage: number;
  distinct_count: number;
  created_at: string;
}

export interface Dataset {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  original_filename: string;
  stored_filename: string;
  file_format: string;
  file_size: number;
  row_count: number | null;
  column_count: number | null;
  uploaded_at: string;
  updated_at: string;
}

export interface DatasetDetail extends Dataset {
  columns: DatasetColumn[];
}
