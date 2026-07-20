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

/* ---------------- Categories ---------------- */

export const listCategories = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    const { data, error } = await context.supabase
      .from("categories").select("*").eq("shop_id", shopId).order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const catSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional().nullable(),
});

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => catSchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    if (data.id) {
      const { error } = await context.supabase.from("categories")
        .update({ name: data.name, description: data.description ?? null })
        .eq("id", data.id).eq("shop_id", shopId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("categories")
        .insert({ shop_id: shopId, name: data.name, description: data.description ?? null });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { error } = await context.supabase.from("categories")
      .delete().eq("id", data.id).eq("shop_id", shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Units ---------------- */

export const listUnits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    const { data, error } = await context.supabase
      .from("units").select("*").eq("shop_id", shopId).order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const unitSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(40),
  short_name: z.string().trim().min(1).max(10),
});

export const saveUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => unitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    if (data.id) {
      const { error } = await context.supabase.from("units")
        .update({ name: data.name, short_name: data.short_name })
        .eq("id", data.id).eq("shop_id", shopId);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase.from("units")
        .insert({ shop_id: shopId, name: data.name, short_name: data.short_name });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteUnit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { error } = await context.supabase.from("units")
      .delete().eq("id", data.id).eq("shop_id", shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Products ---------------- */

export const listProducts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const shopId = await getShopId(context);
    const { data, error } = await context.supabase
      .from("products")
      .select("*, category:categories(id,name), unit:units(id,short_name)")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const productSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  sku: z.string().trim().max(60).optional().nullable(),
  barcode: z.string().trim().max(60).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
  unit_id: z.string().uuid().optional().nullable(),
  purchase_price: z.number().nonnegative(),
  sale_price: z.number().nonnegative(),
  low_stock_alert: z.number().nonnegative().default(0),
  opening_stock: z.number().nonnegative().optional(),
  description: z.string().trim().max(500).optional().nullable(),
  is_active: z.boolean().default(true),
});

export const saveProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => productSchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const payload: any = {
      name: data.name,
      sku: data.sku || null,
      barcode: data.barcode || null,
      category_id: data.category_id || null,
      unit_id: data.unit_id || null,
      purchase_price: data.purchase_price,
      sale_price: data.sale_price,
      low_stock_alert: data.low_stock_alert,
      description: data.description || null,
      is_active: data.is_active,
    };
    if (data.id) {
      const { error } = await context.supabase.from("products")
        .update(payload).eq("id", data.id).eq("shop_id", shopId);
      if (error) throw new Error(error.message);
      return { ok: true, id: data.id };
    } else {
      const { data: created, error } = await context.supabase.from("products")
        .insert({ ...payload, shop_id: shopId, stock_quantity: 0 })
        .select("id").single();
      if (error) throw new Error(error.message);
      if (data.opening_stock && data.opening_stock > 0) {
        await context.supabase.rpc("apply_stock_movement", {
          _shop_id: shopId,
          _product_id: created.id,
          _movement_type: "opening",
          _quantity: data.opening_stock,
          _unit_cost: data.purchase_price,
          _reference_type: "opening",
          _reference_id: null as any,
          _note: "প্রারম্ভিক স্টক",
        } as any);
      }
      return { ok: true, id: created.id };
    }
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { error } = await context.supabase.from("products")
      .delete().eq("id", data.id).eq("shop_id", shopId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------- Stock adjustment ---------------- */

const adjustSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number(),
  note: z.string().max(200).optional().nullable(),
});

export const adjustStock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => adjustSchema.parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const { error } = await context.supabase.rpc("apply_stock_movement", {
      _shop_id: shopId,
      _product_id: data.product_id,
      _movement_type: "adjustment",
      _quantity: data.quantity,
      _unit_cost: null as any,
      _reference_type: "manual",
      _reference_id: null as any,
      _note: data.note ?? null,
    } as any);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listStockMovements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product_id: z.string().uuid().optional() }).parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    let q = context.supabase.from("stock_movements")
      .select("*, product:products(name)")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.product_id) q = q.eq("product_id", data.product_id);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getProductDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ product_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const shopId = await getShopId(context);
    const [prod, moves] = await Promise.all([
      context.supabase.from("products")
        .select("*, category:categories(name), unit:units(name, short_name)")
        .eq("id", data.product_id).eq("shop_id", shopId).single(),
      context.supabase.from("stock_movements")
        .select("*")
        .eq("shop_id", shopId).eq("product_id", data.product_id)
        .order("created_at", { ascending: false }).limit(500),
    ]);
    if (prod.error) throw new Error(prod.error.message);
    const rows = (moves.data ?? []) as any[];
    const totals = {
      purchased: rows.filter((r) => r.movement_type === "purchase").reduce((s, r) => s + Number(r.quantity || 0), 0),
      sold: rows.filter((r) => r.movement_type === "sale").reduce((s, r) => s + Number(r.quantity || 0), 0),
      adjustments: rows.filter((r) => r.movement_type === "adjustment").reduce((s, r) => s + Number(r.quantity || 0), 0),
      opening: rows.filter((r) => r.movement_type === "opening").reduce((s, r) => s + Number(r.quantity || 0), 0),
    };
    return { product: prod.data, movements: rows, totals };
  });
