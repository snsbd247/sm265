// SMS + Email delivery history for invoices, plus an email-send helper
// (uses Resend REST API if RESEND_API_KEY is configured as a project secret).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getShopId(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles").select("shop_id").eq("user_id", context.userId)
    .not("shop_id", "is", null).limit(1).maybeSingle();
  const shopId = data?.shop_id as string | null;
  if (!shopId) throw new Error("দোকান পাওয়া যায়নি");
  return shopId;
}

export const listInvoiceDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ sale_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("invoice_deliveries")
      .select("*")
      .eq("sale_id", data.sale_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listCustomerDeliveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ customer_id: z.string().uuid(), limit: z.number().int().min(1).max(200).default(50) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("invoice_deliveries")
      .select("*, sale:sales(id, invoice_no)")
      .eq("customer_id", data.customer_id)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const sendInvoiceLinkEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      sale_id: z.string().uuid(),
      email: z.string().trim().email().optional().nullable(),
      origin: z.string().url(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: sale, error } = await context.supabase
      .from("sales")
      .select("id, invoice_no, total, share_token, shop_id, customer_id, customer:customers(name, email, phone)")
      .eq("id", data.sale_id)
      .eq("shop_id", shopId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sale) throw new Error("বিক্রয় পাওয়া যায়নি");

    const to = (data.email && data.email.trim()) || (sale.customer as any)?.email || "";
    if (!to) throw new Error("কাস্টমারের ইমেইল ঠিকানা নেই");

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY) {
      await context.supabase.from("invoice_deliveries").insert({
        shop_id: shopId, sale_id: sale.id, customer_id: sale.customer_id,
        channel: "email", recipient: to, status: "failed",
        response: "RESEND_API_KEY missing — configure Resend connector",
        provider: "resend", created_by: context.userId,
      });
      throw new Error("ইমেইল প্রদানকারী সেটআপ করা নেই। Resend কানেক্ট করুন।");
    }

    const { data: shop } = await context.supabase
      .from("shops").select("name, email").eq("id", sale.shop_id).maybeSingle();
    const { data: tpl } = await context.supabase
      .from("invoice_templates").select("primary_color, footer_note").eq("shop_id", sale.shop_id).maybeSingle();

    const url = `${data.origin.replace(/\/+$/, "")}/i/${sale.share_token}`;
    const inv = sale.invoice_no ?? String(sale.id).slice(0, 8);
    const total = Number(sale.total || 0).toFixed(2);
    const shopName = shop?.name ?? "";
    const primary = tpl?.primary_color ?? "#0f766e";
    const custName = (sale.customer as any)?.name ?? "";

    const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    const subject = `${shopName} — ইনভয়েস #${inv}`;
    const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;">
      <div style="max-width:560px;margin:auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
        <div style="background:${primary};color:#ffffff;padding:20px 24px;">
          <div style="font-size:12px;letter-spacing:.15em;opacity:.85;">INVOICE</div>
          <div style="font-size:22px;font-weight:800;margin-top:4px;">${escapeHtml(shopName)}</div>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;">প্রিয় ${escapeHtml(custName || "গ্রাহক")},</p>
          <p style="margin:0 0 16px;">আপনার ইনভয়েস <b>#${escapeHtml(inv)}</b> প্রস্তুত। মোট: <b>৳${total}</b></p>
          <p style="margin:24px 0;"><a href="${url}" style="display:inline-block;background:${primary};color:#ffffff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600;">ইনভয়েস দেখুন</a></p>
          <p style="margin:0;color:#64748b;font-size:12px;word-break:break-all;">${url}</p>
          ${tpl?.footer_note ? `<hr style="margin:24px 0;border:none;border-top:1px solid #e2e8f0;"/><p style="margin:0;color:#64748b;font-size:12px;">${escapeHtml(tpl.footer_note)}</p>` : ""}
        </div>
      </div>
    </body></html>`;

    let ok = false;
    let response = "";
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: [to], subject, html, reply_to: shop?.email || undefined }),
      });
      const body = await res.text();
      ok = res.ok;
      response = body.slice(0, 500);
    } catch (e: any) {
      response = `network: ${e?.message ?? "unknown"}`;
    }

    await context.supabase.from("invoice_deliveries").insert({
      shop_id: shopId, sale_id: sale.id, customer_id: sale.customer_id,
      channel: "email", recipient: to, status: ok ? "sent" : "failed",
      response, provider: "resend", created_by: context.userId,
    });

    if (!ok) throw new Error(`ইমেইল পাঠানো যায়নি: ${response.slice(0, 160)}`);
    return { ok: true, to };
  });

function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!),
  );
}