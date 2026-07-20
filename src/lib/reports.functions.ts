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

const rangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  granularity: z.enum(["day", "month", "year"]).default("day"),
});

const sel = (s: string): string => s;

/* -------- Sales / Purchase summary -------- */

export const getSalesReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const toEnd = `${data.to}T23:59:59`;

    const { data: sales, error } = await context.supabase
      .from("sales")
      .select(sel("id, sale_date, subtotal, discount, total, paid, due, sale_type, payment_method"))
      .eq("shop_id", shopId)
      .gte("sale_date", data.from)
      .lte("sale_date", data.to)
      .order("sale_date");
    if (error) throw new Error(error.message);

    const rows = (sales ?? []) as any[];
    const bucket = (d: string) => {
      if (data.granularity === "year") return d.slice(0, 4);
      if (data.granularity === "month") return d.slice(0, 7);
      return d.slice(0, 10);
    };
    const groups: Record<string, { period: string; count: number; total: number; paid: number; due: number; cash: number; credit: number; installment: number }> = {};
    let totals = { count: 0, total: 0, paid: 0, due: 0, cash: 0, credit: 0, installment: 0 };
    for (const r of rows) {
      const k = bucket(r.sale_date);
      if (!groups[k]) groups[k] = { period: k, count: 0, total: 0, paid: 0, due: 0, cash: 0, credit: 0, installment: 0 };
      const g = groups[k];
      g.count++; g.total += +r.total; g.paid += +r.paid; g.due += +r.due;
      if (r.sale_type === "cash") g.cash += +r.total;
      else if (r.sale_type === "due") g.credit += +r.total;
      else if (r.sale_type === "installment") g.installment += +r.total;
      totals.count++; totals.total += +r.total; totals.paid += +r.paid; totals.due += +r.due;
      if (r.sale_type === "cash") totals.cash += +r.total;
      else if (r.sale_type === "due") totals.credit += +r.total;
      else if (r.sale_type === "installment") totals.installment += +r.total;
    }
    return { rows: Object.values(groups).sort((a, b) => a.period.localeCompare(b.period)), totals };
  });

export const getPurchaseReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: rowsRaw, error } = await context.supabase
      .from("purchases")
      .select(sel("id, purchase_date, subtotal, discount, total, paid, due, payment_method"))
      .eq("shop_id", shopId)
      .gte("purchase_date", data.from)
      .lte("purchase_date", data.to)
      .order("purchase_date");
    if (error) throw new Error(error.message);

    const rows = (rowsRaw ?? []) as any[];
    const bucket = (d: string) => data.granularity === "year" ? d.slice(0, 4) : data.granularity === "month" ? d.slice(0, 7) : d.slice(0, 10);
    const groups: Record<string, { period: string; count: number; total: number; paid: number; due: number }> = {};
    let totals = { count: 0, total: 0, paid: 0, due: 0 };
    for (const r of rows) {
      const k = bucket(r.purchase_date);
      if (!groups[k]) groups[k] = { period: k, count: 0, total: 0, paid: 0, due: 0 };
      const g = groups[k];
      g.count++; g.total += +r.total; g.paid += +r.paid; g.due += +r.due;
      totals.count++; totals.total += +r.total; totals.paid += +r.paid; totals.due += +r.due;
    }
    return { rows: Object.values(groups).sort((a, b) => a.period.localeCompare(b.period)), totals };
  });

/* -------- Cash Book (all cash inflow/outflow) -------- */

const cashSchema = z.object({
  from: z.string(),
  to: z.string(),
  method: z.enum(["cash", "bkash", "nagad", "bank", "all"]).default("cash"),
});

