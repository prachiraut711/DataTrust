import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { RefreshCw } from "lucide-react";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-[calc(100vh-10rem)] flex flex-col items-center justify-center gap-3">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground font-mono">Verifying authentication session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login preserving the attempted destination
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
