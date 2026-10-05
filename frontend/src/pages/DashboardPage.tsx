import { useEffect, useState } from "react";
import {
  FileSpreadsheet,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Server,
  RefreshCw,
  FolderGit2,
  Database,
  ArrowUpRight,
  Layers,
  Mail,
  Calendar,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { checkBackendHealth, type HealthResponse } from "@/services/api";
import { useAuth } from "@/context/AuthContext";

export function DashboardPage() {
  const { user, activeWorkspace } = useAuth();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await checkBackendHealth();
      setHealth(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to connect to backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const pipelineCards = [
    {
      title: "Uploaded Datasets",
      icon: FileSpreadsheet,
      status: "Awaiting Phase 3",
      detail: "CSV and Parquet file upload with local/S3-compatible storage abstraction.",
    },
    {
      title: "DuckDB Profiling",
      icon: Cpu,
      status: "Awaiting Phase 4",
      detail: "High-speed analytical schema discovery, null distributions, and quantiles.",
    },
    {
      title: "Quality Suite",
      icon: CheckCircle2,
      status: "Awaiting Phase 5",
      detail: "Configurable assertions, rule pass-rates, and multi-column integrity checks.",
    },
    {
      title: "Anomaly Isolation",
      icon: AlertTriangle,
      status: "Awaiting Phase 7",
      detail: "Scikit-learn Isolation Forest unsupervised detection for multivariate outliers.",
    },
  ];

  const formattedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : "Active";

  return (
    <div className="container py-8 space-y-8 max-w-7xl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Platform Dashboard
            </h1>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Phase 2 Active
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Authenticated workspace session, health metrics, and pipeline readiness.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchHealth}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh Health
          </Button>
        </div>
      </div>

      {/* Authenticated Workspace & User Identity Card */}
      <Card className="border bg-card shadow-sm">
        <CardHeader className="pb-3 border-b bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserCheck className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold text-foreground">
                  {user?.full_name}
                </CardTitle>
                <CardDescription className="text-xs flex items-center gap-1.5 mt-0.5">
                  <Mail className="h-3 w-3 text-muted-foreground" />
                  {user?.email}
                </CardDescription>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-md border bg-background px-3 py-1 text-xs">
                <Layers className="h-3.5 w-3.5 text-primary" />
                <span className="text-muted-foreground">Workspace:</span>
                <span className="font-semibold text-foreground">
                  {activeWorkspace?.name || "Default Workspace"}
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="rounded-md border bg-background p-3 space-y-1">
            <span className="text-muted-foreground uppercase font-mono text-[10px]">
              Active Workspace ID
            </span>
            <div className="font-mono text-foreground truncate text-[11px]">
              {activeWorkspace?.id || "N/A"}
            </div>
          </div>

          <div className="rounded-md border bg-background p-3 space-y-1">
            <span className="text-muted-foreground uppercase font-mono text-[10px]">
              User ID
            </span>
            <div className="font-mono text-foreground truncate text-[11px]">
              {user?.id || "N/A"}
            </div>
          </div>

          <div className="rounded-md border bg-background p-3 space-y-1">
            <span className="text-muted-foreground uppercase font-mono text-[10px] flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              Member Since
            </span>
            <div className="font-medium text-foreground text-[11px] mt-0.5">
              {formattedDate}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Backend API Health Status Indicator */}
      <Card className="border bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">
                Backend System Status
              </CardTitle>
            </div>
            {loading ? (
              <span className="text-xs font-mono text-muted-foreground flex items-center gap-1.5">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Checking API...
              </span>
            ) : health ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Connected: {health.service}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Backend Offline (Local Dev)
              </span>
            )}
          </div>
          <CardDescription className="text-xs">
            Direct verification of <code className="text-foreground font-mono">GET /api/health</code> endpoint.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-xs text-muted-foreground">Pinging FastAPI service...</p>
          ) : health ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-[11px] text-muted-foreground uppercase font-mono">Status</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{health.status}</div>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-[11px] text-muted-foreground uppercase font-mono">Service Name</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">{health.service}</div>
              </div>
              <div className="rounded-md border bg-muted/20 p-3">
                <div className="text-[11px] text-muted-foreground uppercase font-mono">FastAPI Router</div>
                <div className="text-sm font-semibold text-foreground mt-0.5">/api/health</div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="text-amber-600 dark:text-amber-400 font-medium">
                {error || "Could not reach FastAPI server at http://localhost:8000."}
              </p>
              <p>
                Start the backend server using{" "}
                <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-foreground">
                  uvicorn app.main:app --reload
                </code>{" "}
                inside the <code className="font-mono text-foreground">backend/</code> directory.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subsystem Readiness Matrix */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Pipeline Subsystem Readiness
          </h2>
          <span className="text-xs text-muted-foreground">
            Modular components scheduled for sequential implementation
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pipelineCards.map((card, idx) => {
            const Icon = card.icon;
            return (
              <Card key={idx} className="border bg-card/60">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-foreground">
                      <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-muted/80 text-muted-foreground">
                      {card.status}
                    </span>
                  </div>
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {card.detail}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Clean Workspace Shell Information */}
      <Card className="border border-dashed bg-muted/10">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FolderGit2 className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              Phase 2: Authentication & Workspace Layer Active
            </CardTitle>
          </div>
          <CardDescription className="text-xs">
            User credentials, workspace provisioning, and JWT sessions are secured in PostgreSQL.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Phase 3 will add dataset file upload (CSV / Parquet), sanitized storage, and dataset metadata registration linked to your workspace.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
              <Database className="h-3.5 w-3.5" />
              Users & Workspaces Migrated with Alembic
              <ArrowUpRight className="h-3 w-3" />
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
