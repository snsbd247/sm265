import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getShopId(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles").select("shop_id").eq("user_id", context.userId)
    .not("shop_id", "is", null).limit(1).maybeSingle();
  return data?.shop_id as string | null;
}

export const getShopNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    if (!shopId) return { items: [], count: 0 };

    const today = new Date().toISOString().slice(0, 10);
    const in7 = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);

    const [overdueRes, dueSoonRes, productsRes, shopRes] = await Promise.all([
      context.supabase.from("installment_schedules")
        .select("id, due_date, amount, paid_amount, sale:sales(invoice_no, customer:customers(name))", { count: "exact", head: false })
        .eq("shop_id", shopId).lt("due_date", today).neq("status", "paid").limit(50),
      context.supabase.from("installment_schedules")
        .select("id", { count: "exact", head: true })
        .eq("shop_id", shopId).gte("due_date", today).lte("due_date", in7).neq("status", "paid"),
      context.supabase.from("products")
        .select("id, name, stock_quantity, low_stock_alert")
        .eq("shop_id", shopId).eq("is_active", true).gt("low_stock_alert", 0).limit(200),
      context.supabase.from("shops").select("subscription_end, status").eq("id", shopId).maybeSingle(),
    ]);

    const overdue = (overdueRes.data ?? []) as any[];
    const dueSoonCount = dueSoonRes.count ?? 0;
    const lowStock = ((productsRes.data ?? []) as any[])
      .filter(p => Number(p.stock_quantity) <= Number(p.low_stock_alert));

    const items: { type: string; title: string; body: string; severity: "info" | "warn" | "danger"; href?: string }[] = [];

    if (overdue.length > 0) {
      const total = overdue.reduce((s, r) => s + (Number(r.amount) - Number(r.paid_amount || 0)), 0);
      items.push({
        type: "overdue",
        title: `${overdue.length} টি কিস্তি বকেয়া`,
        body: `মোট ৳${total.toLocaleString("bn-BD", { maximumFractionDigits: 0 })} সংগ্রহ বাকি`,
        severity: "danger",
        href: "/app/installments",
      });
    }
    if (dueSoonCount > 0) {
      items.push({
        type: "due-soon",
        title: `${dueSoonCount} টি কিস্তি ৭ দিনের মধ্যে`,
        body: "সময়মতো সংগ্রহ করুন",
        severity: "warn",
        href: "/app/installments",
      });
    }
    if (lowStock.length > 0) {
      items.push({
        type: "low-stock",
        title: `${lowStock.length} টি পণ্যের স্টক কম`,
        body: lowStock.slice(0, 3).map(p => p.name).join(", ") + (lowStock.length > 3 ? "..." : ""),
        severity: "warn",
        href: "/app/products",
      });
    }
    const shop = shopRes.data as any;
    if (shop?.subscription_end) {
      const days = Math.ceil((new Date(shop.subscription_end).getTime() - Date.now()) / 86400_000);
      if (days <= 7 && days >= 0) {
        items.push({
          type: "sub-expiring",
          title: `সাবস্ক্রিপশন ${days} দিনে শেষ হচ্ছে`,
          body: "এখনই নবায়ন করুন",
          severity: days <= 2 ? "danger" : "warn",
          href: "/app/subscription",
        });
      }
    }

    return { items, count: items.length, overdue_count: overdue.length, low_stock_count: lowStock.length };
  });
