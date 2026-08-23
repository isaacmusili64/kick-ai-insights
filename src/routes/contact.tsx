import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, MessageSquare } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — PitchModel" },
      {
        name: "description",
        content:
          "Contact PitchModel for account, billing, privacy or product questions. We respond by email.",
      },
      { property: "og:title", content: "Contact — PitchModel" },
      {
        property: "og:description",
        content: "Reach PitchModel for support, privacy requests and product questions.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

const SUPPORT_EMAIL = "support@pitchmodel.app";

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("general");
  const [message, setMessage] = useState("");

  const mailto = () => {
    const subject = encodeURIComponent(`[PitchModel] ${topic} — ${name || "Message"}`);
    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nTopic: ${topic}\n\n${message}`,
    );
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
  };

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-8 pb-24">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Support</p>
        <h1 className="mt-1 text-2xl font-bold">Contact</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Account, M-Pesa billing, privacy requests or product questions. We read every message —
          reply times are usually within 1–2 business days.
        </p>
      </header>

      <div className="card-surface flex items-start gap-3 p-4 text-sm">
        <Mail className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="font-semibold text-foreground">Email</p>
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-primary hover:underline">
            {SUPPORT_EMAIL}
          </a>
          <p className="mt-1 text-xs text-muted-foreground">
            Prefer a direct mail client? Use the address above or the form, which opens a draft for
            you.
          </p>
        </div>
      </div>

      <section className="card-surface space-y-4 p-5">
        <h2 className="flex items-center gap-2 text-sm font-bold">
          <MessageSquare className="h-4 w-4 text-primary" />
          Send a message
        </h2>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-muted-foreground">Name</span>
          <input
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-muted-foreground">Email</span>
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-muted-foreground">Topic</span>
          <select
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          >
            <option value="general">General</option>
            <option value="billing">Billing / M-Pesa</option>
            <option value="account">Account access</option>
            <option value="privacy">Privacy / data request</option>
            <option value="bug">Bug report</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="text-xs font-semibold text-muted-foreground">Message</span>
          <textarea
            className="mt-1 min-h-28 w-full rounded-lg border border-border bg-background px-3 py-2"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={4000}
          />
        </label>
        <button
          type="button"
          onClick={mailto}
          disabled={!message.trim()}
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
        >
          Open email draft
        </button>
      </section>

      <p className="text-xs text-muted-foreground">
        Also see the{" "}
        <Link to="/privacy-policy" className="font-medium text-foreground hover:underline">
          privacy policy
        </Link>
        ,{" "}
        <Link to="/refund-policy" className="font-medium text-foreground hover:underline">
          refund policy
        </Link>{" "}
        and{" "}
        <Link to="/blog" className="font-medium text-foreground hover:underline">
          blog
        </Link>
        .
      </p>
    </main>
  );
}
