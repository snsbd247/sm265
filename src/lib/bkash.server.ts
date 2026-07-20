// bKash Tokenized Checkout PGW helper — server only
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type BkashConfig = {
  mode: "sandbox" | "live";
  app_key: string;
  app_secret: string;
  username: string;
  password: string;
  is_active: boolean;
};

const BASE_URLS = {
  sandbox: "https://tokenized.sandbox.bka.sh/v1.2.0-beta",
  live: "https://tokenized.pay.bka.sh/v1.2.0-beta",
};

// Simple in-memory token cache (per Worker instance)
let tokenCache: { token: string; exp: number; mode: string; key: string } | null = null;

export async function loadBkashConfig(): Promise<BkashConfig> {
  const { data, error } = await supabaseAdmin
    .from("payment_gateway_settings")
    .select("*")
    .eq("provider", "bkash")
    .maybeSingle();
  if (error || !data) throw new Error("bKash গেটওয়ে কনফিগার নেই");
  if (!data.is_active) throw new Error("bKash গেটওয়ে বন্ধ আছে");
  if (!data.app_key || !data.app_secret || !data.username || !data.password) {
    throw new Error("bKash কনফিগ অসম্পূর্ণ");
  }
  return data as BkashConfig;
}

async function grantToken(cfg: BkashConfig): Promise<string> {
  const now = Date.now();
  if (
    tokenCache &&
    tokenCache.mode === cfg.mode &&
    tokenCache.key === cfg.app_key &&
    tokenCache.exp - 60_000 > now
  ) {
    return tokenCache.token;
  }
  const url = `${BASE_URLS[cfg.mode]}/tokenized/checkout/token/grant`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      username: cfg.username,
      password: cfg.password,
    },
    body: JSON.stringify({ app_key: cfg.app_key, app_secret: cfg.app_secret }),
  });
  const json: any = await res.json();
  if (!json?.id_token) {
    throw new Error(`bKash token error: ${json?.statusMessage ?? "unknown"}`);
  }
  const ttlSec = Number(json.expires_in ?? 3500);
  tokenCache = {
    token: json.id_token,
    exp: now + ttlSec * 1000,
    mode: cfg.mode,
    key: cfg.app_key,
  };
  return json.id_token;
}

export async function createBkashPayment(params: {
  amount: number;
  invoiceNumber: string;
  callbackURL: string;
  payerReference: string;
}) {
  const cfg = await loadBkashConfig();
  const token = await grantToken(cfg);
  const url = `${BASE_URLS[cfg.mode]}/tokenized/checkout/create`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: token,
      "X-App-Key": cfg.app_key,
    },
    body: JSON.stringify({
      mode: "0011",
      amount: String(params.amount),
      currency: "BDT",
      intent: "sale",
      merchantInvoiceNumber: params.invoiceNumber,
      payerReference: params.payerReference,
      callbackURL: params.callbackURL,
    }),
  });
  const json: any = await res.json();
  if (!json?.paymentID || !json?.bkashURL) {
    throw new Error(`bKash create failed: ${json?.statusMessage ?? JSON.stringify(json)}`);
  }
  return {
    paymentID: json.paymentID as string,
    bkashURL: json.bkashURL as string,
    raw: json,
  };
}

export async function executeBkashPayment(paymentID: string) {
  const cfg = await loadBkashConfig();
  const token = await grantToken(cfg);
  const url = `${BASE_URLS[cfg.mode]}/tokenized/checkout/execute`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: token,
      "X-App-Key": cfg.app_key,
    },
    body: JSON.stringify({ paymentID }),
  });
  const json: any = await res.json();
  return json;
}

export async function queryBkashPayment(paymentID: string) {
  const cfg = await loadBkashConfig();
  const token = await grantToken(cfg);
  const url = `${BASE_URLS[cfg.mode]}/tokenized/checkout/payment/status`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: token,
      "X-App-Key": cfg.app_key,
    },
    body: JSON.stringify({ paymentID }),
  });
  return (await res.json()) as any;
}
