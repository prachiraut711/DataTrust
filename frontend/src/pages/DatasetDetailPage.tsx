import { useEffect, useState, useMemo } from "react";
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
  Copy,
  Sparkles,
  Layers,
  CheckCircle,
  BarChart2,
  ShieldCheck,
  Award,
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
import {
  deleteDatasetApi,
  getDatasetDetailApi,
  getDatasetProfileApi,
  getQualityRunsApi,
} from "@/services/api";
import type { DatasetDetail } from "@/types/dataset";
import type { DatasetProfileResponse } from "@/types/profile";
import type { QualityRun } from "@/types/qualityRun";
import { MissingValuesChart } from "@/components/profiling/MissingValuesChart";
import { ColumnProfileInspector } from "@/components/profiling/ColumnProfileInspector";
import { QualityRulesSection } from "@/components/quality/QualityRulesSection";
import { ReliabilityOverview } from "@/components/reliability/ReliabilityOverview";
import { AnomalyDetectionSection } from "@/components/anomaly/AnomalyDetectionSection";
import { ReliabilityTrendChart } from "@/components/history/ReliabilityTrendChart";
import { QualityRunHistory } from "@/components/history/QualityRunHistory";
import { AIQualityExplanation } from "@/components/ai/AIQualityExplanation";

export function DatasetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();

  const [dataset, setDataset] = useState<DatasetDetail | null>(null);
  const [profile, setProfile] = useState<DatasetProfileResponse | null>(null);
  const [selectedColumnName, setSelectedColumnName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"profiling" | "quality" | "reliability">("profiling");
  const [runs, setRuns] = useState<QualityRun[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const fetchQualityRuns = async () => {
    if (!token || !id) return;
    try {
      const runsData = await getQualityRunsApi(token, id);
      setRuns(runsData);
    } catch {
      // Keep existing runs state on minor network error
    }
  };

  const fetchDatasetAndProfile = async (isManualRefresh: boolean = false) => {
    if (!token || !id) return;
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      // Fetch dataset metadata, detailed statistical profile, and historical runs in parallel
      const [datasetData, profileData, runsData] = await Promise.all([
        getDatasetDetailApi(token, id),
        getDatasetProfileApi(token, id),
        getQualityRunsApi(token, id).catch(() => []),
      ]);

      setDataset(datasetData);
      setProfile(profileData);
      setRuns(runsData);

      // Default select the first column if none selected
      if (!selectedColumnName && profileData.columns.length > 0) {
        setSelectedColumnName(profileData.columns[0].column_name);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dataset details or profile.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDatasetAndProfile();
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

  // Resolve currently selected column
  const selectedColumn = useMemo(() => {
    if (!profile) return null;
    return (
      profile.columns.find((c) => c.column_name === selectedColumnName) ||
      profile.columns[0] ||
      null
    );
  }, [profile, selectedColumnName]);

  if (loading) {
    return (
      <div className="container py-24 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground font-medium">
          Profiling dataset and calculating statistical distributions with DuckDB...
        </p>
      </div>
    );
  }

  if (error || !dataset || !profile) {
    return (
      <div className="container py-16 max-w-xl text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertCircle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold">Failed to Load Profile</h2>
        <p className="text-xs text-muted-foreground">{error || "Dataset or profile not accessible."}</p>
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => fetchDatasetAndProfile(false)} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </Button>
          <Link to="/datasets">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Datasets
            </Button>
          </Link>
        </div>
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
      {/* Header and Actions */}
      <div className="space-y-4 border-b pb-6">
        <div className="flex items-center justify-between">
          <Link
            to="/datasets"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Datasets
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDatasetAndProfile(true)}
              disabled={refreshing}
              className="text-xs gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Re-profiling..." : "Refresh Profile"}
            </Button>
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

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              AI Diagnostics Active
            </span>
          </div>
        </div>
      </div>

      {/* Feature Navigation Tabs */}
      <div className="flex items-center gap-1 border-b">
        <button
          onClick={() => setActiveTab("profiling")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "profiling"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart2 className="h-4 w-4" />
          Statistical Profiling
        </button>
        <button
          onClick={() => setActiveTab("quality")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "quality"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Data Quality Rules
        </button>
        <button
          onClick={() => setActiveTab("reliability")}
          className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "reliability"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <Award className="h-4 w-4" />
          Reliability & Anomalies
        </button>
      </div>

      {/* Tab 1: Statistical Profiling */}
      {activeTab === "profiling" && (
        <div className="space-y-8">
          {/* Dataset Summary KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Records */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[11px] flex items-center gap-1.5 font-medium">
              <Hash className="h-3.5 w-3.5 text-primary" />
              Total Records
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-foreground">
              {profile.total_rows.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Rows analyzed</p>
          </CardContent>
        </Card>

        {/* Total Columns */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[11px] flex items-center gap-1.5 font-medium">
              <Columns3 className="h-3.5 w-3.5 text-primary" />
              Total Columns
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-foreground">
              {profile.total_columns}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
              {profile.numeric_columns} num · {profile.categorical_columns} cat · {profile.date_columns} date
            </p>
          </CardContent>
        </Card>

        {/* Missing Values */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[11px] flex items-center gap-1.5 font-medium">
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              Missing Values
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className={`text-2xl font-bold ${profile.total_missing_values > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
              {profile.total_missing_values.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {profile.missing_value_percentage}% overall null rate
            </p>
          </CardContent>
        </Card>

        {/* Duplicate Rows */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-[11px] flex items-center gap-1.5 font-medium">
              <Copy className="h-3.5 w-3.5 text-primary" />
              Duplicate Rows
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className={`text-2xl font-bold ${profile.duplicate_rows > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
              {profile.duplicate_rows.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {profile.duplicate_row_percentage}% identical rows
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Meta Badges */}
      <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/20 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <HardDrive className="h-3.5 w-3.5 text-primary" />
          <span>Size: <strong className="text-foreground">{formatFileSize(profile.file_size)}</strong></span>
        </div>
        <span className="text-muted-foreground">•</span>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
          <span>Unique Columns: <strong className="text-foreground">{profile.unique_value_columns}</strong> (100% distinct)</span>
        </div>
        <span className="text-muted-foreground">•</span>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 text-primary" />
          <span>Ingested: <strong className="text-foreground">{uploadedDate}</strong></span>
        </div>
      </div>

      {/* Missing Values Chart */}
      <MissingValuesChart columns={profile.columns} />

      {/* Interactive Column Inspector and Schema Table */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Column Profiles & Schema
          </h2>
          <p className="text-xs text-muted-foreground">
            Select any column in the table to inspect its statistical distributions, quantiles, and frequencies.
          </p>
        </div>

        {/* Selected Column Detail Panel */}
        {selectedColumn && (
          <ColumnProfileInspector
            column={selectedColumn}
            totalRows={profile.total_rows}
          />
        )}

        {/* Columns Overview Table */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" />
                Discovered Columns ({profile.columns.length})
              </CardTitle>
              <span className="text-[11px] text-muted-foreground">
                Click a row to inspect
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b bg-muted/30 text-muted-foreground font-mono uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">#</th>
                    <th className="py-2.5 px-4 font-semibold">Column</th>
                    <th className="py-2.5 px-4 font-semibold">Type</th>
                    <th className="py-2.5 px-4 font-semibold">Category</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Null %</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Distinct</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Unique %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {profile.columns.map((col, idx) => {
                    const isSelected = selectedColumn?.column_name === col.column_name;
                    const hasNulls = col.null_count > 0;
                    return (
                      <tr
                        key={col.column_name}
                        onClick={() => setSelectedColumnName(col.column_name)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-primary/10 border-l-4 border-primary font-medium"
                            : "hover:bg-muted/30"
                        }`}
                      >
                        <td className="py-2.5 px-4 font-mono text-muted-foreground text-[11px]">
                          {idx + 1}
                        </td>
                        <td className="py-2.5 px-4 font-medium font-mono text-foreground">
                          {col.column_name}
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-muted text-foreground">
                            {col.data_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase font-mono ${
                              col.inferred_category === "numeric"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : col.inferred_category === "categorical"
                                ? "bg-purple-500/10 text-purple-600 dark:text-purple-400"
                                : col.inferred_category === "date"
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {col.inferred_category}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono">
                          <span
                            className={
                              hasNulls
                                ? "text-amber-600 dark:text-amber-400 font-semibold"
                                : "text-muted-foreground"
                            }
                          >
                            {col.null_percentage}% ({col.null_count})
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-medium text-foreground">
                          {col.distinct_count.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-muted-foreground">
                          {col.unique_percentage}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
        </div>
      )}

      {/* Tab 2: Data Quality Rules Engine */}
      {activeTab === "quality" && token && (
        <QualityRulesSection
          token={token}
          datasetId={id!}
          columns={profile.columns}
          totalRows={profile.total_rows}
        />
      )}

      {/* Tab 3: Reliability Score, Historical Trends, and Anomaly Detection */}
      {activeTab === "reliability" && token && dataset && (
        <div className="space-y-8">
          <ReliabilityOverview
            token={token}
            datasetId={id!}
            datasetName={dataset.name}
            onRunCreated={fetchQualityRuns}
          />

          {/* Historical Reliability Trend Line Chart */}
          <div className="border-t pt-8">
            <ReliabilityTrendChart runs={runs} />
          </div>

          {/* Historical Quality Runs Table */}
          {runs.length > 0 && (
            <div className="pt-2">
              <QualityRunHistory runs={runs} />
            </div>
          )}

          {/* AI-Powered Quality & Reliability Explanation */}
          <div className="border-t pt-8">
            <AIQualityExplanation
              token={token}
              datasetId={id!}
              datasetName={dataset.name}
            />
          </div>

          {/* Unsupervised Anomaly Detection Section */}
          <div className="border-t pt-8">
            <AnomalyDetectionSection
              token={token}
              datasetId={id!}
            />
          </div>
        </div>
      )}

      {/* Analytical Roadmap Notice */}
      <Card className="border border-dashed bg-muted/10">
        <CardHeader className="p-4 pb-2">
          <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
            <Sparkles className="h-4 w-4" />
            Verification Capabilities
          </div>
          <CardTitle className="text-sm font-semibold">
            End-to-End Reliability Stack Active
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-1 space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Full data verification pipeline is active (JWT Authentication, CSV/Parquet Ingestion, DuckDB Profiling, Quality Rules Engine, 0–100 Reliability Score, Isolation Forest Outliers, Historical Quality Tracking, Gemini AI Diagnostics, and SaaS Workspace Analytics).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

