import { Link } from "react-router-dom";
import {
  ShieldCheck,
  FileSpreadsheet,
  Cpu,
  CheckCircle2,
  Gauge,
  AlertTriangle,
  BrainCircuit,
  ArrowRight,
  Database,
  Layers,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function HomePage() {
  const steps = [
    {
      icon: FileSpreadsheet,
      title: "Dataset Ingestion",
      desc: "Upload CSV or Parquet files with zero cloud lock-in.",
      phase: "Ingestion",
    },
    {
      icon: Cpu,
      title: "High-Speed Profiling",
      desc: "In-memory analytical profiling powered by embedded DuckDB.",
      phase: "Profiling",
    },
    {
      icon: CheckCircle2,
      title: "Quality Validation",
      desc: "Multi-dimensional rule verification across completeness and schema.",
      phase: "Rules Engine",
    },
    {
      icon: Gauge,
      title: "Reliability Score",
      desc: "Objective 0-100 index rating dataset trust for production ML.",
      phase: "0-100 Score",
    },
    {
      icon: AlertTriangle,
      title: "Anomaly Detection",
      desc: "Isolation Forest unsupervised outlier isolation across distributions.",
      phase: "Isolation Forest",
    },
    {
      icon: BrainCircuit,
      title: "AI Diagnostics",
      desc: "Gemini-powered root cause analysis for detected quality anomalies.",
      phase: "Gemini AI",
    },
  ];

  return (
    <div className="flex flex-col gap-16 py-12 md:py-20">
      {/* Hero Section */}
      <section className="container max-w-5xl text-center space-y-6">
        <div className="inline-flex items-center gap-2 rounded-full border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" />
          Data Engineering & Science SaaS Platform
        </div>

        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl text-foreground">
          Know if your dataset is truly ready for{" "}
          <span className="text-primary">analytics and ML</span>.
        </h1>

        <p className="mx-auto max-w-2xl text-lg text-muted-foreground leading-relaxed">
          DataTrust is a focused, production-grade reliability platform that profiles,
          validates, scores, and uncovers anomalies in CSV and Parquet datasets before they
          pollute production data pipelines.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link to="/dashboard">
            <Button size="lg" className="gap-2">
              Open SaaS Dashboard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link to="/login">
            <Button variant="outline" size="lg">
              Sign In
            </Button>
          </Link>
        </div>
      </section>

      {/* Pipeline Workflow Preview */}
      <section className="container max-w-6xl space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            End-to-End Reliability Pipeline
          </h2>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            A modular engineering pipeline designed for fast analytical execution without heavy distributed frameworks.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <Card key={idx} className="relative overflow-hidden border hover:border-foreground/20 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {step.phase}
                    </span>
                  </div>
                  <CardTitle className="text-base">{step.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-xs leading-relaxed">
                    {step.desc}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Architecture Highlights */}
      <section className="container max-w-5xl">
        <Card className="bg-muted/30 border-muted">
          <CardHeader>
            <div className="flex items-center gap-2 text-primary font-semibold text-xs tracking-wider uppercase">
              <Layers className="h-4 w-4" />
              Architecture Principles
            </div>
            <CardTitle className="text-xl">Dual Database & Clean Services</CardTitle>
            <CardDescription>
              Built specifically to avoid over-engineering while delivering genuine enterprise-grade performance.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium text-sm text-foreground">
                <Database className="h-4 w-4 text-primary" />
                PostgreSQL + DuckDB
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                PostgreSQL manages tenant metadata, run histories, and users. Embedded DuckDB handles fast analytical queries directly on Parquet and CSV.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium text-sm text-foreground">
                <Terminal className="h-4 w-4 text-primary" />
                FastAPI Services
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Clean Python backend with Pydantic validation, modular service layers, and explicit type checking.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-medium text-sm text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                No Artificial Bloat
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                No unnecessary Kafka, Spark, Celery, or vector databases. Every component serves an exact, measurable purpose.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
