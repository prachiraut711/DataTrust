import { Outlet } from "react-router-dom";
import { Navbar } from "@/layouts/Navbar";

export function RootLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-background selection:bg-primary/10 selection:text-primary">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="border-t py-6 md:py-8 bg-muted/20">
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">DataTrust</span>
            <span>&bull;</span>
            <span>Data Reliability & Quality Verification Platform</span>
            <span>&bull;</span>
            <span className="font-mono font-medium text-foreground">v1.0.0</span>
          </div>
          <div className="flex items-center gap-6">
            <span>FastAPI + React + DuckDB + PostgreSQL</span>
            <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Production Ready
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
