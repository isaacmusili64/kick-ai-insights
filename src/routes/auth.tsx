import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in — PitchModel Pro predictions" },
      {
        name: "description",
        content:
          "Create a PitchModel account to unlock Pro predictions: every league, every market and full model edge for as little as KES 50.",
      },
      { property: "og:title", content: "Sign in — PitchModel Pro predictions" },
      {
        property: "og:description",
        content: "One account keeps your Pro pass, your accas and your saved picks together.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/pro";
}

function AuthPage() {
  const { next } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) void navigate({ to: safeNext(next) });
  }, [loading, user, next, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${safeNext(next)}` },
        });
        if (error) throw error;
        toast.success("Account created. Check your email if confirmation is required.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      }
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Try email instead.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    void navigate({ to: safeNext(next) });
  };

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10 pb-24">
      <header className="text-center">
        <h1 className="text-2xl font-bold">Your PitchModel account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You only need an account to buy and use a Pro pass. Free predictions stay open to everyone.
        </p>
      </header>

      <form onSubmit={submit} className="card-surface space-y-4 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {mode === "signup" ? "Create account" : "Sign in"}
        </Button>
        <Button type="button" variant="outline" className="w-full" onClick={google} disabled={busy}>
          Continue with Google
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {mode === "signup" ? "Already have an account?" : "New to PitchModel?"}{" "}
          <button
            type="button"
            className="font-semibold text-primary"
            onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
          >
            {mode === "signup" ? "Sign in" : "Create one"}
          </button>
        </p>
      </form>

      <p className="text-center text-xs text-muted-foreground">
        <Link to="/" className="font-semibold text-primary">
          Back to today&apos;s predictions
        </Link>
      </p>
    </main>
  );
}