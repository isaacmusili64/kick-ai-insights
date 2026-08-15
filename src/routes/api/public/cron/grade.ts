import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily grading job. Call once or twice a day from a scheduler:
 *   POST /api/public/cron/grade  with header  x-cron-secret: <CRON_SECRET>
 * or, if triggered via Vercel Cron (which auto-sends this when a CRON_SECRET
 * env var is set): header  Authorization: Bearer <CRON_SECRET>
 * When CRON_SECRET is unset the endpoint is read-only-safe but still guarded
 * against abuse by returning 503.
 */
async function handle(request: Request) {
  const secret = process.env["CRON_SECRET"];
  if (!secret) {
    return Response.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  }
  const bearer = request.headers.get("authorization");
  const provided =
    request.headers.get("x-cron-secret") ??
    (bearer?.startsWith("Bearer ") ? bearer.slice(7) : null) ??
    new URL(request.url).searchParams.get("key");
  if (provided !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { runDailyGrading } = await import("@/lib/grading.server");
  try {
    return Response.json(await runDailyGrading());
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
}

export const Route = createFileRoute("/api/public/cron/grade")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});