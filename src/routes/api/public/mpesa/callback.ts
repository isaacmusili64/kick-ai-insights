import { createFileRoute } from "@tanstack/react-router";

type StkItem = { Name: string; Value?: string | number };
type StkCallback = {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: { Item?: StkItem[] };
    };
  };
};

const PLAN_DAYS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 };

export const Route = createFileRoute("/api/public/mpesa/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = (await request.json().catch(() => ({}))) as StkCallback;
        const callback = payload.Body?.stkCallback;
        const checkoutId = callback?.CheckoutRequestID;

        if (!checkoutId) {
          return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: "Malformed callback" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: payment } = await supabaseAdmin
          .from("mpesa_payments")
          .select("id, user_id, plan, amount_kes, status")
          .eq("checkout_request_id", checkoutId)
          .maybeSingle();

        if (!payment) {
          return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Ignored" }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const items = callback?.CallbackMetadata?.Item ?? [];
        const receipt = items.find((i) => i.Name === "MpesaReceiptNumber")?.Value;
        const success = callback?.ResultCode === 0;

        await supabaseAdmin
          .from("mpesa_payments")
          .update({
            status: success ? "paid" : "failed",
            mpesa_receipt: typeof receipt === "string" ? receipt : null,
            result_desc: callback?.ResultDesc ?? null,
            raw: payload as never,
            updated_at: new Date().toISOString(),
          })
          .eq("id", payment.id);

        if (success && payment.status !== "paid") {
          const days = PLAN_DAYS[payment.plan] ?? 1;
          const { data: current } = await supabaseAdmin
            .from("subscriptions")
            .select("expires_at")
            .eq("user_id", payment.user_id)
            .gt("expires_at", new Date().toISOString())
            .order("expires_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          const from = current?.expires_at ? new Date(current.expires_at) : new Date();
          const expires = new Date(from.getTime() + days * 86_400_000);

          await supabaseAdmin.from("subscriptions").insert({
            user_id: payment.user_id,
            plan: payment.plan,
            amount_kes: payment.amount_kes,
            status: "active",
            starts_at: new Date().toISOString(),
            expires_at: expires.toISOString(),
            mpesa_receipt: typeof receipt === "string" ? receipt : null,
          });
        }

        return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Accepted" }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});