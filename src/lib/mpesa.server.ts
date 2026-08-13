/** Safaricom Daraja (M-Pesa) helpers. Server only. Keys come from env vars. */

type Env = {
  base: string;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  callbackUrl: string;
};

export function mpesaEnv(): Env {
  const consumerKey = process.env["DARAJA_CONSUMER_KEY"] ?? "";
  const consumerSecret = process.env["DARAJA_CONSUMER_SECRET"] ?? "";
  const shortcode = process.env["DARAJA_SHORTCODE"] ?? "";
  const passkey = process.env["DARAJA_PASSKEY"] ?? "";
  const callbackUrl = process.env["DARAJA_CALLBACK_URL"] ?? "";
  const live = (process.env["DARAJA_ENV"] ?? "sandbox").toLowerCase() === "live";
  if (!consumerKey || !consumerSecret || !shortcode || !passkey || !callbackUrl) {
    throw new Error("MPESA_NOT_CONFIGURED");
  }
  return {
    base: live ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke",
    consumerKey,
    consumerSecret,
    shortcode,
    passkey,
    callbackUrl,
  };
}

/** 2547XXXXXXXX from 07XXXXXXXX / +2547XXXXXXXX / 7XXXXXXXX. */
export function normalisePhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

export function isValidPhone(msisdn: string): boolean {
  return /^254(7|1)\d{8}$/.test(msisdn);
}

function timestamp(): string {
  const d = new Date();
  const p = (n: number) => `${n}`.padStart(2, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

async function accessToken(env: Env): Promise<string> {
  const basic = btoa(`${env.consumerKey}:${env.consumerSecret}`);
  const res = await fetch(`${env.base}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${basic}` },
  });
  if (!res.ok) throw new Error(`MPESA_AUTH_FAILED_${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("MPESA_AUTH_FAILED");
  return json.access_token;
}

export type StkResult = {
  merchantRequestId: string | null;
  checkoutRequestId: string | null;
  customerMessage: string;
};

export async function stkPush(input: {
  phone: string;
  amount: number;
  reference: string;
  description: string;
}): Promise<StkResult> {
  const env = mpesaEnv();
  const token = await accessToken(env);
  const ts = timestamp();
  const password = btoa(`${env.shortcode}${env.passkey}${ts}`);

  const res = await fetch(`${env.base}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      BusinessShortCode: env.shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.round(input.amount),
      PartyA: input.phone,
      PartyB: env.shortcode,
      PhoneNumber: input.phone,
      CallBackURL: env.callbackUrl,
      AccountReference: input.reference.slice(0, 12),
      TransactionDesc: input.description.slice(0, 60),
    }),
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = (json["errorMessage"] as string) ?? `MPESA_REQUEST_FAILED_${res.status}`;
    throw new Error(message);
  }
  return {
    merchantRequestId: (json["MerchantRequestID"] as string) ?? null,
    checkoutRequestId: (json["CheckoutRequestID"] as string) ?? null,
    customerMessage:
      (json["CustomerMessage"] as string) ?? "Check your phone and enter your M-Pesa PIN.",
  };
}