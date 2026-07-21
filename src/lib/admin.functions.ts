import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase
    .from("user_roles")
    .select("id")
    .eq("user_id", context.userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: super admin only");
}

// ---------- Stats ----------
export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [total, active, expired, locked, packages, sms, revenue] = await Promise.all([
      supabaseAdmin.from("shops").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("shops").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabaseAdmin.from("shops").select("id", { count: "exact", head: true }).eq("status", "expired"),
      supabaseAdmin.from("shops").select("id", { count: "exact", head: true }).eq("status", "locked"),
      supabaseAdmin.from("packages").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("sms_logs").select("id", { count: "exact", head: true }),
      supabaseAdmin
        .from("subscription_payments")
        .select("amount")
        .eq("status", "success")
        .gte("created_at", monthStart.toISOString()),
    ]);
    const monthlyRevenue = (revenue.data ?? []).reduce(
      (s: number, r: any) => s + Number(r.amount || 0),
      0,
    );
    return {
      totalShops: total.count ?? 0,
      activeShops: active.count ?? 0,
      expiredShops: expired.count ?? 0,
      lockedShops: locked.count ?? 0,
      totalPackages: packages.count ?? 0,
      smsSent: sms.count ?? 0,
      monthlyRevenue,
    };
  });


// ---------- Shops ----------
export const listShops = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("shops")
      .select("*, package:packages!package_id(name), pending_package:packages!pending_package_id(name)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ---------- Admin notifications (bell) ----------
export const getAdminNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 86400_000).toISOString();
    const nowIso = now.toISOString();

    const [expiringRes, expiredRes, lockedRes, pendingPayRes] = await Promise.all([
      supabaseAdmin.from("shops").select("id, name, owner_name, subscription_end", { count: "exact" })
        .eq("status", "active").gte("subscription_end", nowIso).lte("subscription_end", in7).limit(20),
      supabaseAdmin.from("shops").select("id", { count: "exact", head: true }).eq("status", "expired"),
      supabaseAdmin.from("shops").select("id", { count: "exact", head: true }).eq("status", "locked"),
      supabaseAdmin.from("subscription_payments").select("id", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    const expiringSoon = (expiringRes.data ?? []) as any[];
    const items: { type: string; title: string; body: string; severity: "info" | "warn" | "danger"; href?: string }[] = [];

    if (expiringSoon.length > 0) items.push({
      type: "expiring", severity: "warn",
      title: `${expiringSoon.length} টি শপ ৭ দিনে মেয়াদ শেষ`,
      body: expiringSoon.slice(0, 3).map((s) => s.name).join(", ") + (expiringSoon.length > 3 ? "..." : ""),
      href: "/admin/shops",
    });
    if ((expiredRes.count ?? 0) > 0) items.push({
      type: "expired", severity: "danger",
      title: `${expiredRes.count} টি শপের মেয়াদ শেষ`,
      body: "রিনিউয়াল প্রয়োজন",
      href: "/admin/shops",
    });
    if ((lockedRes.count ?? 0) > 0) items.push({
      type: "locked", severity: "danger",
      title: `${lockedRes.count} টি লকড অ্যাকাউন্ট`,
      body: "পর্যালোচনা প্রয়োজন",
      href: "/admin/shops",
    });
    if ((pendingPayRes.count ?? 0) > 0) items.push({
      type: "pending-pay", severity: "warn",
      title: `${pendingPayRes.count} টি পেমেন্ট অপেক্ষমাণ`,
      body: "অনুমোদন প্রয়োজন",
      href: "/admin/subscriptions",
    });

    return {
      items,
      count: items.length,
      expiringSoon: expiringSoon.length,
      expired: expiredRes.count ?? 0,
      locked: lockedRes.count ?? 0,
      pendingPay: pendingPayRes.count ?? 0,
    };
  });

const createShopSchema = z.object({
  name: z.string().min(1),
  owner_name: z.string().min(1),
  phone: z.string().min(6),
  email: z.string().email(),
  address: z.string().optional(),
  package_id: z.string().uuid(),
  billing_cycle: z.enum(["monthly", "yearly"]),
  password: z.string().min(6),
});

export const createShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createShopSchema.parse(data))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Create auth user
    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.owner_name, phone: data.phone },
    });
    if (userErr || !userData.user) throw new Error(userErr?.message ?? "User create failed");

    // 2) Get package price
    const { data: pkg } = await supabaseAdmin
      .from("packages").select("*").eq("id", data.package_id).single();
    const amount = data.billing_cycle === "monthly" ? pkg?.price_monthly : pkg?.price_yearly;

    // 3) Create shop in pending_payment state (no subscription_end yet)
    const { data: shop, error: shopErr } = await supabaseAdmin
      .from("shops")
      .insert({
        name: data.name,
        owner_name: data.owner_name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        package_id: data.package_id,
        billing_cycle: data.billing_cycle,
        status: "pending_payment",
        created_by: context.userId,
      })
      .select()
      .single();
    if (shopErr) throw new Error(shopErr.message);

    // 4) Assign shop_owner role
    await supabaseAdmin.from("user_roles").insert({
      user_id: userData.user.id,
      role: "shop_owner",
      shop_id: shop.id,
    });

    // 5) Generate initial pending invoice
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const { data: invoice } = await supabaseAdmin
      .from("subscription_payments")
      .insert({
        shop_id: shop.id,
        amount: amount ?? 0,
        payment_method: "bkash",
        status: "pending",
        invoice_type: "initial",
        due_date: dueDate.toISOString().slice(0, 10),
        raw_response: { manual: true, package_id: data.package_id, billing_cycle: data.billing_cycle },
      })
      .select("id, invoice_no, amount")
      .single();

    // 6) Send account created SMS (non-blocking)
    try {
      const { sendTemplateSMS } = await import("./sms.server");
      await sendTemplateSMS("account_created", data.phone, {
        shop_name: data.name,
        owner: data.owner_name,
        phone: data.phone,
        password: data.password,
        package: pkg?.name ?? "",
        end_date: dueDate.toLocaleDateString("bn-BD"),
        invoice_no: invoice?.invoice_no ?? "",
        amount: String(amount ?? 0),
      }, { shopId: shop.id });
    } catch (e) {
      console.error("account_created SMS failed", e);
    }

    return { shop, invoice, credentials: { email: data.email, password: data.password } };
  });

