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

export const getCurrentShift = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    const { data } = await context.supabase.from("pos_shifts")
      .select("*").eq("shop_id", shopId).eq("opened_by", context.userId)
      .eq("status", "open").order("opened_at", { ascending: false }).limit(1).maybeSingle();
    if (!data) return { shift: null, totals: null };
    const { data: rows } = await context.supabase.from("sales")
      .select("total, paid, payment_method, status")
      .eq("shift_id", data.id);
    const active = (rows ?? []).filter((r: any) => r.status !== "cancelled");
    const sum = (m: string) => active.filter((r: any) => r.payment_method === m).reduce((s: number, r: any) => s + Number(r.paid || 0), 0);
    const totals = {
      count: active.length,
      total_sales: active.reduce((s: number, r: any) => s + Number(r.total || 0), 0),
      cash: sum("cash"), card: sum("card"), bkash: sum("bkash"), bank: sum("bank"),
      expected_cash: Number(data.opening_cash || 0) + sum("cash"),
    };
    return { shift: data, totals };
  });

export const listShifts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    const { data, error } = await context.supabase.from("pos_shifts")
      .select("*").eq("shop_id", shopId).order("opened_at", { ascending: false }).limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const openShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    opening_cash: z.number().nonnegative().default(0),
    note: z.string().max(300).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: id, error } = await context.supabase.rpc("open_shift", {
      _shop_id: shopId, _opening_cash: data.opening_cash, _note: data.note ?? null,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true, id };
  });

export const closeShift = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    shift_id: z.string().uuid(),
    closing_cash_actual: z.number().nonnegative(),
    note: z.string().max(300).optional().nullable(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await getShopId(context);
    const { error } = await context.supabase.rpc("close_shift", {
      _shift_id: data.shift_id, _closing_cash_actual: data.closing_cash_actual, _note: data.note ?? null,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });