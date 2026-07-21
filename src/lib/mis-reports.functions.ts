// Extended MIS reports for shop operations. All functions require an
// authenticated shop member and use RLS-scoped Supabase client from
// requireSupabaseAuth. Returned shapes are plain DTOs for SSR safety.
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

const sel = (s: string): string => s;
const n = (v: unknown) => Number(v ?? 0) || 0;
const range = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/* ============ 1. Stock (Inventory Valuation) ============ */
export const getStockReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    const { data, error } = await context.supabase.from("products")
      .select(sel("id, name, sku, barcode, stock_quantity, low_stock_alert, purchase_price, sale_price, is_active, category:categories(name), unit:units(short_name)"))
      .eq("shop_id", shopId).order("name");
    if (error) throw new Error(error.message);
    const rows = (data ?? []).map((p: any) => {
      const qty = n(p.stock_quantity);
      const cost = n(p.purchase_price);
      const price = n(p.sale_price);
      return {
        id: p.id, name: p.name, sku: p.sku ?? "", barcode: p.barcode ?? "",
        category: p.category?.name ?? "-", unit: p.unit?.short_name ?? "",
        qty, cost_value: qty * cost, retail_value: qty * price,
        potential_profit: qty * (price - cost),
        low: qty <= n(p.low_stock_alert), dead: qty === 0, active: !!p.is_active,
      };
    });
    const totals = rows.reduce((t, r) => ({
      qty: t.qty + r.qty, cost_value: t.cost_value + r.cost_value,
      retail_value: t.retail_value + r.retail_value, potential_profit: t.potential_profit + r.potential_profit,
      low: t.low + (r.low ? 1 : 0), dead: t.dead + (r.dead ? 1 : 0),
    }), { qty: 0, cost_value: 0, retail_value: 0, potential_profit: 0, low: 0, dead: 0 });
    return { rows, totals };
  });

/* ============ 2. Stock Movement ============ */
export const getStockMovementReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => range.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: rows, error } = await context.supabase.from("stock_movements")
      .select(sel("created_at, movement_type, quantity, unit_cost, reference_type, note, product:products(name, unit:units(short_name))"))
      .eq("shop_id", shopId)
      .gte("created_at", `${data.from}T00:00:00`).lte("created_at", `${data.to}T23:59:59`)
      .order("created_at", { ascending: false }).limit(5000);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r: any) => ({
      date: String(r.created_at).slice(0, 10),
      product: r.product?.name ?? "-",
      unit: r.product?.unit?.short_name ?? "",
      type: r.movement_type,
      qty: n(r.quantity),
      cost: n(r.unit_cost),
      value: n(r.quantity) * n(r.unit_cost),
      ref: r.reference_type ?? "",
      note: r.note ?? "",
    }));
  });

/* ============ 3. Product-wise Sales ============ */
export const getProductSalesReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => range.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: items, error } = await context.supabase.from("sale_items")
      .select(sel("product_id, quantity, line_total, unit_cost, discount_amount, tax_amount, product:products(name, sku, category:categories(name)), sale:sales!inner(sale_date, shop_id, status)"))
      .eq("shop_id", shopId).gte("sale.sale_date", data.from).lte("sale.sale_date", data.to).limit(30000);
    if (error) throw new Error(error.message);
    const map = new Map<string, any>();
    for (const it of (items ?? []) as any[]) {
      if (it.sale?.status === "cancelled") continue;
      const k = it.product_id ?? "unknown";
      const cur = map.get(k) ?? {
        product: it.product?.name ?? "-", sku: it.product?.sku ?? "",
        category: it.product?.category?.name ?? "-",
        qty: 0, revenue: 0, cost: 0, discount: 0, tax: 0, profit: 0,
      };
      const qty = n(it.quantity);
      cur.qty += qty;
      cur.revenue += n(it.line_total);
      cur.cost += n(it.unit_cost) * qty;
      cur.discount += n(it.discount_amount);
      cur.tax += n(it.tax_amount);
      cur.profit = cur.revenue - cur.cost;
      map.set(k, cur);
    }
    const rows = Array.from(map.values()).sort((a, b) => b.qty - a.qty);
    const totals = rows.reduce((t, r) => ({
      qty: t.qty + r.qty, revenue: t.revenue + r.revenue, cost: t.cost + r.cost,
      discount: t.discount + r.discount, tax: t.tax + r.tax, profit: t.profit + r.profit,
    }), { qty: 0, revenue: 0, cost: 0, discount: 0, tax: 0, profit: 0 });
    return { rows, totals };
  });