export const updateShopStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      shop_id: z.string().uuid(),
      status: z.enum(["active", "expired", "locked", "suspended"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("shops").update({ status: data.status }).eq("id", data.shop_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const extendShopSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ shop_id: z.string().uuid(), months: z.number().int().min(1).max(24) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: shop } = await supabaseAdmin
      .from("shops").select("subscription_end").eq("id", data.shop_id).single();
    const base = shop?.subscription_end ? new Date(shop.subscription_end) : new Date();
    if (base < new Date()) base.setTime(Date.now());
    base.setMonth(base.getMonth() + data.months);
    const { error } = await supabaseAdmin
      .from("shops")
      .update({ status: "active", subscription_end: base.toISOString() })
      .eq("id", data.shop_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Packages ----------
export const listPackages = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("packages").select("*").order("sort_order");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const pkgSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  price_monthly: z.number().min(0),
  price_yearly: z.number().min(0),
  max_products: z.number().int().min(0),
  max_users: z.number().int().min(1),
  max_sms_per_month: z.number().int().min(0),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0),
});

export const savePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => pkgSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = { ...data };
    if (data.id) {
      const { error } = await supabaseAdmin.from("packages").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("packages").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deletePackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("packages").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Gateway Settings ----------
export const getGatewaySettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [bkash, sms, templates] = await Promise.all([
      supabaseAdmin.from("payment_gateway_settings").select("*").eq("provider", "bkash").maybeSingle(),
      supabaseAdmin.from("sms_gateway_settings").select("*").eq("provider", "greenweb").maybeSingle(),
      supabaseAdmin.from("sms_templates").select("*").order("code"),
    ]);
    return { bkash: bkash.data, sms: sms.data, templates: templates.data ?? [] };
  });

