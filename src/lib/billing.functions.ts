import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const StartInput = z.object({
  plan: z.enum(["daily", "weekly", "monthly"]),
  phone: z.string().min(9).max(15),
});

export const startMpesaPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StartInput.parse(input))
  .handler(async ({ data, context }) => {
    const { planById } = await import("./plans");
    const { normalisePhone, isValidPhone, stkPush } = await import("./mpesa.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const plan = planById(data.plan);
    if (!plan) return { ok: false as const, error: "Unknown plan.", paymentId: null };

    const phone = normalisePhone(data.phone);
    if (!isValidPhone(phone)) {
      return { ok: false as const, error: "Enter a valid Safaricom number, e.g. 0712345678.", paymentId: null };
    }

    const { data: payment, error: insertError } = await supabaseAdmin
      .from("mpesa_payments")
      .insert({
        user_id: context.userId,
        plan: plan.id,
        amount_kes: plan.priceKes,
        phone,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !payment) {
      return { ok: false as const, error: "Could not start the payment. Try again.", paymentId: null };
    }

    try {
      const result = await stkPush({
        phone,
        amount: plan.priceKes,
        reference: `PM-${plan.id.toUpperCase()}`,
        description: `PitchModel ${plan.name}`,
      });
      await supabaseAdmin
        .from("mpesa_payments")
        .update({
          checkout_request_id: result.checkoutRequestId,
          merchant_request_id: result.merchantRequestId,
          status: "requested",
          updated_at: new Date().toISOString(),
        })
        .eq("id", payment.id);

      return { ok: true as const, error: null, paymentId: payment.id, message: result.customerMessage };
    } catch (error) {
      const message = (error as Error).message;
      await supabaseAdmin
        .from("mpesa_payments")
        .update({ status: "failed", result_desc: message, updated_at: new Date().toISOString() })
        .eq("id", payment.id);
      return {
        ok: false as const,
        paymentId: payment.id,
        error:
          message === "MPESA_NOT_CONFIGURED"
            ? "M-Pesa payments are not switched on yet. Add the Daraja credentials to finish setup."
            : "M-Pesa could not be reached right now. Please try again.",
      };
    }
  });

const StatusInput = z.object({ paymentId: z.string().uuid() });

export const getPaymentStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => StatusInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("mpesa_payments")
      .select("id, status, result_desc, mpesa_receipt, plan")
      .eq("id", data.paymentId)
      .maybeSingle();
    return { payment: row ?? null };
  });