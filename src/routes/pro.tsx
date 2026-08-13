import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getPaymentStatus, startMpesaPayment } from "@/lib/billing.functions";
import { COMPETITION_LIST } from "@/lib/competitions";
import { useAuth } from "@/lib/auth";
import { formatKes, PLANS, type PlanId } from "@/lib/plans";
import { usePro } from "@/lib/pro";

export const Route = createFileRoute("/pro")({
  head: () => ({
    meta: [
      { title: "Pro predictions — every league, from KES 50" },
      {
        name: "description",
        content:
          "Unlock Pro predictions on PitchModel: every league, every market, unlimited accas and full model edge. Day pass KES 50, week KES 250, month KES 750. Pay with M-Pesa.",
      },
      { property: "og:title", content: "Pro predictions — every league, from KES 50" },
      {
        property: "og:description",
        content: "Day, week or month passes paid by M-Pesa. Every league, every market, every edge.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProPage,
});

const FREE = [
  "4 leagues, refreshed daily",
  "Match result, double chance, over/under 2.5, both teams to score",
  "3-pick accas",
  "AI match reads",
];
const PRO = [
  `Predictions for all ${COMPETITION_LIST.length} competitions`,
  "Every market, including correct score, handicaps and team goals",
  "Unlimited acca picks",
  "Full model edge tables and the edge-only filter",
  "Model performance history in full detail",
];

function ProPage() {
  const { isPro, pass, refresh } = usePro();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [plan, setPlan] = useState<PlanId>("weekly");
  const [phone, setPhone] = useState("");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const startFn = useServerFn(startMpesaPayment);
  const statusFn = useServerFn(getPaymentStatus);

  const start = useMutation({
    mutationFn: () => startFn({ data: { plan, phone } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.error ?? "Payment could not start.");
        return;
      }
      setPaymentId(result.paymentId);
      setNote(result.message ?? "Check your phone and enter your M-Pesa PIN.");
      toast.success("Payment request sent to your phone.");
    },
    onError: () => toast.error("Payment could not start. Try again."),
  });

  // Poll while an M-Pesa prompt is outstanding.
  useEffect(() => {
    if (!paymentId) return;
    let stop = false;
    const tick = async () => {
      const { payment } = await statusFn({ data: { paymentId } });
      if (stop || !payment) return;
      if (payment.status === "paid") {
        setPaymentId(null);
        setNote(null);
        refresh();
        toast.success("Payment received — your Pro pass is active.");
      } else if (payment.status === "failed") {
        setPaymentId(null);
        setNote(payment.result_desc ?? "The payment was not completed.");
      }
    };
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      stop = true;
      window.clearInterval(id);
    };
  }, [paymentId, statusFn, refresh]);

  const selected = PLANS.find((p) => p.id === plan)!;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8 pb-24">
      <header className="text-center">
        <h1 className="text-3xl font-bold">See every prediction</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
          A Pro pass opens every league and every market on the board — pay with M-Pesa, use it
          straight away, no auto-renewal.
        </p>
      </header>

      {isPro && pass ? (
        <p className="card-surface border-gold/40 p-4 text-center text-sm">
          Your <span className="font-bold text-gold">{pass.plan}</span> pass is active until{" "}
          <span className="font-semibold">
            {new Date(pass.expires_at).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
          .
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        {PLANS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPlan(p.id)}
            className={`card-surface p-4 text-left transition-colors ${
              plan === p.id ? "border-gold/60 bg-gold/8" : "hover:border-primary/40"
            }`}
          >
            <span className="block text-sm font-bold uppercase tracking-wide text-muted-foreground">
              {p.name}
            </span>
            <span className="tabular mt-1 block text-2xl font-bold">{formatKes(p.priceKes)}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{p.blurb}</span>
          </button>
        ))}
      </div>

      <section className="card-surface space-y-4 p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide">
          <Smartphone className="h-4 w-4 text-primary" /> Pay with M-Pesa
        </h2>
        {loading ? null : user ? (
          <form
            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              start.mutate();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="phone">M-Pesa number</Label>
              <Input
                id="phone"
                inputMode="tel"
                placeholder="0712 345 678"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={start.isPending || Boolean(paymentId)}>
              {paymentId
                ? "Waiting for your PIN…"
                : `Pay ${formatKes(selected.priceKes)} for the ${selected.name.toLowerCase()}`}
            </Button>
          </form>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Sign in first so your pass stays with your account on any device.
            </p>
            <Button onClick={() => void navigate({ to: "/auth", search: { next: "/pro" } })}>
              Sign in to buy a pass
            </Button>
          </div>
        )}
        {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="card-surface p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
            Free forever
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            {FREE.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> {f}
              </li>
            ))}
          </ul>
        </section>

        <section className="card-surface border-gold/40 p-5">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gold">With a Pro pass</h2>
          <ul className="mt-4 space-y-2 text-sm">
            {PRO.map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" /> {f}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[11px] text-muted-foreground">
            Check the{" "}
            <Link to="/performance" className="font-semibold text-primary">
              performance history
            </Link>{" "}
            before you pay — every graded pick is public.
          </p>
        </section>
      </div>
    </main>
  );
}