export const saveBkashSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      mode: z.enum(["sandbox", "live"]),
      app_key: z.string().optional(),
      app_secret: z.string().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      merchant_number: z.string().optional(),
      is_active: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("payment_gateway_settings")
      .update(data)
      .eq("provider", "bkash");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveSmsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      api_token: z.string().optional(),
      sender_id: z.string().optional(),
      is_active: z.boolean(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("sms_gateway_settings").update(data).eq("provider", "greenweb");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveSmsTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), title: z.string(), body: z.string(), is_active: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("sms_templates")
      .update({ title: data.title, body: data.body, is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Subscription Payments ----------
export const listSubscriptionPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ status: z.enum(["pending", "success", "failed", "refunded", "all"]).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("subscription_payments")
      .select("*, shop:shops(name, owner_name, phone, package_id, billing_cycle, subscription_end)")
      .order("created_at", { ascending: false });
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const approveSubscriptionPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ payment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: pay, error: payErr } = await supabaseAdmin
      .from("subscription_payments").select("*").eq("id", data.payment_id).single();
    if (payErr || !pay) throw new Error(payErr?.message ?? "Payment not found");
    if (pay.status !== "pending") throw new Error("এই পেমেন্ট already processed");

    // Delegate to shared idempotent activation so admin approve + bKash callback + webhook
    // all go through the same path.
    const { activatePaymentAndExtendShop } = await import("./subscription.server");
    const { resolveActor } = await import("./audit.server");
    const actor = await resolveActor(context.userId);
    const r = await activatePaymentAndExtendShop(pay.id, {
      actorUserId: context.userId,
      actorEmail: actor.actor_email,
      source: "admin_approval",
    });

    // Extra audit entry for the human action (activate function logs source=admin_approval already)
    try {
      const { logAudit } = await import("./audit.server");
      await logAudit({
        actor_user_id: context.userId, actor_email: actor.actor_email, actor_role: "super_admin",
        shop_id: pay.shop_id, action: "invoice.approved",
        target_type: "subscription_payment", target_id: pay.id,
        details: { invoice_no: (pay as any).invoice_no, amount: pay.amount, alreadyProcessed: r.alreadyProcessed ?? false },
      });
    } catch {}
    return { ok: true, ...r };
  });

// Legacy inline activation kept below (unreachable) — remove once verified.
const _unusedLegacyApprove = async ({ data, context }: any) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pay } = await supabaseAdmin
      .from("subscription_payments").select("*").eq("id", data.payment_id).single();
    const { data: shop } = await supabaseAdmin
      .from("shops").select("*, package:packages!package_id(*)").eq("id", pay!.shop_id).single();
    if (!shop) throw new Error("Shop not found");
    void context;

    // Determine billing cycle from linked subscription (if any) or shop default
    let months = 1;
    let pkgId: string | null = shop.package_id;
    let cycle: "monthly" | "yearly" = shop.billing_cycle as any;
    if (pay!.subscription_id) {
      const { data: sub } = await supabaseAdmin
        .from("subscriptions").select("*").eq("id", pay!.subscription_id).single();
      if (sub) {
        cycle = sub.billing_cycle as any;
        pkgId = sub.package_id;
        months = sub.billing_cycle === "yearly" ? 12 : 1;
      }
    } else {
      months = cycle === "yearly" ? 12 : 1;
    }

    // Extend from max(now, current end)
    const base = shop.subscription_end && new Date(shop.subscription_end) > new Date()
      ? new Date(shop.subscription_end) : new Date();
    const start = new Date();
    base.setMonth(base.getMonth() + months);

    await supabaseAdmin.from("shops").update({
      status: "active",
      subscription_end: base.toISOString(),
      subscription_start: shop.subscription_start ?? start.toISOString(),
      package_id: pkgId,
      billing_cycle: cycle,
    }).eq("id", shop.id);

    await supabaseAdmin.from("subscription_payments").update({
      status: "success",
      paid_at: new Date().toISOString(),
    }).eq("id", pay!.id);

    if (pay!.subscription_id) {
      await supabaseAdmin.from("subscriptions").update({
        status: "active",
        ends_at: base.toISOString(),
      }).eq("id", pay!.subscription_id);
    } else {
      await supabaseAdmin.from("subscriptions").insert({
        shop_id: shop.id,
        package_id: pkgId!,
        billing_cycle: cycle,
        amount: pay!.amount,
        status: "active",
        starts_at: start.toISOString(),
        ends_at: base.toISOString(),
      });
    }

    // SMS: upgraded (if package changed) or renewed
    try {
      const { sendTemplateSMS } = await import("./sms.server");
      const { data: pkgRow } = await supabaseAdmin
        .from("packages").select("name").eq("id", pkgId!).maybeSingle();
      const isUpgrade = pkgId && shop.package_id && pkgId !== shop.package_id;
      const endStr = new Date(base).toLocaleDateString("bn-BD");
      if (isUpgrade) {
        await sendTemplateSMS("upgraded", shop.phone, {
          shop_name: shop.name, owner: shop.owner_name,
          package: pkgRow?.name ?? "", end_date: endStr, amount: pay!.amount,
        }, { shopId: shop.id });
      } else {
        await sendTemplateSMS("renewed", shop.phone, {
          shop_name: shop.name, owner: shop.owner_name,
          package: pkgRow?.name ?? "", end_date: endStr, amount: pay!.amount,
        }, { shopId: shop.id });
      }
    } catch (e) {
      console.error("renewal SMS failed", e);
    }

    return { ok: true };
};