export const getCashBook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => cashSchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const methodFilter = (q: any, col = "payment_method") => data.method === "all" ? q : q.eq(col, data.method);

    // Inflows: customer_payments (all methods)
    const inA = methodFilter(context.supabase.from("customer_payments")
      .select(sel("id, payment_date, amount, payment_method, reference, note, customer:customers(name)"))
      .eq("shop_id", shopId).gte("payment_date", data.from).lte("payment_date", data.to));

    // Cash sales (paid direct) — approximate: sales where sale_type='cash'
    const inB = methodFilter(context.supabase.from("sales")
      .select(sel("id, sale_date, total, payment_method, invoice_no, customer:customers(name)"))
      .eq("shop_id", shopId).eq("sale_type", "cash")
      .gte("sale_date", data.from).lte("sale_date", data.to));

    // Outflows: supplier_payments + purchase paid at time
    const outA = methodFilter(context.supabase.from("supplier_payments")
      .select(sel("id, payment_date, amount, payment_method, reference, note, supplier:suppliers(name)"))
      .eq("shop_id", shopId).gte("payment_date", data.from).lte("payment_date", data.to));

    const [inARes, inBRes, outARes] = await Promise.all([inA, inB, outA]);
    if (inARes.error) throw new Error(inARes.error.message);
    if (inBRes.error) throw new Error(inBRes.error.message);
    if (outARes.error) throw new Error(outARes.error.message);

    type Entry = { date: string; type: "in" | "out"; amount: number; method: string; source: string; ref: string; party: string; note: string };
    const entries: Entry[] = [];

    for (const r of (inARes.data ?? []) as any[]) {
      entries.push({ date: r.payment_date, type: "in", amount: +r.amount, method: r.payment_method, source: "কাস্টমার পেমেন্ট", ref: r.reference ?? "", party: r.customer?.name ?? "", note: r.note ?? "" });
    }
    for (const r of (inBRes.data ?? []) as any[]) {
      entries.push({ date: r.sale_date, type: "in", amount: +r.total, method: r.payment_method, source: "নগদ বিক্রয়", ref: r.invoice_no ?? "", party: r.customer?.name ?? "-", note: "" });
    }
    for (const r of (outARes.data ?? []) as any[]) {
      entries.push({ date: r.payment_date, type: "out", amount: +r.amount, method: r.payment_method, source: "সাপ্লায়ার পেমেন্ট", ref: r.reference ?? "", party: r.supplier?.name ?? "", note: r.note ?? "" });
    }

    entries.sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;
    const withRunning = entries.map(e => {
      running += e.type === "in" ? e.amount : -e.amount;
      return { ...e, running };
    });
    const totals = {
      in: entries.filter(e => e.type === "in").reduce((s, e) => s + e.amount, 0),
      out: entries.filter(e => e.type === "out").reduce((s, e) => s + e.amount, 0),
    };
    return { entries: withRunning, totals, net: totals.in - totals.out };
  });

/* -------- Profit Report -------- */

export const getProfitReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => rangeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: items, error } = await context.supabase
      .from("sale_items")
      .select(sel("quantity, unit_price, unit_cost, line_total, sale:sales!inner(sale_date, shop_id)"))
      .eq("shop_id", shopId)
      .gte("sale.sale_date", data.from)
      .lte("sale.sale_date", data.to)
      .limit(20000);
    if (error) throw new Error(error.message);

    const rows = (items ?? []) as any[];
    const bucket = (d: string) => data.granularity === "year" ? d.slice(0, 4) : data.granularity === "month" ? d.slice(0, 7) : d.slice(0, 10);
    const groups: Record<string, { period: string; revenue: number; cost: number; profit: number; qty: number }> = {};
    let totals = { revenue: 0, cost: 0, profit: 0, qty: 0 };
    for (const it of rows) {
      const d = it.sale?.sale_date;
      if (!d) continue;
      const k = bucket(d);
      if (!groups[k]) groups[k] = { period: k, revenue: 0, cost: 0, profit: 0, qty: 0 };
      const qty = +it.quantity;
      const rev = +it.line_total;
      const cost = (it.unit_cost != null ? +it.unit_cost : 0) * qty;
      const p = rev - cost;
      const g = groups[k];
      g.revenue += rev; g.cost += cost; g.profit += p; g.qty += qty;
      totals.revenue += rev; totals.cost += cost; totals.profit += p; totals.qty += qty;
    }
    return { rows: Object.values(groups).sort((a, b) => a.period.localeCompare(b.period)), totals };
  });

/* -------- Dashboard snapshot -------- */

export const getReportSnapshot = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 8) + "01";

    const [salesToday, salesMonth, purchasesMonth, dueTotal] = await Promise.all([
      context.supabase.from("sales").select("total, paid").eq("shop_id", shopId).eq("sale_date", today),
      context.supabase.from("sales").select("total, paid, due").eq("shop_id", shopId).gte("sale_date", monthStart).lte("sale_date", today),
      context.supabase.from("purchases").select("total").eq("shop_id", shopId).gte("purchase_date", monthStart).lte("purchase_date", today),
      context.supabase.from("customers").select("current_balance").eq("shop_id", shopId),
    ]);

    const sum = (arr: any[] | null, k: string) => (arr ?? []).reduce((s, r) => s + (+r[k] || 0), 0);
    return {
      sales_today: sum(salesToday.data, "total"),
      sales_month: sum(salesMonth.data, "total"),
      purchase_month: sum(purchasesMonth.data, "total"),
      customer_due: sum(dueTotal.data, "current_balance"),
    };
  });

