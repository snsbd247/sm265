// Per-shop invoice template — logo, colors, address, footer, terms.
// Public getter is used by the shareable /i/$token page (RLS allows anon SELECT).
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

export const DEFAULT_TEMPLATE = {
  logo_url: null as string | null,
  primary_color: "#0f766e",
  accent_color: "#f0fdfa",
  text_color: "#0f172a",
  address_line: "" as string | null,
  contact_line: "" as string | null,
  footer_note: "ধন্যবাদ, আবার আসবেন।" as string | null,
  terms_note: "" as string | null,
  show_logo: true,
  show_qr: true,
  show_signature: false,
  signature_label: "" as string | null,
};

export const getInvoiceTemplate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    const { data, error } = await context.supabase
      .from("invoice_templates").select("*").eq("shop_id", shopId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ?? { shop_id: shopId, ...DEFAULT_TEMPLATE };
  });

const templateSchema = z.object({
  logo_url: z.string().trim().max(2000).optional().nullable(),
  primary_color: z.string().trim().regex(/^#[0-9a-fA-F]{3,8}$/, "রঙ ভুল").default("#0f766e"),
  accent_color: z.string().trim().regex(/^#[0-9a-fA-F]{3,8}$/, "রঙ ভুল").default("#f0fdfa"),
  text_color: z.string().trim().regex(/^#[0-9a-fA-F]{3,8}$/, "রঙ ভুল").default("#0f172a"),
  address_line: z.string().trim().max(300).optional().nullable(),
  contact_line: z.string().trim().max(200).optional().nullable(),
  footer_note: z.string().trim().max(500).optional().nullable(),
  terms_note: z.string().trim().max(1000).optional().nullable(),
  show_logo: z.boolean().default(true),
  show_qr: z.boolean().default(true),
  show_signature: z.boolean().default(false),
  signature_label: z.string().trim().max(80).optional().nullable(),
});

export const saveInvoiceTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => templateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const payload = { shop_id: shopId, ...data };
    const { error } = await context.supabase
      .from("invoice_templates")
      .upsert(payload, { onConflict: "shop_id" });
    if (error) throw new Error(error.message);
    return { ok: true };
  });