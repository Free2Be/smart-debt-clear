import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "At least 8 characters").max(100),
});

function LoginPage() {
  const { user, loading, signIn, signUp } = useAuth();
  const nav = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) nav({ to: "/" });
  }, [loading, user, nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setSubmitting(true);
    const fn = mode === "signin" ? signIn : signUp;
    const { error } = await fn(parsed.data.email, parsed.data.password);
    setSubmitting(false);
    if (error) toast.error(error);
    else if (mode === "signup") toast.success("Account created. Welcome!");
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-10 bg-gradient-to-br from-primary via-primary to-info text-primary-foreground">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-white/15 grid place-items-center font-bold">L</div>
          <span className="font-semibold tracking-tight text-lg">Ledger</span>
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="text-4xl font-bold leading-tight tracking-tight">
            Pay off debt faster.<br />Sleep better.
          </h1>
          <p className="text-primary-foreground/80">
            Your paydays, bills, and credit card payoff plan — finally on the same page.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© Ledger</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signin" ? "Sign in to your planner." : "Start planning in under a minute."}
            </p>
          </div>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
            onClick={() => setMode(m => (m === "signin" ? "signup" : "signin"))}
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
          <p className="text-xs text-muted-foreground text-center">
            <Link to="/">Back home</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}