export const rejectSubscriptionPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ payment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("subscription_payments").update({ status: "failed" }).eq("id", data.payment_id);
    if (error) throw new Error(error.message);
    try {
      const { logAudit, resolveActor } = await import("./audit.server");
      const actor = await resolveActor(context.userId);
      await logAudit({
        actor_user_id: context.userId, actor_email: actor.actor_email, actor_role: "super_admin",
        action: "invoice.rejected", target_type: "subscription_payment", target_id: data.payment_id,
      });
    } catch {}
    return { ok: true };
  });

export const syncExpiredShops = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("shops")
      .update({ status: "expired" })
      .lt("subscription_end", new Date().toISOString())
      .eq("status", "active")
      .select("id, name, owner_name, phone");
    if (error) throw new Error(error.message);

    // Send expired SMS for each — non-blocking failures
    try {
      const { sendTemplateSMS } = await import("./sms.server");
      for (const s of data ?? []) {
        await sendTemplateSMS("expired", s.phone, {
          shop_name: s.name, owner: s.owner_name,
        }, { shopId: s.id });
      }
    } catch (e) {
      console.error("expired SMS batch failed", e);
    }
    return { updated: data?.length ?? 0 };
  });

// ---------- SMS Logs & Test ----------
export const listSmsLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ limit: z.number().int().min(1).max(500).optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("sms_logs")
      .select("*, shop:shops(name)")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const sendTestSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ phone: z.string().min(6), message: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { sendRawSMS } = await import("./sms.server");
    const r = await sendRawSMS(data.phone, data.message);
    return r;
  });

