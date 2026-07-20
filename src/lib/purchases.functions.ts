import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getShopId(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("shop_id")
    .eq("user_id", context.userId)
    .not("shop_id", "is", null)
    .limit(1)
    .maybeSingle();
  const shopId = data?.shop_id as string | null;
  if (!shopId) throw new Error("দোকান পাওয়া যায়নি");
  return shopId;
}

/* ---------------- Suppliers ---------------- */

export const listSuppliers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    const { data, error } = await context.supabase
      .from("suppliers").select("*").eq("shop_id", shopId).order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const supplierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  phone: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(300).optional().nullable(),
  opening_balance: z.number().default(0),
  note: z.string().trim().max(300).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const saveSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => supplierSchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    if (data.id) {
      const { error } = await context.supabase.from("suppliers")
        .update({
          name: data.name, phone: data.phone || null, address: data.address || null,
          note: data.note || null, is_active: data.is_active,
        })
        .eq("id", data.id).eq("shop_id", shopId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    } else {
      const { data: created, error } = await context.supabase.from("suppliers")
        .insert({
          shop_id: shopId,
          name: data.name, phone: data.phone || null, address: data.address || null,
          opening_balance: data.opening_balance,
          current_balance: data.opening_balance,
          note: data.note || null, is_active: data.is_active,
        }).select("id").single();
      if (error) throw new Error(error.message);
      return { ok: true, id: created.id };
    }
  });

export const deleteSupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { error } = await context.supabase.from("suppliers")
      .delete().eq("id", data.id).eq("shop_id", shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSupplierLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ supplier_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: supplier } = await context.supabase.from("suppliers")
      .select("*").eq("id", data.supplier_id).eq("shop_id", shopId).maybeSingle();
    if (!supplier) throw new Error("সাপ্লায়ার পাওয়া যায়নি");

    const [purchasesRes, paymentsRes] = await Promise.all([
      context.supabase.from("purchases")
        .select("id, invoice_no, purchase_date, total, paid, due, created_at")
        .eq("shop_id", shopId).eq("supplier_id", data.supplier_id)
        .order("purchase_date", { ascending: true }),
      context.supabase.from("supplier_payments")
        .select("id, amount, payment_method, payment_date, reference, note, purchase_id, created_at")
        .eq("shop_id", shopId).eq("supplier_id", data.supplier_id)
        .order("payment_date", { ascending: true }),
    ]);

    const entries: any[] = [];
    if (supplier.opening_balance && Number(supplier.opening_balance) !== 0) {
      entries.push({
        date: supplier.created_at,
        type: "opening",
        description: "প্রারম্ভিক বকেয়া",
        debit: Number(supplier.opening_balance),
        credit: 0,
      });
    }
    for (const p of purchasesRes.data ?? []) {
      entries.push({
        date: p.purchase_date,
        type: "purchase",
        description: `ক্রয় ${p.invoice_no ?? ""}`.trim(),
        debit: Number(p.total),
        credit: 0,
        ref_id: p.id,
      });
    }
    for (const pay of paymentsRes.data ?? []) {
      entries.push({
        date: pay.payment_date,
        type: "payment",
        description: `পেমেন্ট (${pay.payment_method})${pay.reference ? " • " + pay.reference : ""}`,
        debit: 0,
        credit: Number(pay.amount),
        ref_id: pay.id,
      });
    }
    entries.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let bal = 0;
    for (const e of entries) { bal += e.debit - e.credit; e.balance = bal; }

    return { supplier, entries };
  });

/* ---------------- Purchases ---------------- */

const purchaseSchema = z.object({
  supplier_id: z.string().uuid().nullable().optional(),
  invoice_no: z.string().trim().max(60).optional().nullable(),
  purchase_date: z.string().optional(),
  discount: z.number().nonnegative().default(0),
  paid: z.number().nonnegative().default(0),
  payment_method: z.enum(["cash", "bkash", "bank", "due"]).default("cash"),
  note: z.string().trim().max(300).optional().nullable(),
  items: z.array(z.object({
    product_id: z.string().uuid(),
    quantity: z.number().positive(),
    unit_cost: z.number().nonnegative(),
  })).min(1),
});

export const createPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => purchaseSchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: pid, error } = await context.supabase.rpc("create_purchase", {
      _shop_id: shopId,
      _supplier_id: data.supplier_id ?? null,
      _invoice_no: data.invoice_no ?? null,
      _purchase_date: data.purchase_date ?? null,
      _discount: data.discount,
      _paid: data.paid,
      _payment_method: data.payment_method,
      _note: data.note ?? null,
      _items: data.items,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true, id: pid };
  });

export const listPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    from: z.string().optional(),
    to: z.string().optional(),
    supplier_id: z.string().uuid().optional(),
  }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    let q = context.supabase.from("purchases")
      .select("*, supplier:suppliers(id,name)")
      .eq("shop_id", shopId)
      .order("purchase_date", { ascending: false })
      .limit(500);
    if (data.from) q = q.gte("purchase_date", data.from);
    if (data.to) q = q.lte("purchase_date", data.to);
    if (data.supplier_id) q = q.eq("supplier_id", data.supplier_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getPurchase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { data: purchase, error } = await context.supabase.from("purchases")
      .select("*, supplier:suppliers(id,name,phone)")
      .eq("id", data.id).eq("shop_id", shopId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!purchase) throw new Error("পাওয়া যায়নি");
    const { data: items } = await context.supabase.from("purchase_items")
      .select("*, product:products(name, unit:units(short_name))")
      .eq("purchase_id", data.id);
    return { purchase, items: items ?? [] };
  });

/* ---------------- Supplier Payments ---------------- */

const paySchema = z.object({
  supplier_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_method: z.enum(["cash", "bkash", "bank"]).default("cash"),
  payment_date: z.string().optional(),
  reference: z.string().trim().max(80).optional().nullable(),
  note: z.string().trim().max(200).optional().nullable(),
});

export const paySupplier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => paySchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { error } = await context.supabase.rpc("pay_supplier", {
      _shop_id: shopId,
      _supplier_id: data.supplier_id,
      _amount: data.amount,
      _payment_method: data.payment_method,
      _payment_date: data.payment_date ?? null,
      _reference: data.reference ?? null,
      _note: data.note ?? null,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
