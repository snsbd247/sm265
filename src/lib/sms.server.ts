// Server-only SMS helper for Greenweb SMS gateway.
// Never import from client-reachable files at module scope — import inside handler bodies.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type SmsVars = Record<string, string | number | null | undefined>;

/** Normalize BD phone numbers to 8801XXXXXXXXX form Greenweb accepts. */
export function normalizeBdPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0")) return "88" + digits;
  if (digits.startsWith("1") && digits.length === 10) return "880" + digits;
  return digits;
}

export function renderTemplate(body: string, vars: SmsVars): string {
  return body.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

interface GreenwebResult {
  ok: boolean;
  response: string;
}

async function callGreenweb(token: string, to: string, message: string): Promise<GreenwebResult> {
  const url = new URL("https://api.greenweb.com.bd/api.php");
  url.searchParams.set("token", token);
  url.searchParams.set("to", to);
  url.searchParams.set("message", message);
  try {
    const res = await fetch(url.toString(), { method: "GET" });
    const text = await res.text();
    // Greenweb returns "Ticket ID: XXXX" on success, or error text.
    const ok = res.ok && !/error|invalid|fail/i.test(text);
    return { ok, response: text.slice(0, 500) };
  } catch (e: any) {
    return { ok: false, response: `network: ${e?.message ?? "unknown"}` };
  }
}

interface SendOpts {
  shopId?: string | null;
  templateCode?: string | null;
}

export async function sendRawSMS(phone: string, message: string, opts: SendOpts = {}) {
  const { data: gw } = await supabaseAdmin
    .from("sms_gateway_settings")
    .select("*")
    .eq("provider", "greenweb")
    .maybeSingle();

  const to = normalizeBdPhone(phone);
  const baseLog = {
    shop_id: opts.shopId ?? null,
    template_code: opts.templateCode ?? null,
    recipient: to,
    message,
  };

  if (!gw || !gw.is_active || !gw.api_token) {
    await supabaseAdmin.from("sms_logs").insert({
      ...baseLog,
      status: "failed",
      response: "gateway inactive or token missing",
    });
    return { ok: false, response: "gateway inactive" };
  }

  const result = await callGreenweb(gw.api_token, to, message);
  await supabaseAdmin.from("sms_logs").insert({
    ...baseLog,
    status: result.ok ? "sent" : "failed",
    sent_at: result.ok ? new Date().toISOString() : null,
    response: result.response,
  });
  return result;
}

/**
 * Load a template by code, render with vars, and send. Silent no-op on missing
 * or inactive template — callers should never let SMS failures break primary flows.
 */
export async function sendTemplateSMS(code: string, phone: string, vars: SmsVars, opts: SendOpts = {}) {
  try {
    const { data: tpl } = await supabaseAdmin
      .from("sms_templates")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    if (!tpl || !tpl.is_active) {
      return { ok: false, response: "template missing/inactive" };
    }
    const message = renderTemplate(tpl.body, vars);
    return await sendRawSMS(phone, message, { ...opts, templateCode: code });
  } catch (e: any) {
    console.error("sendTemplateSMS error", code, e);
    return { ok: false, response: e?.message ?? "error" };
  }
}