/* ============ 4. Category-wise Sales ============ */
export const getCategorySalesReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => range.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: items, error } = await context.supabase.from("sale_items")
      .select(sel("quantity, line_total, unit_cost, product:products(category:categories(id, name)), sale:sales!inner(sale_date, shop_id, status)"))
      .eq("shop_id", shopId).gte("sale.sale_date", data.from).lte("sale.sale_date", data.to).limit(30000);
    if (error) throw new Error(error.message);
    const map = new Map<string, any>();
    for (const it of (items ?? []) as any[]) {
      if (it.sale?.status === "cancelled") continue;
      const cat = it.product?.category;
      const k = cat?.id ?? "uncat";
      const cur = map.get(k) ?? { category: cat?.name ?? "অন্যান্য", qty: 0, revenue: 0, cost: 0, profit: 0 };
      const qty = n(it.quantity);
      cur.qty += qty; cur.revenue += n(it.line_total); cur.cost += n(it.unit_cost) * qty;
      cur.profit = cur.revenue - cur.cost;
      map.set(k, cur);
    }
    const rows = Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
    const totals = rows.reduce((t, r) => ({ qty: t.qty + r.qty, revenue: t.revenue + r.revenue, cost: t.cost + r.cost, profit: t.profit + r.profit }), { qty: 0, revenue: 0, cost: 0, profit: 0 });
    return { rows, totals };
  });

/* ============ 5. Customer-wise Sales ============ */
export const getCustomerSalesReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => range.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: sales, error } = await context.supabase.from("sales")
      .select(sel("customer_id, total, paid, due, status, customer:customers(name, phone)"))
      .eq("shop_id", shopId).gte("sale_date", data.from).lte("sale_date", data.to).limit(20000);
    if (error) throw new Error(error.message);
    const map = new Map<string, any>();
    for (const s of (sales ?? []) as any[]) {
      if (s.status === "cancelled") continue;
      const k = s.customer_id ?? "walkin";
      const cur = map.get(k) ?? { name: s.customer?.name ?? "Walk-in", phone: s.customer?.phone ?? "", invoices: 0, total: 0, paid: 0, due: 0 };
      cur.invoices++; cur.total += n(s.total); cur.paid += n(s.paid); cur.due += n(s.due);
      map.set(k, cur);
    }
    const rows = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const totals = rows.reduce((t, r) => ({ invoices: t.invoices + r.invoices, total: t.total + r.total, paid: t.paid + r.paid, due: t.due + r.due }), { invoices: 0, total: 0, paid: 0, due: 0 });
    return { rows, totals };
  });

/* ============ 6. Supplier-wise Purchase ============ */
export const getSupplierPurchaseReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => range.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: rows, error } = await context.supabase.from("purchases")
      .select(sel("supplier_id, total, paid, due, supplier:suppliers(name, phone)"))
      .eq("shop_id", shopId).gte("purchase_date", data.from).lte("purchase_date", data.to).limit(20000);
    if (error) throw new Error(error.message);
    const map = new Map<string, any>();
    for (const s of (rows ?? []) as any[]) {
      const k = s.supplier_id ?? "none";
      const cur = map.get(k) ?? { name: s.supplier?.name ?? "—", phone: s.supplier?.phone ?? "", invoices: 0, total: 0, paid: 0, due: 0 };
      cur.invoices++; cur.total += n(s.total); cur.paid += n(s.paid); cur.due += n(s.due);
      map.set(k, cur);
    }
    const out = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const totals = out.reduce((t, r) => ({ invoices: t.invoices + r.invoices, total: t.total + r.total, paid: t.paid + r.paid, due: t.due + r.due }), { invoices: 0, total: 0, paid: 0, due: 0 });
    return { rows: out, totals };
  });

