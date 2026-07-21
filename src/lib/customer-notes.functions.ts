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

export const listCustomerNotes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ customer_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: rows, error } = await context.supabase
      .from("customer_notes")
      .select("id, kind, body, created_at, created_by")
      .eq("shop_id", shopId)
      .eq("customer_id", data.customer_id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addCustomerNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    customer_id: z.string().uuid(),
    kind: z.enum(["installment", "payment", "general"]).default("general"),
    body: z.string().trim().min(1).max(1000),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: row, error } = await context.supabase
      .from("customer_notes")
      .insert({ shop_id: shopId, customer_id: data.customer_id, kind: data.kind, body: data.body, created_by: context.userId })
      .select("id, kind, body, created_at, created_by")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCustomerNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { error } = await context.supabase
      .from("customer_notes").delete().eq("id", data.id).eq("shop_id", shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });