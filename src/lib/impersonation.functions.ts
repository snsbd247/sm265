import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Super admin issues a short-lived, one-time token to impersonate a shop's owner.
 * The token is redeemed in a new tab (see /impersonate route).
 */
export const createImpersonationToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ shop_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verify super admin
    const { data: isAdmin } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("অনুমতি নেই।");

    // Find a shop owner (preferred) or any member for this shop
    const { data: roles, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("shop_id", data.shop_id);
    if (rErr) throw new Error(rErr.message);
    if (!roles || roles.length === 0) throw new Error("এই শপে কোনো ইউজার নেই।");

    const target = roles.find((r) => r.role === "shop_owner") ?? roles[0];

    const token = randomToken();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();

    const { error: insErr } = await supabaseAdmin.from("impersonation_tokens").insert({
      token,
      admin_user_id: context.userId,
      target_user_id: target.user_id,
      shop_id: data.shop_id,
      expires_at: expiresAt,
    });
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin.from("impersonation_audit").insert({
      admin_user_id: context.userId,
      target_user_id: target.user_id,
      shop_id: data.shop_id,
      action: "issued",
    });

    return { token };
  });

/**
 * Public server function: redeems a token and returns a magic-link `token_hash`
 * that the client can pass to supabase.auth.verifyOtp() to establish a session
 * as the target user — inside the impersonation tab's sandboxed storage.
 */
export const redeemImpersonationToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("impersonation_tokens")
      .select("*")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("অবৈধ টোকেন।");
    if (row.consumed_at) throw new Error("টোকেন আগেই ব্যবহার হয়েছে।");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("টোকেনের মেয়াদ শেষ।");

    // Mark consumed first (best-effort atomicity)
    const { error: upErr } = await supabaseAdmin
      .from("impersonation_tokens")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id)
      .is("consumed_at", null);
    if (upErr) throw new Error(upErr.message);

    // Get the target user's email
    const { data: userRes, error: uErr } = await supabaseAdmin.auth.admin.getUserById(row.target_user_id);
    if (uErr || !userRes?.user?.email) throw new Error("টার্গেট ইউজার পাওয়া যায়নি।");
    const email = userRes.user.email;

    // Generate a magic link and return the hashed token for client-side verifyOtp
    const { data: link, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (linkErr || !link?.properties?.hashed_token) throw new Error(linkErr?.message ?? "ম্যাজিক লিংক তৈরি ব্যর্থ।");

    await supabaseAdmin.from("impersonation_audit").insert({
      admin_user_id: row.admin_user_id,
      target_user_id: row.target_user_id,
      shop_id: row.shop_id,
      action: "redeemed",
    });

    return {
      token_hash: link.properties.hashed_token,
      email,
      shop_id: row.shop_id,
    };
  });

export const listImpersonationAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin } = await context.supabase.rpc("is_super_admin", { _user_id: context.userId });
    if (!isAdmin) throw new Error("অনুমতি নেই।");
    const { data, error } = await supabaseAdmin
      .from("impersonation_audit")
      .select("*, shop:shops(name)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    const rows = data ?? [];

    // Batch-fetch profile names for admin/target users
    const userIds = Array.from(new Set(rows.flatMap((r) => [r.admin_user_id, r.target_user_id]).filter(Boolean)));
    const nameMap = new Map<string, { name: string; email?: string }>();
    if (userIds.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, phone")
        .in("id", userIds);
      for (const p of profiles ?? []) nameMap.set(p.id, { name: p.full_name || p.phone || p.id.slice(0, 8) });
      // Fill emails from auth for any user missing name
      for (const uid of userIds) {
        if (!nameMap.get(uid)?.name) {
          const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
          const email = u?.user?.email;
          nameMap.set(uid, { name: email ?? uid.slice(0, 8), email });
        }
      }
    }

    return {
      rows: rows.map((r) => ({
        id: r.id,
        created_at: r.created_at,
        action: r.action,
        shop_id: r.shop_id,
        shop_name: (r as { shop?: { name?: string } | null }).shop?.name ?? "—",
        admin_user_id: r.admin_user_id,
        admin_name: nameMap.get(r.admin_user_id)?.name ?? r.admin_user_id.slice(0, 8),
        target_user_id: r.target_user_id,
        target_name: nameMap.get(r.target_user_id)?.name ?? r.target_user_id.slice(0, 8),
      })),
    };
  });
