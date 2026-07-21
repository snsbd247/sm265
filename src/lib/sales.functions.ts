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

/* -------- Customers -------- */

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    const { data, error } = await context.supabase
      .from("customers").select("*").eq("shop_id", shopId).order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const customerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  opening_balance: z.number().default(0),
  note: z.string().trim().max(300).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const saveCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => customerSchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    if (data.id) {
      const { error } = await context.supabase.from("customers").update({
        name: data.name, phone: data.phone || null, address: data.address || null,
        note: data.note || null, is_active: data.is_active,
      }).eq("id", data.id).eq("shop_id", shopId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    } else {
      const { enforceLimit } = await import("./limits.server");
      await enforceLimit(context.supabase, shopId, "customers", 1);
      // Duplicate phone guard (per shop)
      if (data.phone && data.phone.trim()) {
        const { data: dup } = await context.supabase.from("customers")
          .select("id").eq("shop_id", shopId).eq("phone", data.phone.trim()).maybeSingle();
        if (dup) throw new Error("এই ফোন নাম্বারে ইতিমধ্যে একটি কাস্টমার আছে");
      }
      const { data: created, error } = await context.supabase.from("customers").insert({
        shop_id: shopId, name: data.name, phone: data.phone || null, address: data.address || null,
        opening_balance: data.opening_balance, current_balance: data.opening_balance,
        note: data.note || null, is_active: data.is_active,
      }).select("id").single();
      if (error) throw new Error(error.message);
      return { ok: true, id: created.id };
    }
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { error } = await context.supabase.from("customers")
      .delete().eq("id", data.id).eq("shop_id", shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCustomerLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ customer_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: customer } = await context.supabase.from("customers")
      .select("*").eq("id", data.customer_id).eq("shop_id", shopId).maybeSingle();
    if (!customer) throw new Error("কাস্টমার পাওয়া যায়নি");

    const [salesRes, paymentsRes, instRes] = await Promise.all([
      context.supabase.from("sales")
        .select("id, invoice_no, sale_date, total, paid, due, sale_type, status, note, created_at, items:sale_items(id, quantity, unit_price, line_total, product:products(name, unit:units(short_name)))")
        .eq("shop_id", shopId).eq("customer_id", data.customer_id)
        .order("sale_date", { ascending: true }),
      context.supabase.from("customer_payments")
        .select("id, amount, payment_method, payment_date, reference, note, sale_id, created_at")
        .eq("shop_id", shopId).eq("customer_id", data.customer_id)
        .order("payment_date", { ascending: true }),
      context.supabase.from("installment_schedules")
        .select("*").eq("shop_id", shopId).eq("customer_id", data.customer_id)
        .order("due_date"),
    ]);

    const entries: any[] = [];
    if (customer.opening_balance && Number(customer.opening_balance) !== 0) {
      entries.push({ date: customer.created_at, type: "opening", description: "প্রারম্ভিক বকেয়া",
        debit: Number(customer.opening_balance), credit: 0 });
    }
    for (const s of salesRes.data ?? []) {
      entries.push({ date: s.sale_date, type: "sale",
        description: `বিক্রয় ${s.invoice_no ?? ""} (${s.sale_type})`.trim(),
        debit: Number(s.total), credit: 0, ref_id: s.id,
        invoice_no: s.invoice_no, sale_type: s.sale_type, status: s.status });
      if (Number(s.paid) > 0) {
        // sale-time payment already recorded as customer_payment row
      }
    }
    for (const p of paymentsRes.data ?? []) {
      const linkedSale = (salesRes.data ?? []).find((x: any) => x.id === p.sale_id);
      entries.push({ date: p.payment_date, type: "payment",
        description: `পেমেন্ট (${p.payment_method})${p.reference ? " • " + p.reference : ""}`,
        debit: 0, credit: Number(p.amount), ref_id: p.id,
        invoice_no: linkedSale?.invoice_no ?? null,
        sale_type: linkedSale?.sale_type ?? null,
        status: "paid",
        payment_method: p.payment_method });
    }
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let bal = 0;
    for (const e of entries) { bal += e.debit - e.credit; e.balance = bal; }

    const sales = (salesRes.data ?? []) as any[];
    const activeSales = sales.filter((s) => s.status !== "cancelled");
    const summary = {
      cash: { count: 0, total: 0 },
      due: { count: 0, total: 0, outstanding: 0 },
      installment: { count: 0, total: 0, outstanding: 0 },
      cancelled: { count: sales.length - activeSales.length, total: 0 },
      total_purchased: 0,
      total_paid: 0,
      total_outstanding: 0,
    };
    for (const s of activeSales) {
      const t = Number(s.total) || 0;
      const d = Number(s.due) || 0;
      const p = Number(s.paid) || 0;
      summary.total_purchased += t;
      summary.total_paid += p;
      summary.total_outstanding += d;
      const bucket = (summary as any)[s.sale_type];
      if (bucket) {
        bucket.count += 1;
        bucket.total += t;
        if ("outstanding" in bucket) bucket.outstanding += d;
      }
    }

    return {
      customer,
      entries,
      installments: instRes.data ?? [],
      sales,
      payments: paymentsRes.data ?? [],
      summary,
    };
  });

