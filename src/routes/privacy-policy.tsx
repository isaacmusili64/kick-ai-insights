import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — PitchModel" },
      {
        name: "description",
        content:
          "How PitchModel collects, uses and protects your data: account details, M-Pesa payment records, cookies and your rights.",
      },
      { property: "og:title", content: "Privacy Policy — PitchModel" },
      {
        property: "og:description",
        content: "What data PitchModel stores, why we store it, and how to have it removed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-base font-bold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm text-foreground/80">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-24">
      <header>
        <h1 className="text-2xl font-bold">Privacy policy</h1>
        <p className="mt-1 text-sm text-muted-foreground">Last updated 14 August 2026.</p>
      </header>

      <div className="card-surface space-y-6 p-5">
        <Section title="Who we are">
          <p>
            PitchModel provides statistical football predictions and analysis. This policy explains
            what we collect when you use the site and buy a Pro pass.
          </p>
        </Section>

        <Section title="What we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong className="text-foreground">Account details:</strong> your email address, and
              your name and profile photo if you sign in with Google.
            </li>
            <li>
              <strong className="text-foreground">Payment records:</strong> the M-Pesa phone number
              you enter, the amount, the plan bought, the M-Pesa receipt number and the transaction
              status. We never see or store your M-Pesa PIN.
            </li>
            <li>
              <strong className="text-foreground">Usage data:</strong> basic technical logs such as
              pages requested and errors, used to keep the service working.
            </li>
          </ul>
        </Section>

        <Section title="Why we use it">
          <p>
            To create and secure your account, to process payments through Safaricom M-Pesa, to give
            you access to the Pro features you paid for, to support you if a payment fails, and to
            fix technical problems.
          </p>
        </Section>

        <Section title="Who we share it with">
          <p>
            Only the service providers we need to run PitchModel: our hosting and database provider,
            Safaricom (for M-Pesa payments), Google (only if you choose Google sign-in) and our
            football data provider. We do not sell your data or share it with advertisers.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            Account and subscription records are kept while your account exists, and payment records
            for as long as required for accounting and dispute handling. You can ask us to delete
            your account at any time.
          </p>
        </Section>

        <Section title="Cookies and local storage">
          <p>
            We store a sign-in session in your browser so you stay logged in, and small preferences
            such as your last filter choices. We do not run advertising trackers.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You can ask for a copy of your data, ask us to correct it, or ask us to delete your
            account and personal data. Contact us from the email address on your account and we will
            act within 30 days.
          </p>
        </Section>

        <Section title="Responsible use">
          <p>
            PitchModel publishes statistical analysis, not betting advice, and the service is for
            adults aged 18 and over. See our{" "}
            <Link to="/refund-policy" className="font-semibold text-primary underline">
              refund policy
            </Link>{" "}
            before you buy a pass.
          </p>
        </Section>
      </div>
    </main>
  );
}