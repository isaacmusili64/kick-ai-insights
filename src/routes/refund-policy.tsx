import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

import { formatKes, PLANS } from "@/lib/plans";

export const Route = createFileRoute("/refund-policy")({
  head: () => ({
    meta: [
      { title: "Refund Policy — All Sales Final | PitchModel" },
      {
        name: "description",
        content:
          "PitchModel Pro passes are digital products delivered instantly. All sales are final and no refunds are given. Read the full policy before you pay.",
      },
      { property: "og:title", content: "Refund Policy — All Sales Final | PitchModel" },
      {
        property: "og:description",
        content: "Pro passes are non-refundable digital products delivered instantly by M-Pesa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-24">
      <header>
        <h1 className="text-2xl font-bold">Refund policy</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated 14 August 2026.</p>
      </header>

      <p className="card-surface flex items-start gap-3 border-destructive/50 p-4 text-sm font-semibold text-foreground">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <span>
          All sales are final. PitchModel does not offer refunds, cancellations or partial credits on
          any Pro pass, once payment has been received.
        </span>
      </p>

      <div className="card-surface space-y-6 p-5 text-sm text-foreground/80">
        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">Why there are no refunds</h2>
          <p>
            A Pro pass is a digital product. Access to every prediction, market and ready-made acca is
            unlocked immediately after your M-Pesa payment is confirmed, so the product is fully
            delivered and consumed the moment you pay. For that reason we cannot take it back and we
            do not issue refunds.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">What this covers</h2>
          <ul className="list-disc space-y-1 pl-5">
            {PLANS.map((p) => (
              <li key={p.id}>
                {p.name} — {formatKes(p.priceKes)} for {p.days} day{p.days > 1 ? "s" : ""}
              </li>
            ))}
          </ul>
          <p>
            Passes do not auto-renew. When a pass expires, nothing further is charged and you simply
            buy another one if you want to continue.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">No refunds for losing predictions</h2>
          <p>
            Predictions are probabilities, not guarantees. Losing selections, a bad run of results, or
            disagreement with a model call are not grounds for a refund. Our full record is public on
            the{" "}
            <Link to="/performance" className="font-semibold text-primary underline">
              track record page
            </Link>{" "}
            — please review it before you pay.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">Failed or duplicated payments</h2>
          <p>
            If M-Pesa debits you but your pass does not activate, or you were charged twice for the
            same pass, that is a technical fault rather than a refund request. Contact us with your
            M-Pesa receipt number and we will activate the correct access, or reverse the duplicate
            charge, within 5 working days.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-base font-bold text-foreground">Before you pay</h2>
          <p>
            Use the free tier first: four leagues, the core markets and daily accas cost nothing. Buy
            a{" "}
            <Link to="/pro" className="font-semibold text-primary underline">
              Pro pass
            </Link>{" "}
            only once you are happy with how the model performs. By paying you confirm you have read
            and accepted this no-refund policy and our{" "}
            <Link to="/privacy-policy" className="font-semibold text-primary underline">
              privacy policy
            </Link>
            .
          </p>
        </section>
      </div>
    </main>
  );
}