/* -------- Sales -------- */

const saleSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  invoice_no: z.string().trim().max(60).optional().nullable(),
  sale_date: z.string().optional(),
  discount: z.number().nonnegative().default(0),
  paid: z.number().nonnegative().default(0),
  payment_method: z.enum(["cash", "bkash", "bank", "due"]).default("cash"),
  sale_type: z.enum(["cash", "due", "installment"]).default("cash"),
  note: z.string().trim().max(300).optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().positive(),
    unit_price: z.number().nonnegative(),
    unit_cost: z.number().nonnegative().optional().nullable(),
    discount_amount: z.number().nonnegative().optional().default(0),
    tax_rate: z.number().nonnegative().optional().default(0),
  })).min(1),
  installments: z.number().int().min(1).max(60).optional().nullable(),
  installment_frequency: z.enum(["weekly", "monthly"]).default("monthly").optional(),
  installment_start: z.string().optional().nullable(),
  idempotency_key: z.string().trim().min(8).max(80).optional().nullable(),
});

export const createSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    // Idempotency: same shop + key returns the previously created sale.
    if (data.idempotency_key) {
      const { data: existing } = await context.supabase.from("sales")
        .select("id").eq("shop_id", shopId).eq("idempotency_key", data.idempotency_key).maybeSingle();
      if (existing?.id) return { ok: true, id: existing.id, duplicate: true };
    }
    // Enforce monthly invoice count + amount limits before creating the sale
    const saleTotal = data.items.reduce((s, it) => {
      const line = it.quantity * it.unit_price - (it.discount_amount ?? 0);
      const tax = line * ((it.tax_rate ?? 0) / 100);
      return s + line + tax;
    }, 0) - (data.discount ?? 0);
    const { enforceLimit, getUsage, LimitExceededError } = await import("./limits.server");
    await enforceLimit(context.supabase, shopId, "invoices", 1);
    const totInfo = await getUsage(context.supabase, shopId, "invoice_total");
    if (totInfo.limit != null && totInfo.used + saleTotal > totInfo.limit) {
      throw new LimitExceededError("invoice_total", Math.round(totInfo.used), totInfo.limit, totInfo.packageName);
    }
    const { data: sid, error } = await context.supabase.rpc("create_sale", {
      _shop_id: shopId,
      _customer_id: data.customer_id ?? null,
      _invoice_no: data.invoice_no ?? null,
      _sale_date: data.sale_date ?? null,
      _discount: data.discount,
      _paid: data.paid,
      _payment_method: data.payment_method,
      _sale_type: data.sale_type,
      _note: data.note ?? null,
      _items: data.items,
      _installments: data.sale_type === "installment" ? (data.installments ?? null) : null,
      _installment_frequency: data.installment_frequency ?? "monthly",
      _installment_start: data.installment_start ?? null,
    } as any);
    if (error) throw new Error(error.message);
    // Persist payment breakdown snapshot + idempotency key for retries
    const breakdown = {
      sale_type: data.sale_type,
      method: data.payment_method,
      total: Math.round(saleTotal * 100) / 100,
      paid_now: data.paid,
      due: Math.max(0, Math.round((saleTotal - data.paid) * 100) / 100),
      installments: data.sale_type === "installment" ? (data.installments ?? 0) : 0,
      installment_frequency: data.sale_type === "installment" ? (data.installment_frequency ?? "monthly") : null,
      is_partial: data.sale_type !== "cash" && data.paid > 0 && data.paid < saleTotal,
    };
    try {
      await context.supabase.from("sales").update({
        payment_breakdown: breakdown,
        idempotency_key: data.idempotency_key ?? null,
      }).eq("id", sid);
    } catch { /* non-fatal */ }
    // Fire-and-forget audit log for the sale + payment breakdown
    try {
      const { logAudit } = await import("./audit.server");
      await logAudit({
        actor_user_id: context.userId, shop_id: shopId,
        action: "invoice.created", target_type: "sale", target_id: sid,
        details: { breakdown, invoice_no: data.invoice_no ?? null, customer_id: data.customer_id ?? null },
      });
    } catch { /* non-fatal */ }
    return { ok: true, id: sid, duplicate: false };
  });

