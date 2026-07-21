import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getShopId(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles").select("shop_id").eq("user_id", context.userId)
    .not("shop_id", "is", null).limit(1).maybeSingle();
  if (!data?.shop_id) throw new Error("দোকান পাওয়া যায়নি");
  return data.shop_id as string;
}

function monthBuckets(n = 12) {
  const out: { key: string; start: string; end: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
    out.push({
      key: d.toISOString().slice(0, 7),
      start: d.toISOString(),
      end: next.toISOString(),
      label: d.toLocaleDateString("bn-BD", { month: "short", year: "numeric" }),
    });
  }
  return out;
}

export const getUsageReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    const { loadShopPackageLimits, getAllUsage } = await import("./limits.server");
    const [limits, current] = await Promise.all([
      loadShopPackageLimits(context.supabase, shopId),
      getAllUsage(context.supabase, shopId),
    ]);
    const months = monthBuckets(12);

    // Month-bucketed data (invoices count/total + sms count)
    const [salesRes, smsRes] = await Promise.all([
      context.supabase.from("sales")
        .select("sale_date, total, status")
        .eq("shop_id", shopId)
        .neq("status", "cancelled")
        .gte("sale_date", months[0].start.slice(0, 10)),
      context.supabase.from("sms_logs")
        .select("created_at, status")
        .eq("shop_id", shopId)
        .eq("status", "sent")
        .gte("created_at", months[0].start),
    ]);
    const invoiceCount: Record<string, number> = {};
    const invoiceTotal: Record<string, number> = {};
    for (const r of salesRes.data ?? []) {
      const key = (r.sale_date as string).slice(0, 7);
      invoiceCount[key] = (invoiceCount[key] ?? 0) + 1;
      invoiceTotal[key] = (invoiceTotal[key] ?? 0) + Number(r.total || 0);
    }
    const smsCount: Record<string, number> = {};
    for (const r of smsRes.data ?? []) {
      const key = (r.created_at as string).slice(0, 7);
      smsCount[key] = (smsCount[key] ?? 0) + 1;
    }

    const series = months.map((m) => ({
      month: m.label,
      key: m.key,
      invoices: invoiceCount[m.key] ?? 0,
      invoice_total: invoiceTotal[m.key] ?? 0,
      sms: smsCount[m.key] ?? 0,
      invoice_limit: limits.invoices ?? null,
      invoice_total_limit: limits.invoice_total ?? null,
      sms_limit: limits.sms ?? null,
    }));

    return { packageName: limits.packageName, limits, current, series };
  });