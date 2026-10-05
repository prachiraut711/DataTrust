import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileSpreadsheet,
  UploadCloud,
  RefreshCw,
  Trash2,
  Eye,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { deleteDatasetApi, getDatasetsApi } from "@/services/api";
import type { Dataset, DatasetDetail } from "@/types/dataset";
import { UploadDatasetDialog } from "@/components/UploadDatasetDialog";

export function DatasetsPage() {
  const { token } = useAuth();

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchDatasets = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getDatasetsApi(token);
      setDatasets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load datasets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDatasets();
  }, [token]);

  const handleUploadSuccess = (newDataset: DatasetDetail) => {
    setIsUploadOpen(false);
    setDatasets((prev) => [newDataset, ...prev]);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete dataset "${name}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(id);
    try {
      await deleteDatasetApi(token, id);
      setDatasets((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete dataset.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="container py-8 space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Datasets
            </h1>
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {datasets.length} Total
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Upload and monitor the reliability of your data.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDatasets}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => setIsUploadOpen(true)}
            className="gap-2 shadow-sm"
          >
            <UploadCloud className="h-4 w-4" />
            Upload Dataset
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center justify-between rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-xs text-destructive">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="outline" size="sm" onClick={fetchDatasets}>
            Retry
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Loading datasets...</p>
        </div>
      ) : datasets.length === 0 ? (
        /* Empty state */
        <Card className="border border-dashed bg-muted/10 text-center py-16">
          <CardContent className="space-y-4 max-w-md mx-auto">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <FileSpreadsheet className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-foreground">No datasets yet</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Upload your first CSV or Parquet dataset to start analyzing data quality.
              </p>
            </div>
            <div className="pt-2">
              <Button onClick={() => setIsUploadOpen(true)} className="gap-2">
                <UploadCloud className="h-4 w-4" />
                Upload Dataset
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Datasets Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {datasets.map((dataset) => {
            const isDeleting = deletingId === dataset.id;
            const dateStr = new Date(dataset.uploaded_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            });

            return (
              <Card
                key={dataset.id}
                className="flex flex-col justify-between border hover:border-foreground/20 transition-all shadow-sm"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                        {dataset.file_format}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 pt-2">
                    <CardTitle className="text-base truncate" title={dataset.name}>
                      {dataset.name}
                    </CardTitle>
                    <p
                      className="text-xs font-mono text-muted-foreground truncate"
                      title={dataset.original_filename}
                    >
                      {dataset.original_filename}
                    </p>
                  </div>
                  {dataset.description && (
                    <CardDescription className="text-xs line-clamp-2 pt-1">
                      {dataset.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="space-y-3 pb-3">
                  {/* Metrics bar */}
                  <div className="grid grid-cols-3 gap-2 rounded-md bg-muted/40 p-2.5 text-center text-xs">
                    <div>
                      <div className="text-[10px] uppercase font-mono text-muted-foreground">
                        Rows
                      </div>
                      <div className="font-semibold text-foreground mt-0.5">
                        {dataset.row_count?.toLocaleString() ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-mono text-muted-foreground">
                        Cols
                      </div>
                      <div className="font-semibold text-foreground mt-0.5">
                        {dataset.column_count?.toLocaleString() ?? "—"}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase font-mono text-muted-foreground">
                        Size
                      </div>
                      <div className="font-semibold text-foreground mt-0.5">
                        {formatFileSize(dataset.file_size)}
                      </div>
                    </div>
                  </div>

                  {/* Readiness status */}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                    <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Ready for analysis
                    </span>
                    <span className="flex items-center gap-1 font-mono">
                      <Calendar className="h-3 w-3" />
                      {dateStr}
                    </span>
                  </div>
                </CardContent>

                <CardFooter className="pt-2 border-t flex items-center justify-between gap-2">
                  <Link to={`/datasets/${dataset.id}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs">
                      <Eye className="h-3.5 w-3.5" />
                      View Schema
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isDeleting}
                    onClick={() => handleDelete(dataset.id, dataset.name)}
                    className="h-8 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Delete dataset"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Upload Dialog Modal */}
      <UploadDatasetDialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}