/* -------- Update (edit invoice in place) -------- */

const updateSaleSchema = saleSchema.extend({
  sale_id: z.string().uuid(),
});

export const updateSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateSaleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    // Ensure caller belongs to the shop that owns this sale
    const { data: existing, error: fetchErr } = await context.supabase
      .from("sales").select("id, shop_id, invoice_no")
      .eq("id", data.sale_id).eq("shop_id", shopId).maybeSingle();
    if (fetchErr) throw new Error(fetchErr.message);
    if (!existing) throw new Error("ইনভয়েস পাওয়া যায়নি");

    const { error } = await context.supabase.rpc("update_sale", {
      _sale_id: data.sale_id,
      _customer_id: data.customer_id ?? null,
      _sale_date: data.sale_date ?? null,
      _discount: data.discount,
      _paid: data.paid,
      _payment_method: data.payment_method,
      _sale_type: data.sale_type,
      _note: data.note ?? null,
      _items: data.items,
      _installments: data.sale_type === "installment" ? (data.installments ?? null) : null,
      _installment_frequency: data.installment_frequency ?? "monthly",
      _installment_start: data.installment_start ?? null,
    } as any);
    if (error) throw new Error(error.message);

    // Refresh payment breakdown snapshot
    const saleTotal = data.items.reduce((s, it) => {
      const line = it.quantity * it.unit_price - (it.discount_amount ?? 0);
      const tax = line * ((it.tax_rate ?? 0) / 100);
      return s + line + tax;
    }, 0) - (data.discount ?? 0);
    const paidFinal = data.sale_type === "cash" ? saleTotal : data.paid;
    const breakdown = {
      sale_type: data.sale_type,
      method: data.payment_method,
      total: Math.round(saleTotal * 100) / 100,
      paid_now: paidFinal,
      due: Math.max(0, Math.round((saleTotal - paidFinal) * 100) / 100),
      installments: data.sale_type === "installment" ? (data.installments ?? 0) : 0,
      installment_frequency: data.sale_type === "installment" ? (data.installment_frequency ?? "monthly") : null,
      is_partial: data.sale_type !== "cash" && paidFinal > 0 && paidFinal < saleTotal,
      edited_at: new Date().toISOString(),
    };
    try {
      await context.supabase.from("sales").update({ payment_breakdown: breakdown })
        .eq("id", data.sale_id);
    } catch { /* non-fatal */ }
    try {
      const { logAudit } = await import("./audit.server");
      await logAudit({
        actor_user_id: context.userId, shop_id: shopId,
        action: "invoice.updated", target_type: "sale", target_id: data.sale_id,
        details: { breakdown, invoice_no: existing.invoice_no ?? null },
      });
    } catch { /* non-fatal */ }
    return { ok: true, id: data.sale_id };
  });

/* -------- Cancel & Return -------- */

export const cancelSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    sale_id: z.string().uuid(),
    reason: z.string().trim().min(3, "কারণ কমপক্ষে ৩ অক্ষর").max(300),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await getShopId(context);
    const { error } = await context.supabase.rpc("cancel_sale", {
      _sale_id: data.sale_id, _reason: data.reason,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createSaleReturn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    sale_id: z.string().uuid(),
    items: z.array(z.object({
      sale_item_id: z.string().uuid(),
      quantity: z.number().positive(),
    })).min(1),
    refund_amount: z.number().nonnegative().default(0),
    refund_method: z.enum(["cash", "card", "bkash", "bank"]).default("cash"),
    reason: z.string().trim().min(3, "কারণ কমপক্ষে ৩ অক্ষর").max(300),
  }).parse(d))
  .handler(async ({ data, context }) => {
    await getShopId(context);
    const { data: id, error } = await context.supabase.rpc("create_sale_return", {
      _sale_id: data.sale_id, _items: data.items,
      _refund_amount: data.refund_amount, _refund_method: data.refund_method,
      _reason: data.reason,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true, id };
  });

export const listSaleReturns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ sale_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await getShopId(context);
    const { data: rows } = await context.supabase.from("sale_returns")
      .select("*, items:sale_return_items(*, product:products(name))")
      .eq("sale_id", data.sale_id).order("created_at", { ascending: false });
    return rows ?? [];
  });

