import { Link, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck, Activity, BarChart2, LogOut, User as UserIcon, Layers, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, activeWorkspace, logout } = useAuth();

  const isCurrent = (path: string) => location.pathname === path;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-foreground text-base leading-none">
                DataTrust
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                Reliability Engine
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <Link
              to="/"
              className={`transition-colors hover:text-foreground ${
                isCurrent("/") ? "text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              Overview
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  to="/dashboard"
                  className={`flex items-center gap-1.5 transition-colors hover:text-foreground ${
                    isCurrent("/dashboard") ? "text-foreground font-semibold" : "text-muted-foreground"
                  }`}
                >
                  <BarChart2 className="h-4 w-4" />
                  Dashboard
                </Link>
                <Link
                  to="/datasets"
                  className={`flex items-center gap-1.5 transition-colors hover:text-foreground ${
                    isCurrent("/datasets") || location.pathname.startsWith("/datasets")
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground"
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Datasets
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              {activeWorkspace && (
                <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/70 border text-xs text-foreground font-medium">
                  <Layers className="h-3 w-3 text-primary" />
                  <span className="max-w-[140px] truncate">{activeWorkspace.name}</span>
                </div>
              )}

              <div className="flex items-center gap-2 px-2 py-1 rounded-md bg-muted/40 text-xs">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-[11px]">
                  <UserIcon className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium text-foreground max-w-[120px] truncate hidden md:inline">
                  {user?.full_name}
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 mr-2 px-2.5 py-1 rounded-full bg-muted/60 border text-xs text-muted-foreground font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                System Online
              </div>

              <Link to="/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link to="/register">
                <Button size="sm" className="gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Get Started
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