/* ============ 7. Customer Due Aging (Receivable) ============ */
export const getReceivableAging = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    const [custRes, saleRes] = await Promise.all([
      context.supabase.from("customers").select(sel("id, name, phone, current_balance")).eq("shop_id", shopId).gt("current_balance", 0),
      context.supabase.from("sales").select(sel("customer_id, sale_date, due, status")).eq("shop_id", shopId).gt("due", 0).neq("status", "cancelled").limit(20000),
    ]);
    if (custRes.error) throw new Error(custRes.error.message);
    if (saleRes.error) throw new Error(saleRes.error.message);
    const today = new Date();
    const buckets = new Map<string, { current: number; d30: number; d60: number; d90: number; over: number }>();
    for (const s of (saleRes.data ?? []) as any[]) {
      const d = new Date(s.sale_date);
      const age = Math.max(0, Math.floor((today.getTime() - d.getTime()) / 86400000));
      const due = n(s.due);
      const cur = buckets.get(s.customer_id) ?? { current: 0, d30: 0, d60: 0, d90: 0, over: 0 };
      if (age <= 30) cur.current += due;
      else if (age <= 60) cur.d30 += due;
      else if (age <= 90) cur.d60 += due;
      else if (age <= 180) cur.d90 += due;
      else cur.over += due;
      buckets.set(s.customer_id, cur);
    }
    const rows = ((custRes.data ?? []) as any[]).map((c) => {
      const b = buckets.get(c.id) ?? { current: 0, d30: 0, d60: 0, d90: 0, over: 0 };
      return { name: c.name, phone: c.phone ?? "", balance: n(c.current_balance), ...b };
    }).sort((a, b) => b.balance - a.balance);
    const totals = rows.reduce((t, r) => ({
      balance: t.balance + r.balance, current: t.current + r.current,
      d30: t.d30 + r.d30, d60: t.d60 + r.d60, d90: t.d90 + r.d90, over: t.over + r.over,
    }), { balance: 0, current: 0, d30: 0, d60: 0, d90: 0, over: 0 });
    return { rows, totals };
  });

/* ============ 8. Supplier Due (Payable) ============ */
export const getPayableReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    const { data, error } = await context.supabase.from("suppliers")
      .select(sel("name, phone, current_balance")).eq("shop_id", shopId).gt("current_balance", 0)
      .order("current_balance", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = ((data ?? []) as any[]).map((s) => ({ name: s.name, phone: s.phone ?? "", balance: n(s.current_balance) }));
    return { rows, total: rows.reduce((t, r) => t + r.balance, 0) };
  });

/* ============ 9. Installment Due Report ============ */
export const getInstallmentReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    const { data, error } = await context.supabase.from("installment_schedules")
      .select(sel("installment_no, due_date, amount, paid_amount, status, customer:customers(name, phone), sale:sales(invoice_no)"))
      .eq("shop_id", shopId).neq("status", "paid").neq("status", "cancelled")
      .order("due_date").limit(2000);
    if (error) throw new Error(error.message);
    const today = new Date().toISOString().slice(0, 10);
    const rows = ((data ?? []) as any[]).map((r) => {
      const remaining = n(r.amount) - n(r.paid_amount);
      const overdue = r.due_date < today;
      return {
        invoice: r.sale?.invoice_no ?? "", customer: r.customer?.name ?? "-", phone: r.customer?.phone ?? "",
        no: r.installment_no, due_date: r.due_date, amount: n(r.amount), paid: n(r.paid_amount),
        remaining, status: r.status, overdue,
      };
    });
    const totals = rows.reduce((t, r) => ({
      amount: t.amount + r.amount, paid: t.paid + r.paid, remaining: t.remaining + r.remaining,
      overdue: t.overdue + (r.overdue ? r.remaining : 0),
    }), { amount: 0, paid: 0, remaining: 0, overdue: 0 });
    return { rows, totals };
  });