export const listSales = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    customer_id: z.string().uuid().optional(),
    sale_type: z.enum(["cash", "due", "installment"]).optional(),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    let q = context.supabase.from("sales")
      .select("*, customer:customers(id,name,phone)")
      .eq("shop_id", shopId)
      .order("sale_date", { ascending: false })
      .limit(500);
    if (data.from) q = q.gte("sale_date", data.from);
    if (data.to) q = q.lte("sale_date", data.to);
    if (data.customer_id) q = q.eq("customer_id", data.customer_id);
    if (data.sale_type) q = q.eq("sale_type", data.sale_type);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getSale = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: sale, error } = await context.supabase.from("sales")
      .select("*, customer:customers(id,name,phone,address)")
      .eq("id", data.id).eq("shop_id", shopId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!sale) throw new Error("পাওয়া যায়নি");
    const { data: items } = await context.supabase.from("sale_items")
      .select("*, product:products(name, unit:units(short_name))")
      .eq("sale_id", data.id);
    const { data: installments } = await context.supabase.from("installment_schedules")
      .select("*").eq("sale_id", data.id).order("installment_no");
    const { data: shop } = await context.supabase.from("shops")
      .select("name, address, phone, email, logo_url")
      .eq("id", shopId)
      .maybeSingle();
    const merged = { ...sale, items: items ?? [] };
    return { sale: merged, items: items ?? [], installments: installments ?? [], shop: shop ?? null };
  });

/* -------- Customer Payments -------- */

const recvSchema = z.object({
  customer_id: z.string().uuid(),
  sale_id: z.string().uuid().optional().nullable(),
  amount: z.number().positive(),
  payment_method: z.enum(["cash", "bkash", "bank"]).default("cash"),
  payment_date: z.string().optional(),
  reference: z.string().trim().max(80).optional().nullable(),
  note: z.string().trim().max(200).optional().nullable(),
});

export const receiveCustomerPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => recvSchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { error } = await context.supabase.rpc("receive_customer_payment", {
      _shop_id: shopId,
      _customer_id: data.customer_id,
      _amount: data.amount,
      _payment_method: data.payment_method,
      _payment_date: data.payment_date ?? null,
      _reference: data.reference ?? null,
      _note: data.note ?? null,
      _sale_id: data.sale_id ?? null,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------- Installments -------- */

export const listInstallments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    status: z.enum(["all", "pending", "overdue", "paid", "due_soon"]).default("all"),
    customer_id: z.string().uuid().optional(),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);

    // Auto-mark overdue: any pending/partial with due_date < today
    await context.supabase.from("installment_schedules")
      .update({ status: "overdue" })
      .eq("shop_id", shopId)
      .in("status", ["pending", "partial"])
      .lt("due_date", new Date().toISOString().slice(0, 10));

    let q = context.supabase.from("installment_schedules")
      .select("*, customer:customers(id,name,phone), sale:sales(id,invoice_no,total)")
      .eq("shop_id", shopId)
      .order("due_date", { ascending: true })
      .limit(1000);

    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    if (data.status === "pending") q = q.in("status", ["pending", "partial"]);
    else if (data.status === "overdue") q = q.eq("status", "overdue");
    else if (data.status === "paid") q = q.eq("status", "paid");
    else if (data.status === "due_soon") q = q.in("status", ["pending", "partial"]).gte("due_date", today).lte("due_date", soon);
    if (data.customer_id) q = q.eq("customer_id", data.customer_id);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Summary
    const all = rows ?? [];
    const summary = {
      total: all.length,
      pending_amount: 0,
      overdue_amount: 0,
      paid_amount: 0,
    };
    for (const r of all) {
      const remaining = Number(r.amount) - Number(r.paid_amount);
      if (r.status === "overdue") summary.overdue_amount += remaining;
      else if (r.status === "paid") summary.paid_amount += Number(r.amount);
      else summary.pending_amount += remaining;
    }
    return { rows: all, summary };
  });