// ---------- Shop detail / edit / delete ----------
export const getShopDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ shop_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sid = data.shop_id;

    const { data: shop, error } = await supabaseAdmin
      .from("shops").select("*, package:packages!package_id(*), pending_package:packages!pending_package_id(*)").eq("id", sid).single();
    if (error) throw new Error(error.message);

    const [payments, subs, roles, sales, purchases, customers, suppliers, products, custPays, supPays] = await Promise.all([
      supabaseAdmin.from("subscription_payments").select("*").eq("shop_id", sid).order("created_at", { ascending: false }).limit(30),
      supabaseAdmin.from("subscriptions").select("*, package:packages(name, price_monthly, price_yearly)").eq("shop_id", sid).order("created_at", { ascending: false }),
      supabaseAdmin.from("user_roles").select("id, user_id, role, created_at").eq("shop_id", sid),
      supabaseAdmin.from("sales").select("total, paid, due, payment_method, sale_type").eq("shop_id", sid),
      supabaseAdmin.from("purchases").select("total, paid, due, payment_method").eq("shop_id", sid),
      supabaseAdmin.from("customers").select("id, name, phone, current_balance").eq("shop_id", sid).order("name"),
      supabaseAdmin.from("suppliers").select("id, name, phone, current_balance").eq("shop_id", sid).order("name"),
      supabaseAdmin.from("products").select("id, name, sku, stock_quantity, low_stock_alert, purchase_price, sale_price, unit:units(name)").eq("shop_id", sid).order("name"),
      supabaseAdmin.from("customer_payments").select("amount, payment_method").eq("shop_id", sid),
      supabaseAdmin.from("supplier_payments").select("amount, payment_method").eq("shop_id", sid),
    ]);

    const users: any[] = [];
    for (const r of roles.data ?? []) {
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
        users.push({ id: r.id, user_id: r.user_id, role: r.role, email: u.user?.email, created_at: u.user?.created_at ?? r.created_at });
      } catch {
        users.push({ id: r.id, user_id: r.user_id, role: r.role, email: null, created_at: r.created_at });
      }
    }

    const sumBy = (rows: any[], field: string, method?: string) =>
      (rows ?? []).filter((r) => (method ? r.payment_method === method : true))
        .reduce((s, r) => s + Number(r[field] || 0), 0);

    const totals = {
      totalSales: sumBy(sales.data ?? [], "total"),
      totalPurchases: sumBy(purchases.data ?? [], "total"),
      totalDue: sumBy(sales.data ?? [], "due"),
      totalPaidToSuppliers: sumBy(purchases.data ?? [], "paid"),
      cashIn: sumBy(custPays.data ?? [], "amount", "cash"),
      bkashIn: sumBy(custPays.data ?? [], "amount", "bkash"),
      cashOut: sumBy(supPays.data ?? [], "amount", "cash"),
      bkashOut: sumBy(supPays.data ?? [], "amount", "bkash"),
      customersCount: (customers.data ?? []).length,
      suppliersCount: (suppliers.data ?? []).length,
      productsCount: (products.data ?? []).length,
      lowStockCount: (products.data ?? []).filter((p: any) => Number(p.stock_quantity) <= Number(p.low_stock_alert || 0)).length,
    };

    return {
      shop, payments: payments.data ?? [], subscriptions: subs.data ?? [], users,
      customers: customers.data ?? [], suppliers: suppliers.data ?? [], products: products.data ?? [],
      totals,
    };
  });

export const upgradeShopPackage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      shop_id: z.string().uuid(),
      package_id: z.string().uuid(),
      billing_cycle: z.enum(["monthly", "yearly"]),
      months: z.number().int().min(1).max(60).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { computePackageChange, applyImmediateDowngrade } = await import("./proration.server");
    const change = await computePackageChange({
      shop_id: data.shop_id,
      new_package_id: data.package_id,
      new_billing_cycle: data.billing_cycle,
    });

    // Downgrade or zero-net → apply immediately with credit
    if (change.net_amount <= 0) {
      await applyImmediateDowngrade(data.shop_id, change);
      return { ok: true, kind: "immediate", change };
    }

    // Upgrade → create pending invoice, keep current package active
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 7);
    const { data: invoice, error: invErr } = await supabaseAdmin
      .from("subscription_payments")
      .insert({
        shop_id: data.shop_id,
        amount: change.net_amount,
        payment_method: "bkash",
        status: "pending",
        invoice_type: "upgrade",
        due_date: dueDate.toISOString().slice(0, 10),
        proration_details: change as any,
        raw_response: { manual: true, package_id: data.package_id, billing_cycle: data.billing_cycle },
      })
      .select("id, invoice_no, amount")
      .single();
    if (invErr) throw new Error(invErr.message);

    await supabaseAdmin.from("shops").update({
      pending_package_id: data.package_id,
      pending_billing_cycle: data.billing_cycle,
    }).eq("id", data.shop_id);

    return { ok: true, kind: "pending", invoice, change };
  });

// Preview a package change without creating anything
export const previewPackageChange = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      shop_id: z.string().uuid(),
      package_id: z.string().uuid(),
      billing_cycle: z.enum(["monthly", "yearly"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { computePackageChange } = await import("./proration.server");
    return await computePackageChange({
      shop_id: data.shop_id,
      new_package_id: data.package_id,
      new_billing_cycle: data.billing_cycle,
    });
  });

// Cancel a pending upgrade (admin)
export const cancelPendingUpgrade = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ shop_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Cancel pending upgrade invoices
    await supabaseAdmin.from("subscription_payments")
      .update({ status: "failed" })
      .eq("shop_id", data.shop_id)
      .eq("status", "pending")
      .eq("invoice_type", "upgrade");
    await supabaseAdmin.from("shops").update({
      pending_package_id: null,
      pending_billing_cycle: null,
    }).eq("id", data.shop_id);
    return { ok: true };
  });