/* ============ 10. Sales Return Report ============ */
export const getSalesReturnReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => range.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: rows, error } = await context.supabase.from("sale_returns")
      .select(sel("return_date, reason, refund_amount, refund_method, sale:sales(invoice_no, customer:customers(name)), items:sale_return_items(quantity, line_total, product:products(name))"))
      .eq("shop_id", shopId).gte("return_date", data.from).lte("return_date", data.to)
      .order("return_date", { ascending: false }).limit(2000);
    if (error) throw new Error(error.message);
    const list = ((rows ?? []) as any[]).map((r) => ({
      date: r.return_date,
      invoice: r.sale?.invoice_no ?? "",
      customer: r.sale?.customer?.name ?? "-",
      items: (r.items ?? []).map((i: any) => `${i.product?.name ?? "-"} × ${n(i.quantity)}`).join(", "),
      item_value: (r.items ?? []).reduce((s: number, i: any) => s + n(i.line_total), 0),
      refund: n(r.refund_amount),
      method: r.refund_method,
      reason: r.reason ?? "",
    }));
    const totals = list.reduce((t, r) => ({ item_value: t.item_value + r.item_value, refund: t.refund + r.refund, count: t.count + 1 }), { item_value: 0, refund: 0, count: 0 });
    return { rows: list, totals };
  });

/* ============ 11. Tax / VAT Report ============ */
export const getTaxReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => range.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: rows, error } = await context.supabase.from("sales")
      .select(sel("sale_date, invoice_no, subtotal, discount, tax_amount, total, status, customer:customers(name)"))
      .eq("shop_id", shopId).gte("sale_date", data.from).lte("sale_date", data.to)
      .neq("status", "cancelled").gt("tax_amount", 0).order("sale_date").limit(10000);
    if (error) throw new Error(error.message);
    const list = ((rows ?? []) as any[]).map((r) => ({
      date: r.sale_date, invoice: r.invoice_no, customer: r.customer?.name ?? "-",
      subtotal: n(r.subtotal), discount: n(r.discount), tax: n(r.tax_amount), total: n(r.total),
    }));
    const totals = list.reduce((t, r) => ({
      subtotal: t.subtotal + r.subtotal, discount: t.discount + r.discount,
      tax: t.tax + r.tax, total: t.total + r.total, count: t.count + 1,
    }), { subtotal: 0, discount: 0, tax: 0, total: 0, count: 0 });
    return { rows: list, totals };
  });

/* ============ 12. Payment Method Breakdown ============ */
export const getPaymentMethodReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => range.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const [inRes, outRes] = await Promise.all([
      context.supabase.from("customer_payments").select("amount, payment_method").eq("shop_id", shopId).gte("payment_date", data.from).lte("payment_date", data.to).limit(20000),
      context.supabase.from("supplier_payments").select("amount, payment_method").eq("shop_id", shopId).gte("payment_date", data.from).lte("payment_date", data.to).limit(20000),
    ]);
    if (inRes.error) throw new Error(inRes.error.message);
    if (outRes.error) throw new Error(outRes.error.message);
    const map = new Map<string, { method: string; inflow: number; outflow: number }>();
    for (const r of (inRes.data ?? []) as any[]) {
      const k = r.payment_method ?? "other";
      const cur = map.get(k) ?? { method: k, inflow: 0, outflow: 0 };
      cur.inflow += n(r.amount); map.set(k, cur);
    }
    for (const r of (outRes.data ?? []) as any[]) {
      const k = r.payment_method ?? "other";
      const cur = map.get(k) ?? { method: k, inflow: 0, outflow: 0 };
      cur.outflow += n(r.amount); map.set(k, cur);
    }
    const rows = Array.from(map.values()).map(r => ({ ...r, net: r.inflow - r.outflow })).sort((a, b) => b.inflow - a.inflow);
    const totals = rows.reduce((t, r) => ({ inflow: t.inflow + r.inflow, outflow: t.outflow + r.outflow, net: t.net + r.net }), { inflow: 0, outflow: 0, net: 0 });
    return { rows, totals };
  });

