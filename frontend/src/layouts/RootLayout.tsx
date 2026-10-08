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
        <div className="container flex items-center justify-center text-xs text-muted-foreground">
          <span>© 2026 DataTrust</span>
        </div>
      </footer>
    </div>
  );
}