export const resetShopUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(6) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeShopUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid(), shop_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("shop_id", data.shop_id);
    try { await supabaseAdmin.auth.admin.deleteUser(data.user_id); } catch {}
    return { ok: true };
  });

export const updateShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      shop_id: z.string().uuid(),
      name: z.string().min(1),
      owner_name: z.string().min(1),
      phone: z.string().min(6),
      email: z.string().email(),
      address: z.string().optional().nullable(),
      package_id: z.string().uuid().optional().nullable(),
      billing_cycle: z.enum(["monthly", "yearly"]).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { shop_id, ...update } = data;
    const { error } = await supabaseAdmin.from("shops").update(update).eq("id", shop_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ shop_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Remove owner auth users linked only to this shop
    const { data: roles } = await supabaseAdmin
      .from("user_roles").select("user_id").eq("shop_id", data.shop_id);
    const { error } = await supabaseAdmin.from("shops").delete().eq("id", data.shop_id);
    if (error) throw new Error(error.message);
    for (const r of roles ?? []) {
      try { await supabaseAdmin.auth.admin.deleteUser(r.user_id); } catch {}
    }
    return { ok: true };
  });

// ---------- Payment receipt ----------
export const getPaymentReceipt = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ payment_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: pay, error } = await supabaseAdmin
      .from("subscription_payments")
      .select("*, shop:shops(name, owner_name, phone, email, address, package:packages!package_id(name)), subscription:subscriptions(billing_cycle, starts_at, ends_at, package:packages(name))")
      .eq("id", data.payment_id)
      .single();
    if (error) throw new Error(error.message);
    const { data: brand } = await supabaseAdmin.from("app_branding").select("*").limit(1).maybeSingle();
    return { payment: pay, brand };
  });

// ---------- Branding ----------
export const getBranding = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("app_branding").select("*").limit(1).maybeSingle();
    return data;
  });

export const saveBranding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      site_name: z.string().min(1),
      tagline: z.string().optional().nullable(),
      logo_url: z.string().optional().nullable(),
      favicon_url: z.string().optional().nullable(),
      contact_email: z.string().optional().nullable(),
      contact_phone: z.string().optional().nullable(),
      contact_address: z.string().optional().nullable(),
      facebook_url: z.string().optional().nullable(),
      website_url: z.string().optional().nullable(),
      footer_note: z.string().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin.from("app_branding").select("id").limit(1).maybeSingle();
    if (existing) {
      const { error } = await supabaseAdmin.from("app_branding").update(data).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("app_branding").insert(data);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });


// ---------- Subscription invoice ----------
export const getSubscriptionInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ subscription_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub, error } = await supabaseAdmin
      .from("subscriptions")
      .select("*, shop:shops(name, owner_name, phone, email, address), package:packages(name, price_monthly, price_yearly)")
      .eq("id", data.subscription_id)
      .single();
    if (error) throw new Error(error.message);
    const { data: brand } = await supabaseAdmin.from("app_branding").select("*").limit(1).maybeSingle();
    // Related payment (if any)
    const { data: pay } = await supabaseAdmin
      .from("subscription_payments")
      .select("*")
      .eq("subscription_id", data.subscription_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return { subscription: sub, brand, payment: pay };
  });

// ---------- Super Admin user management ----------
export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles").select("id, user_id, created_at").eq("role", "super_admin");
    if (error) throw new Error(error.message);
    const rows: any[] = [];
    for (const r of roles ?? []) {
      try {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(r.user_id);
        rows.push({
          role_id: r.id,
          user_id: r.user_id,
          email: u.user?.email ?? null,
          full_name: (u.user?.user_metadata as any)?.full_name ?? "",
          created_at: u.user?.created_at ?? r.created_at,
          last_sign_in_at: u.user?.last_sign_in_at ?? null,
        });
      } catch {
        rows.push({ role_id: r.id, user_id: r.user_id, email: null, full_name: "", created_at: r.created_at, last_sign_in_at: null });
      }
    }
    return rows.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
  });

