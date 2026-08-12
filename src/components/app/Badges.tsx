import { Lock, Sparkles } from "lucide-react";

import { confidenceTier } from "@/lib/markets";

export function ConfidenceBadge({ confidence }: { confidence: number }) {
  const tier = confidenceTier(confidence);
  const tone =
    tier === "High"
      ? "border-primary/40 bg-primary/12 text-primary"
      : tier === "Medium"
        ? "border-gold/40 bg-gold/12 text-gold"
        : "border-border bg-secondary text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${tone}`}
      title={`Model confidence ${confidence}/100`}
    >
      <span className="tabular">{confidence}</span>
      <span className="uppercase tracking-wide opacity-80">{tier}</span>
    </span>
  );
}

export function EdgeBadge({ edge }: { edge: number }) {
  const positive = edge > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular ${
        positive
          ? "border-primary/40 bg-primary/12 text-primary"
          : "border-border bg-secondary text-muted-foreground"
      }`}
    >
      {positive ? "+" : ""}
      {(edge * 100).toFixed(1)}% edge
    </span>
  );
}

export function ProBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-gold/50 bg-gold/12 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gold ${className}`}
    >
      <Sparkles className="h-3 w-3" /> Pro
    </span>
  );
}

export function LockedPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      <Lock className="h-3 w-3" /> {label}
    </span>
  );
}