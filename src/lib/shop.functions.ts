import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getUserShopId(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase
    .from("user_roles")
    .select("shop_id, role")
    .eq("user_id", context.userId)
    .not("shop_id", "is", null)
    .limit(1)
    .maybeSingle();
  return { shopId: data?.shop_id as string | null, role: data?.role as string | null };
}

export const getMyShop = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { shopId, role } = await getUserShopId(context);
    if (!shopId) return { shop: null, role: null };

    const { data: shop } = await context.supabase
      .from("shops")
      .select("*, package:packages!package_id(*), pending_package:packages!pending_package_id(*)")
      .eq("id", shopId)
      .single();

    if (shop && shop.subscription_end && new Date(shop.subscription_end) < new Date()
        && shop.status === "active") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("shops").update({ status: "expired" }).eq("id", shop.id);
      shop.status = "expired";
    }

    return { shop, role };
  });

export const listMyPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { shopId } = await getUserShopId(context);
    if (!shopId) return [];
    const { data } = await context.supabase
      .from("subscription_payments")
      .select("*")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const listMySubscriptions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { shopId } = await getUserShopId(context);
    if (!shopId) return [];
    const { data } = await context.supabase
      .from("subscriptions")
      .select("*, package:packages(name)")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const getMyPendingInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { shopId } = await getUserShopId(context);
    if (!shopId) return null;
    const { data } = await context.supabase
      .from("subscription_payments")
      .select("*")
      .eq("shop_id", shopId)
      .eq("status", "pending")
      .in("invoice_type", ["initial", "upgrade"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  });

export const cancelMyPendingUpgrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { shopId } = await getUserShopId(context);
    if (!shopId) throw new Error("দোকান পাওয়া যায়নি");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("subscription_payments")
      .update({ status: "failed" })
      .eq("shop_id", shopId).eq("status", "pending").eq("invoice_type", "upgrade");
    await supabaseAdmin.from("shops").update({
      pending_package_id: null, pending_billing_cycle: null,
    }).eq("id", shopId);
    return { ok: true };
  });

const renewalSchema = z.object({
  package_id: z.string().uuid(),
  billing_cycle: z.enum(["monthly", "yearly"]),
  transaction_id: z.string().min(4),
  bkash_number: z.string().optional(),
});

export const submitRenewalPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => renewalSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { shopId } = await getUserShopId(context);
    if (!shopId) throw new Error("দোকান পাওয়া যায়নি");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pkg } = await supabaseAdmin
      .from("packages").select("*").eq("id", data.package_id).single();
    if (!pkg) throw new Error("প্যাকেজ পাওয়া যায়নি");

    const amount = data.billing_cycle === "monthly" ? pkg.price_monthly : pkg.price_yearly;

    const { error } = await supabaseAdmin.from("subscription_payments").insert({
      shop_id: shopId,
      amount,
      payment_method: "bkash",
      transaction_id: data.transaction_id,
      bkash_payment_id: data.bkash_number ?? null,
      status: "pending",
      raw_response: { manual: true, package_id: data.package_id, billing_cycle: data.billing_cycle },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const initiateSchema = z.object({
  package_id: z.string().uuid(),
  billing_cycle: z.enum(["monthly", "yearly"]),
});

export const initiateBkashPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => initiateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { shopId } = await getUserShopId(context);
    if (!shopId) throw new Error("দোকান পাওয়া যায়নি");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: shop } = await supabaseAdmin
      .from("shops").select("*").eq("id", shopId).single();
    if (!shop) throw new Error("দোকান পাওয়া যায়নি");

    const { data: pkg } = await supabaseAdmin
      .from("packages").select("*").eq("id", data.package_id).single();
    if (!pkg) throw new Error("প্যাকেজ পাওয়া যায়নি");
    const amount = data.billing_cycle === "monthly" ? pkg.price_monthly : pkg.price_yearly;

    // Create pending payment row first (id = merchantInvoiceNumber)
    const { data: pay, error: payErr } = await supabaseAdmin
      .from("subscription_payments")
      .insert({
        shop_id: shopId,
        amount,
        payment_method: "bkash",
        status: "pending",
        raw_response: { auto: true, package_id: data.package_id, billing_cycle: data.billing_cycle },
      })
      .select("id")
      .single();
    if (payErr || !pay) throw new Error(payErr?.message ?? "Payment row create failed");

    const { createBkashPayment } = await import("./bkash.server");
    const req = getRequest();
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const base = origin ?? (host ? `${proto}://${host}` : new URL(req.url).origin);

    const callbackURL = `${base}/api/public/bkash/callback?pid=${pay.id}`;

    try {
      const result = await createBkashPayment({
        amount,
        invoiceNumber: pay.id.replace(/-/g, "").slice(0, 20),
        callbackURL,
        payerReference: shop.phone ?? shop.owner_name ?? "shop",
      });
      await supabaseAdmin.from("subscription_payments").update({
        bkash_payment_id: result.paymentID,
        raw_response: { ...(pay as any).raw_response, ...result.raw, create: result.raw },
      }).eq("id", pay.id);
      return { url: result.bkashURL, paymentID: result.paymentID };
    } catch (e: any) {
      await supabaseAdmin.from("subscription_payments").update({
        status: "failed",
        raw_response: { error: e?.message ?? String(e) },
      }).eq("id", pay.id);
      throw e;
    }
  });

// Initiate bKash on an existing pending invoice
export const initiateBkashForInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ invoice_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { shopId } = await getUserShopId(context);
    if (!shopId) throw new Error("দোকান পাওয়া যায়নি");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pay, error } = await supabaseAdmin
      .from("subscription_payments")
      .select("*").eq("id", data.invoice_id).eq("shop_id", shopId).single();
    if (error || !pay) throw new Error("ইনভয়েস পাওয়া যায়নি");
    if (pay.status !== "pending") throw new Error("এই ইনভয়েস আর পেয়েবল নয়");

    const { data: shop } = await supabaseAdmin.from("shops").select("*").eq("id", shopId).single();
    if (!shop) throw new Error("দোকান পাওয়া যায়নি");

    const { createBkashPayment } = await import("./bkash.server");
    const req = getRequest();
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    const proto = req.headers.get("x-forwarded-proto") ?? "https";
    const base = origin ?? (host ? `${proto}://${host}` : new URL(req.url).origin);
    const callbackURL = `${base}/api/public/bkash/callback?pid=${pay.id}`;

    try {
      const result = await createBkashPayment({
        amount: Number(pay.amount),
        invoiceNumber: pay.id.replace(/-/g, "").slice(0, 20),
        callbackURL,
        payerReference: shop.phone ?? shop.owner_name ?? "shop",
      });
      await supabaseAdmin.from("subscription_payments").update({
        bkash_payment_id: result.paymentID,
        raw_response: { ...(pay as any).raw_response, create: result.raw },
      }).eq("id", pay.id);
      return { url: result.bkashURL, paymentID: result.paymentID };
    } catch (e: any) {
      throw e;
    }
  });

// Submit manual TrxID against a pending invoice
export const submitInvoiceTrx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({
    invoice_id: z.string().uuid(),
    transaction_id: z.string().min(4),
    bkash_number: z.string().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { shopId } = await getUserShopId(context);
    if (!shopId) throw new Error("দোকান পাওয়া যায়নি");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("subscription_payments").update({
      transaction_id: data.transaction_id,
      bkash_payment_id: data.bkash_number ?? null,
    }).eq("id", data.invoice_id).eq("shop_id", shopId).eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
