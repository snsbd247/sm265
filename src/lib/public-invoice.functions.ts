// Public + authenticated helpers for the shareable customer-facing invoice link.
// The public endpoint is capability-based: only holders of the random share_token
// can view the invoice, no login required.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPublicInvoice = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sale, error } = await supabaseAdmin
      .from("sales")
      .select(
        "id, invoice_no, sale_date, subtotal, discount, tax_amount, total, paid, due, sale_type, payment_method, status, note, share_token, shop_id, customer:customers(name, phone), items:sale_items(id, quantity, unit_price, discount_amount, tax_rate, tax_amount, line_total, product:products(name, unit:units(short_name)))",
      )
      .eq("share_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sale) throw new Error("ইনভয়েস পাওয়া যায়নি");
    const { data: shop } = await supabaseAdmin
      .from("shops")
      .select("name, address, phone, email, logo_url")
      .eq("id", sale.shop_id)
      .maybeSingle();
    const { data: template } = await supabaseAdmin
      .from("invoice_templates")
      .select("logo_url, primary_color, accent_color, text_color, address_line, contact_line, footer_note, terms_note, show_logo, show_qr, show_signature, signature_label")
      .eq("shop_id", sale.shop_id)
      .maybeSingle();
    // Never leak shop_id / share_token onwards
    const { shop_id: _s, ...rest } = sale as any;
    return { sale: rest, shop: shop ?? null, template: template ?? null };
  });

export const regenerateShareToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sale_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    // RLS ensures caller can only touch sales in their shop
    const { data: updated, error } = await context.supabase
      .from("sales")
      .update({ share_token: crypto.randomUUID() })
      .eq("id", data.sale_id)
      .select("id, share_token")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("বিক্রয় পাওয়া যায়নি বা অনুমতি নেই");
    return { ok: true, share_token: updated.share_token };
  });

export const sendInvoiceLinkSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      sale_id: z.string().uuid(),
      phone: z.string().trim().min(6).max(30).optional().nullable(),
      origin: z.string().url(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    // Verify caller owns the shop that owns the sale
    const { data: sale, error } = await context.supabase
      .from("sales")
      .select("id, invoice_no, total, share_token, shop_id, customer:customers(name, phone)")
      .eq("id", data.sale_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sale) throw new Error("বিক্রয় পাওয়া যায়নি");

    const phone = (data.phone && data.phone.trim())
      || (sale.customer as any)?.phone
      || "";
    if (!phone) throw new Error("কাস্টমারের ফোন নম্বর নেই");

    const { data: shop } = await context.supabase
      .from("shops").select("name").eq("id", sale.shop_id).maybeSingle();

    const url = `${data.origin.replace(/\/+$/, "")}/i/${sale.share_token}`;
    const inv = sale.invoice_no ?? sale.id.slice(0, 8);
    const total = Number(sale.total || 0).toFixed(2);
    const shopName = shop?.name ?? "";
    const message = `${shopName} — ইনভয়েস #${inv}\nমোট: ৳${total}\nদেখুন: ${url}\nধন্যবাদ।`;

    const { sendRawSMS } = await import("./sms.server");
    const res = await sendRawSMS(phone, message, {
      shopId: sale.shop_id,
      templateCode: "invoice_share",
    });
    await context.supabase.from("invoice_deliveries").insert({
      shop_id: sale.shop_id,
      sale_id: sale.id,
      customer_id: (sale.customer as any)?.id ?? null,
      channel: "sms",
      recipient: phone,
      status: res.ok ? "sent" : "failed",
      response: res.response,
      provider: "greenweb",
      created_by: context.userId,
    });
    if (!res.ok) throw new Error(`SMS পাঠানো যায়নি: ${res.response}`);
    return { ok: true, phone, url };
  });