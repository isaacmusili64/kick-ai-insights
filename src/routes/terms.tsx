import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — PitchModel" },
      {
        name: "description",
        content:
          "PitchModel terms and conditions: how our predictions may be used, account rules, payments, and the limits of our liability.",
      },
      { property: "og:title", content: "Terms & Conditions — PitchModel" },
      {
        property: "og:description",
        content: "The rules for using PitchModel predictions, accounts and Pro passes.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

const SUPPORT_EMAIL = "isaacgoldstein98@gmail.com";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">{title}</h2>
      <div className="space-y-2 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 pb-24">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Legal</p>
        <h1 className="mt-1 text-2xl font-bold">Terms &amp; Conditions</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          By using PitchModel you agree to the terms below. Please read them before subscribing.
        </p>
      </header>

      <Section title="What PitchModel is">
        <p>
          PitchModel publishes statistical football predictions and analysis. Everything we show is
          an estimate produced from public match data. It is information and analysis only — it is
          not betting advice, a tip service, or a guarantee of any result.
        </p>
      </Section>

      <Section title="Age and responsible use">
        <p>
          You must be 18 or older to use PitchModel. Any wagering decision you make is entirely your
          own, and you are responsible for following the gambling laws where you live. Never stake
          money you cannot afford to lose.
        </p>
      </Section>

      <Section title="Accounts">
        <p>
          You need an account only to buy and use a Pro pass. Keep your login details private; you
          are responsible for activity under your account. We may suspend accounts used for abuse,
          scraping, resale of our predictions, or attempts to break the service.
        </p>
      </Section>

      <Section title="Pro passes and payment">
        <p>
          Pro passes are sold in Kenyan Shillings and paid by M-Pesa. A pass runs for a fixed period
          (daily, weekly or monthly) and does not auto-renew. Access begins once payment is
          confirmed and ends when the pass expires.
        </p>
        <p>
          All sales are final. We do not offer refunds, part-refunds or credits for unused time —
          see the{" "}
          <Link to="/refund-policy" className="font-medium text-foreground hover:underline">
            refund policy
          </Link>
          .
        </p>
      </Section>

      <Section title="Availability">
        <p>
          We rely on third-party data providers, so fixtures, live scores and predictions can be
          delayed, incomplete or briefly unavailable. We aim for continuous service but cannot
          promise uninterrupted access, and short outages do not entitle you to a refund.
        </p>
      </Section>

      <Section title="Accuracy and liability">
        <p>
          Predictions are probabilistic and will often be wrong. To the fullest extent permitted by
          law, PitchModel is not liable for any losses — including betting losses — arising from your
          use of the site, the predictions, or any data shown on it.
        </p>
      </Section>

      <Section title="Our content">
        <p>
          The model outputs, written analysis, design and code are ours. You may use them for your
          own personal reference. Republishing, redistributing or reselling them, in whole or in
          part, requires our written permission.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may update these terms as the product changes. The version on this page is always the
          current one, and continued use after an update means you accept it.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these terms:{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-foreground hover:underline">
            {SUPPORT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </main>
  );
}
