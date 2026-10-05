import { Link } from "react-router-dom";
import { ShieldCheck, ArrowRight, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function RegisterPage() {
  return (
    <div className="container flex min-h-[calc(100vh-10rem)] items-center justify-center py-12">
      <Card className="w-full max-w-md border shadow-sm">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Create DataTrust Account</CardTitle>
          <CardDescription className="text-xs">
            Register to profile datasets and track data reliability metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-dashed bg-muted/40 p-4 text-center">
            <div className="flex items-center justify-center gap-2 text-xs font-medium text-muted-foreground mb-1">
              <UserPlus className="h-3.5 w-3.5 text-primary" />
              <span>User Registration (Phase 2)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Registration, password hashing with bcrypt, and profile management will be implemented alongside PostgreSQL models.
            </p>
          </div>

          <div className="space-y-3 opacity-60 pointer-events-none">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Full Name</label>
              <input
                type="text"
                disabled
                placeholder="Prachi Data Lead"
                className="w-full rounded-md border bg-muted/20 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Work Email</label>
              <input
                type="email"
                disabled
                placeholder="lead@organization.com"
                className="w-full rounded-md border bg-muted/20 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <input
                type="password"
                disabled
                placeholder="••••••••"
                className="w-full rounded-md border bg-muted/20 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Link to="/dashboard" className="w-full">
            <Button className="w-full gap-2">
              Continue to Dashboard Shell
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <p className="text-center text-xs text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign In
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
