import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  HardDrive,
  Hash,
  Columns3,
  RefreshCw,
  Trash2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { deleteDatasetApi, getDatasetDetailApi } from "@/services/api";
import type { DatasetDetail } from "@/types/dataset";

export function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [dataset, setDataset] = useState<DatasetDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const fetchDetail = async () => {
    if (!token || !id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getDatasetDetailApi(token, id);
      setDataset(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dataset details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id, token]);

  const handleDelete = async () => {
    if (!token || !id || !dataset) return;
    if (
      !window.confirm(
        `Are you sure you want to delete dataset "${dataset.name}"? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      await deleteDatasetApi(token, id);
      navigate("/datasets", { replace: true });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete dataset.");
      setDeleting(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  if (loading) {
    return (
      <div className="container py-20 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">Loading dataset details...</p>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="container py-12 max-w-xl text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold">Failed to Load Dataset</h2>
        <p className="text-xs text-muted-foreground">{error || "Dataset not found."}</p>
        <Link to="/datasets">
          <Button variant="outline" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Datasets
          </Button>
        </Link>
      </div>
    );
  }

  const uploadedDate = new Date(dataset.uploaded_at).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="container py-8 space-y-8 max-w-7xl">
      {/* Navigation & Header */}
      <div className="space-y-4 border-b pb-6">
        <div className="flex items-center justify-between">
          <Link
            to="/datasets"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Datasets
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete Dataset
          </Button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {dataset.name}
              </h1>
              <span className="text-[11px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                {dataset.file_format}
              </span>
            </div>
            {dataset.description ? (
              <p className="text-xs text-muted-foreground">{dataset.description}</p>
            ) : (
              <p className="text-xs font-mono text-muted-foreground">
                {dataset.original_filename}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Ready for analysis
            </span>
          </div>
        </div>
      </div>

      {/* Dataset Overview Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[11px] flex items-center gap-1.5 font-medium">
              <Hash className="h-3.5 w-3.5 text-primary" />
              Total Records
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-bold text-foreground">
              {dataset.row_count?.toLocaleString() ?? "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Rows inspected</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[11px] flex items-center gap-1.5 font-medium">
              <Columns3 className="h-3.5 w-3.5 text-primary" />
              Total Columns
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-bold text-foreground">
              {dataset.column_count?.toLocaleString() ?? "—"}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Discovered features</p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[11px] flex items-center gap-1.5 font-medium">
              <HardDrive className="h-3.5 w-3.5 text-primary" />
              Storage Size
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-xl font-bold text-foreground">
              {formatFileSize(dataset.file_size)}
            </div>
            <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5" title={dataset.original_filename}>
              {dataset.original_filename}
            </p>
          </CardContent>
        </Card>

        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-[11px] flex items-center gap-1.5 font-medium">
              <Calendar className="h-3.5 w-3.5 text-primary" />
              Ingestion Timestamp
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-sm font-semibold text-foreground truncate mt-1">
              {uploadedDate}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">DuckDB verified</p>
          </CardContent>
        </Card>
      </div>

      {/* Discovered Columns Table */}
      <Card className="border shadow-sm">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-base font-semibold">
                Column Schema & Distributions
              </CardTitle>
              <CardDescription className="text-xs">
                In-memory column profiling calculated by DuckDB during ingestion.
              </CardDescription>
            </div>
            <span className="text-xs font-mono text-muted-foreground">
              {dataset.columns.length} columns found
            </span>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b bg-muted/30 text-muted-foreground font-mono uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4 font-semibold">#</th>
                  <th className="py-3 px-4 font-semibold">Column</th>
                  <th className="py-3 px-4 font-semibold">DuckDB Type</th>
                  <th className="py-3 px-4 text-right font-semibold">Nulls</th>
                  <th className="py-3 px-4 text-right font-semibold">Null %</th>
                  <th className="py-3 px-4 text-right font-semibold">Distinct Values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {dataset.columns.map((col, idx) => {
                  const hasNulls = col.null_count > 0;
                  return (
                    <tr
                      key={col.id}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono text-muted-foreground text-[11px]">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground font-mono">
                        {col.column_name}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-muted text-foreground">
                          {col.data_type}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span className={hasNulls ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-muted-foreground"}>
                          {col.null_count.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        <span
                          className={`inline-flex items-center gap-1 ${
                            hasNulls
                              ? "text-amber-600 dark:text-amber-400 font-semibold"
                              : "text-muted-foreground"
                          }`}
                        >
                          {col.null_percentage.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-foreground">
                        {col.distinct_count.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Future Engine Roadmap Placeholder */}
      <Card className="border border-dashed bg-muted/10">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
            <Sparkles className="h-4 w-4" />
            Upcoming Analytical Stages
          </div>
          <CardTitle className="text-sm font-semibold">
            Quality Analysis & Anomaly Isolation
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Quality analysis will appear here after the profiling engine is enabled in Phase 4. Automated multi-rule validation (Phase 5), composite 0–100 reliability scoring (Phase 6), and Isolation Forest anomaly detection (Phase 7) will evaluate this dataset.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