/* ============ 13. Shift / Day-close Report ============ */
export const getShiftReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => range.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: rows, error } = await context.supabase.from("pos_shifts")
      .select(sel("opened_at, closed_at, status, opening_cash, cash_sales_total, card_sales_total, bkash_sales_total, bank_sales_total, other_sales_total, total_sales, sales_count, closing_cash_expected, closing_cash_actual, variance, opened_by"))
      .eq("shop_id", shopId)
      .gte("opened_at", `${data.from}T00:00:00`).lte("opened_at", `${data.to}T23:59:59`)
      .order("opened_at", { ascending: false }).limit(500);
    if (error) throw new Error(error.message);
    const list = ((rows ?? []) as any[]).map((r) => ({
      opened: String(r.opened_at).slice(0, 16).replace("T", " "),
      closed: r.closed_at ? String(r.closed_at).slice(0, 16).replace("T", " ") : "-",
      status: r.status, opening: n(r.opening_cash),
      cash: n(r.cash_sales_total), card: n(r.card_sales_total), bkash: n(r.bkash_sales_total),
      bank: n(r.bank_sales_total), other: n(r.other_sales_total),
      total: n(r.total_sales), count: r.sales_count ?? 0,
      expected: n(r.closing_cash_expected), actual: n(r.closing_cash_actual), variance: n(r.variance),
    }));
    const totals = list.reduce((t, r) => ({
      opening: t.opening + r.opening, cash: t.cash + r.cash, card: t.card + r.card,
      bkash: t.bkash + r.bkash, bank: t.bank + r.bank, other: t.other + r.other,
      total: t.total + r.total, count: t.count + r.count, variance: t.variance + r.variance,
    }), { opening: 0, cash: 0, card: 0, bkash: 0, bank: 0, other: 0, total: 0, count: 0, variance: 0 });
    return { rows: list, totals };
  });

/* ============ 14. Discount Report ============ */
export const getDiscountReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => range.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: rows, error } = await context.supabase.from("sales")
      .select(sel("sale_date, invoice_no, subtotal, discount, total, status, customer:customers(name)"))
      .eq("shop_id", shopId).gte("sale_date", data.from).lte("sale_date", data.to)
      .neq("status", "cancelled").gt("discount", 0).order("sale_date", { ascending: false }).limit(5000);
    if (error) throw new Error(error.message);
    const list = ((rows ?? []) as any[]).map((r) => ({
      date: r.sale_date, invoice: r.invoice_no, customer: r.customer?.name ?? "-",
      subtotal: n(r.subtotal), discount: n(r.discount), total: n(r.total),
      pct: n(r.subtotal) > 0 ? (n(r.discount) / n(r.subtotal)) * 100 : 0,
    }));
    const totals = list.reduce((t, r) => ({
      subtotal: t.subtotal + r.subtotal, discount: t.discount + r.discount, total: t.total + r.total, count: t.count + 1,
    }), { subtotal: 0, discount: 0, total: 0, count: 0 });
    return { rows: list, totals };
  });

/* ============ 15. Low Stock / Dead Stock ============ */
export const getLowStockReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    const { data, error } = await context.supabase.from("products")
      .select(sel("name, sku, stock_quantity, low_stock_alert, purchase_price, sale_price, category:categories(name), unit:units(short_name)"))
      .eq("shop_id", shopId).eq("is_active", true).order("stock_quantity");
    if (error) throw new Error(error.message);
    const all = ((data ?? []) as any[]).map((p) => ({
      name: p.name, sku: p.sku ?? "", category: p.category?.name ?? "-", unit: p.unit?.short_name ?? "",
      qty: n(p.stock_quantity), alert: n(p.low_stock_alert),
      cost: n(p.purchase_price), value: n(p.stock_quantity) * n(p.purchase_price),
    }));
    return {
      low: all.filter(r => r.qty > 0 && r.qty <= r.alert),
      out: all.filter(r => r.qty <= 0),
    };
  });