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
        .select("id, invoice_no, sale_date, total, paid, due, sale_type, created_at")
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
        debit: Number(s.total), credit: 0, ref_id: s.id });
      if (Number(s.paid) > 0) {
        // sale-time payment already recorded as customer_payment row
      }
    }
    for (const p of paymentsRes.data ?? []) {
      entries.push({ date: p.payment_date, type: "payment",
        description: `পেমেন্ট (${p.payment_method})${p.reference ? " • " + p.reference : ""}`,
        debit: 0, credit: Number(p.amount), ref_id: p.id });
    }
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let bal = 0;
    for (const e of entries) { bal += e.debit - e.credit; e.balance = bal; }

    return { customer, entries, installments: instRes.data ?? [] };
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
  })).min(1),
  installments: z.number().int().min(1).max(60).optional().nullable(),
  installment_frequency: z.enum(["weekly", "monthly"]).default("monthly").optional(),
  installment_start: z.string().optional().nullable(),
});

export const createSale = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => saleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
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
    return { ok: true, id: sid };
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
    return { sale, items: items ?? [], installments: installments ?? [] };
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
