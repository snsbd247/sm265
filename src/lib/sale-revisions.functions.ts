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

export const snapshotSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      sale_id: z.string().uuid(),
      reason: z.string().trim().max(300).optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const [{ data: sale, error: se }, { data: items }, { data: last }] = await Promise.all([
      context.supabase.from("sales")
        .select("*, customer:customers(id, name, phone, address)")
        .eq("id", data.sale_id).eq("shop_id", shopId).maybeSingle(),
      context.supabase.from("sale_items")
        .select("*, product:products(name, sku, unit:units(short_name))")
        .eq("sale_id", data.sale_id),
      context.supabase.from("sale_revisions")
        .select("version").eq("sale_id", data.sale_id)
        .order("version", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (se) throw new Error(se.message);
    if (!sale) throw new Error("বিক্রয় পাওয়া যায়নি");

    const version = ((last?.version as number | undefined) ?? 0) + 1;
    const snapshot = { sale, items: items ?? [], captured_at: new Date().toISOString() };
    const { data: row, error } = await context.supabase.from("sale_revisions").insert({
      shop_id: shopId, sale_id: data.sale_id, version,
      reason: data.reason ?? null, snapshot, created_by: context.userId,
    }).select("id, version").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: row.id, version: row.version };
  });

export const listSaleRevisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sale_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("sale_revisions")
      .select("id, version, reason, created_at, created_by")
      .eq("sale_id", data.sale_id)
      .order("version", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getSaleRevision = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("sale_revisions").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("সংস্করণ পাওয়া যায়নি");
    return row;
  });