export const createAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      email: z.string().email(),
      password: z.string().min(6),
      full_name: z.string().min(1),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (userErr || !userData.user) throw new Error(userErr?.message ?? "User create failed");
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: userData.user.id,
      role: "super_admin",
    });
    if (rErr) {
      try { await supabaseAdmin.auth.admin.deleteUser(userData.user.id); } catch {}
      throw new Error(rErr.message);
    }
    return { ok: true };
  });

export const deleteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    if (data.user_id === context.userId) throw new Error("নিজেকে মুছে ফেলা যাবে না");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Ensure at least one super admin remains
    const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "super_admin");
    if ((count ?? 0) <= 1) throw new Error("কমপক্ষে একজন সুপার এডমিন থাকতে হবে");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id).eq("role", "super_admin");
    try { await supabaseAdmin.auth.admin.deleteUser(data.user_id); } catch {}
    return { ok: true };
  });

export const resetAdminPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), password: z.string().min(6) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, { password: data.password });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Admin dashboard extras (charts + drilldowns) ----------
export const getAdminExtras = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ days: z.number().int().min(7).max(365).default(30) }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const days: string[] = [];
    for (let i = data.days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().slice(0, 10));
    }
    const from = days[0];
    const fromIso = new Date(from + "T00:00:00").toISOString();

    const [shops, payments, packages, expiring, smsRows] = await Promise.all([
      supabaseAdmin.from("shops").select("id, status, package_id, created_at, subscription_end, name, owner_name"),
      supabaseAdmin.from("subscription_payments").select("amount, created_at, status").eq("status", "success").gte("created_at", fromIso),
      supabaseAdmin.from("packages").select("id, name"),
      supabaseAdmin.from("shops").select("id, name, owner_name, subscription_end, status")
        .in("status", ["active", "expired"]).order("subscription_end", { ascending: true }).limit(10),
      supabaseAdmin.from("sms_logs").select("status, created_at").gte("created_at", fromIso),
    ]);

    const shopRows = (shops.data ?? []) as any[];
    const payRows = (payments.data ?? []) as any[];
    const pkgRows = (packages.data ?? []) as any[];

    // trend maps
    const shopMap = new Map<string, number>();
    const revenueMap = new Map<string, number>();
    for (const d of days) { shopMap.set(d, 0); revenueMap.set(d, 0); }
    for (const s of shopRows) {
      const d = String(s.created_at).slice(0, 10);
      if (shopMap.has(d)) shopMap.set(d, (shopMap.get(d) ?? 0) + 1);
    }
    for (const p of payRows) {
      const d = String(p.created_at).slice(0, 10);
      if (revenueMap.has(d)) revenueMap.set(d, (revenueMap.get(d) ?? 0) + Number(p.amount || 0));
    }
    const trend = days.map((d) => ({
      date: d,
      shops: shopMap.get(d) ?? 0,
      revenue: revenueMap.get(d) ?? 0,
    }));

    // status breakdown
    const statusBreakdown = ["active", "expired", "locked", "suspended", "pending"].map((s) => ({
      status: s,
      count: shopRows.filter((r) => r.status === s).length,
    }));

    // top packages
    const pkgName = new Map(pkgRows.map((p) => [p.id, p.name]));
    const pkgCount = new Map<string, number>();
    for (const s of shopRows) {
      const k = s.package_id ?? "none";
      pkgCount.set(k, (pkgCount.get(k) ?? 0) + 1);
    }
    const topPackages = Array.from(pkgCount.entries())
      .map(([id, count]) => ({ id, name: pkgName.get(id) ?? "—", count }))
      .sort((a, b) => b.count - a.count).slice(0, 6);

    // sms stats
    const smsAll = (smsRows.data ?? []) as any[];
    const smsStats = {
      total: smsAll.length,
      sent: smsAll.filter((r) => r.status === "sent").length,
      failed: smsAll.filter((r) => r.status === "failed").length,
    };

    // revenue total (period)
    const revenuePeriod = payRows.reduce((s, r) => s + Number(r.amount || 0), 0);

    return {
      trend,
      statusBreakdown,
      topPackages,
      upcomingExpirations: expiring.data ?? [],
      smsStats,
      revenuePeriod,
      newShopsPeriod: trend.reduce((s, t) => s + t.shops, 0),
    };
  });
