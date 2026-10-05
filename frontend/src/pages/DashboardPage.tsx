import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FileSpreadsheet,
  Database,
  Award,
  AlertTriangle,
  History,
  RefreshCw,
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { getDashboardSummaryApi } from "@/services/api";
import type { DashboardSummaryResponse } from "@/types/dashboard";
import { ReliabilityOverviewChart } from "@/components/dashboard/ReliabilityOverviewChart";
import { ReliabilityDistributionChart } from "@/components/dashboard/ReliabilityDistributionChart";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { NeedsAttention } from "@/components/dashboard/NeedsAttention";

export function DashboardPage() {
  const { user, activeWorkspace, token } = useAuth();
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = async (isManual = false) => {
    if (!token) return;
    if (isManual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await getDashboardSummaryApi(token);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard overview.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [token]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 75) return "text-blue-600 dark:text-blue-400";
    if (score >= 60) return "text-amber-600 dark:text-amber-400";
    return "text-rose-600 dark:text-rose-400";
  };

  // Loading Skeletons
  if (loading) {
    return (
      <div className="container py-8 space-y-8 max-w-7xl">
        <div className="space-y-2 border-b pb-6">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="h-4 w-96 bg-muted/60 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border shadow-sm p-4 space-y-3">
              <div className="h-4 w-28 bg-muted animate-pulse rounded" />
              <div className="h-8 w-20 bg-muted/80 animate-pulse rounded" />
              <div className="h-3 w-36 bg-muted/50 animate-pulse rounded" />
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="h-80 border shadow-sm p-4 bg-muted/20 animate-pulse" />
          <Card className="h-80 border shadow-sm p-4 bg-muted/20 animate-pulse" />
        </div>
      </div>
    );
  }

  // Error State
  if (error || !summary) {
    return (
      <div className="container py-16 max-w-lg text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Failed to Load Dashboard</h2>
        <p className="text-xs text-muted-foreground">{error || "Unable to reach DataTrust API."}</p>
        <Button size="sm" onClick={() => fetchSummary(true)} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" />
          Retry Loading
        </Button>
      </div>
    );
  }

  // Brand-new empty workspace state
  if (summary.total_datasets === 0) {
    return (
      <div className="container py-12 max-w-3xl space-y-8">
        <div className="border-b pb-6 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {getGreeting()}, {user?.full_name?.split(" ")[0] || "User"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome to DataTrust — your data reliability & quality monitoring workspace.
          </p>
        </div>

        <Card className="border border-dashed p-8 sm:p-12 text-center space-y-4 bg-muted/10 shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Database className="h-7 w-7" />
          </div>
          <div className="space-y-1.5 max-w-md mx-auto">
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Welcome to DataTrust
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Upload your first CSV or Parquet dataset to start calculating automated statistical profiles,
              configuring quality assertions, and tracking reliability scores.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <Link to="/datasets">
              <Button size="sm" className="gap-1.5 font-semibold shadow-sm">
                <Plus className="h-4 w-4" />
                Upload Dataset
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 space-y-8 max-w-7xl">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {getGreeting()}, {user?.full_name?.split(" ")[0] || "User"}
            </h1>
            <span className="text-[11px] font-mono font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
              {activeWorkspace?.name || "Workspace Overview"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Monitor the health, quality rules compliance, and reliability of your datasets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link to="/datasets">
            <Button size="sm" className="gap-1.5 text-xs font-semibold shadow-sm">
              <Plus className="h-3.5 w-3.5" />
              Upload Dataset
            </Button>
          </Link>
          <Link to="/datasets">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <FileSpreadsheet className="h-3.5 w-3.5" />
              View All Datasets
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchSummary(true)}
            disabled={refreshing}
            className="text-xs gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* 4 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Datasets */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-medium flex items-center justify-between text-muted-foreground">
              <span>Total Datasets</span>
              <Database className="h-4 w-4 text-primary" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-foreground font-mono">
              {summary.total_datasets}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {summary.datasets.filter((d) => d.has_runs).length} analyzed ·{" "}
              {summary.datasets.filter((d) => !d.has_runs).length} pending
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Average Reliability */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-medium flex items-center justify-between text-muted-foreground">
              <span>Average Reliability</span>
              <Award className="h-4 w-4 text-emerald-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            {summary.average_reliability !== null ? (
              <>
                <div
                  className={`text-2xl font-bold font-mono ${getScoreColor(
                    summary.average_reliability
                  )}`}
                >
                  {summary.average_reliability.toFixed(1)}
                  <span className="text-xs text-muted-foreground font-normal ml-1">/ 100</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Across latest dataset snapshots
                </p>
              </>
            ) : (
              <>
                <div className="text-xl font-bold text-muted-foreground">No runs yet</div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Run an analysis to measure score
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* KPI 3: Datasets Needing Attention */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-medium flex items-center justify-between text-muted-foreground">
              <span>Needing Attention</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div
              className={`text-2xl font-bold font-mono ${
                summary.datasets_needing_attention > 0
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-foreground"
              }`}
            >
              {summary.datasets_needing_attention}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {summary.datasets_needing_attention === 0
                ? "All analyzed datasets >= 75"
                : "Reliability score < 75"}
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Recent Runs */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-medium flex items-center justify-between text-muted-foreground">
              <span>Runs This Period</span>
              <History className="h-4 w-4 text-primary" />
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-1">
            <div className="text-2xl font-bold text-foreground font-mono">
              {summary.recent_runs}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Quality audits in the last 7 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReliabilityOverviewChart datasets={summary.datasets} />
        <ReliabilityDistributionChart distribution={summary.reliability_distribution} />
      </div>

      {/* Needs Attention Alert Section */}
      <NeedsAttention datasets={summary.needs_attention} />

      {/* Recent Activity Table Feed */}
      <RecentActivity activity={summary.recent_activity} />

      {/* Quick Action Footer Banner */}
      <Card className="border border-dashed bg-muted/10">
        <CardContent className="p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-foreground">
                Continuous Reliability Auditing
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Run automated quality checks, inspect Isolation Forest outliers, or consult Gemini AI on any dataset.
              </p>
            </div>
          </div>
          <Link to="/datasets" className="shrink-0">
            <Button size="sm" variant="outline" className="text-xs gap-1.5">
              Explore All Datasets
              <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
