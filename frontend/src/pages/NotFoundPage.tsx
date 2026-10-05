import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="container flex min-h-[calc(100vh-12rem)] flex-col items-center justify-center text-center py-12">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive mb-4">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight">404 - Page Not Found</h1>
      <p className="mt-2 text-sm text-muted-foreground max-w-sm">
        The requested DataTrust route does not exist.
      </p>
      <Link to="/" className="mt-6">
        <Button variant="outline" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Return to Overview
        </Button>
      </Link>
    </div>
  );
}