/* -------- Extended dashboard (Phase D) -------- */

export const getDashboardExtras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    const today = new Date().toISOString().slice(0, 10);
    const monthStart = today.slice(0, 8) + "01";
    // last 7 days range
    const days: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const from = days[0];

    const [products, supplierDue, custIn, supOut, salesTrend, topItems, recentPurchases, monthProfit] = await Promise.all([
      context.supabase.from("products")
        .select("id, name, stock_quantity, low_stock_alert, sale_price, unit:units(short_name)")
        .eq("shop_id", shopId).eq("is_active", true),
      context.supabase.from("suppliers").select("current_balance").eq("shop_id", shopId),
      context.supabase.from("customer_payments").select("amount, payment_method, payment_date").eq("shop_id", shopId).gte("payment_date", from).lte("payment_date", today),
      context.supabase.from("supplier_payments").select("amount, payment_method, payment_date").eq("shop_id", shopId).gte("payment_date", from).lte("payment_date", today),
      context.supabase.from("sales").select("sale_date, total").eq("shop_id", shopId).gte("sale_date", from).lte("sale_date", today),
      context.supabase.from("sale_items")
        .select("product_id, quantity, line_total, product:products(name), sale:sales!inner(sale_date, shop_id)")
        .eq("shop_id", shopId)
        .gte("sale.sale_date", monthStart)
        .lte("sale.sale_date", today)
        .limit(5000),
      context.supabase.from("purchases").select("id, purchase_date, invoice_no, total, supplier:suppliers(name)").eq("shop_id", shopId).order("created_at", { ascending: false }).limit(5),
      context.supabase.from("sale_items")
        .select("quantity, unit_cost, line_total, sale:sales!inner(sale_date, shop_id)")
        .eq("shop_id", shopId)
        .gte("sale.sale_date", monthStart)
        .lte("sale.sale_date", today)
        .limit(20000),
    ]);

    const productList = (products.data ?? []) as any[];
    const lowStock = productList.filter((p) => Number(p.stock_quantity) <= Number(p.low_stock_alert || 0));

    const sum = (arr: any[] | null | undefined, k: string, filter?: (r: any) => boolean) =>
      (arr ?? []).filter(filter ?? (() => true)).reduce((s, r) => s + (+r[k] || 0), 0);

    // Sales trend by day
    const trendMap = new Map<string, number>();
    for (const d of days) trendMap.set(d, 0);
    for (const r of (salesTrend.data ?? []) as any[]) {
      const d = String(r.sale_date).slice(0, 10);
      trendMap.set(d, (trendMap.get(d) ?? 0) + Number(r.total || 0));
    }
    const trend = days.map((d) => ({ date: d, total: trendMap.get(d) ?? 0 }));

    // Top products this month
    const topMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const it of (topItems.data ?? []) as any[]) {
      const key = it.product_id as string;
      const cur = topMap.get(key) ?? { name: it.product?.name ?? "-", qty: 0, revenue: 0 };
      cur.qty += Number(it.quantity || 0);
      cur.revenue += Number(it.line_total || 0);
      topMap.set(key, cur);
    }
    const topProducts = Array.from(topMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);

    // Month profit
    let mRev = 0, mCost = 0;
    for (const it of (monthProfit.data ?? []) as any[]) {
      const q = Number(it.quantity || 0);
      mRev += Number(it.line_total || 0);
      mCost += (it.unit_cost != null ? Number(it.unit_cost) : 0) * q;
    }

    return {
      productsCount: productList.length,
      lowStockCount: lowStock.length,
      lowStock: lowStock.slice(0, 6),
      supplierDue: sum(supplierDue.data, "current_balance"),
      cashInToday: sum(custIn.data, "amount", (r) => r.payment_date === today && r.payment_method === "cash"),
      bkashInToday: sum(custIn.data, "amount", (r) => r.payment_date === today && r.payment_method === "bkash"),
      cashOutToday: sum(supOut.data, "amount", (r) => r.payment_date === today && r.payment_method === "cash"),
      bkashOutToday: sum(supOut.data, "amount", (r) => r.payment_date === today && r.payment_method === "bkash"),
      trend,
      topProducts,
      recentPurchases: recentPurchases.data ?? [],
      monthProfit: mRev - mCost,
      monthRevenue: mRev,
    };
  });
