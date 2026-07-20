// Public cron endpoint: mark expired shops + send warning SMS at T-7 and T-1.
// Guard with CRON_SECRET header. Call from pg_cron or an external scheduler.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/expiry-check")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.CRON_SECRET;
        const provided = request.headers.get("x-cron-secret");
        if (!secret || provided !== secret) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { sendTemplateSMS } = await import("@/lib/sms.server");

        const now = new Date();
        const in1 = new Date(now); in1.setDate(in1.getDate() + 1);
        const in7 = new Date(now); in7.setDate(in7.getDate() + 7);

        // 1) Auto-lock expired
        const { data: expired } = await supabaseAdmin
          .from("shops")
          .update({ status: "expired" })
          .lt("subscription_end", now.toISOString())
          .eq("status", "active")
          .select("id, name, owner_name, phone");
        for (const s of expired ?? []) {
          await sendTemplateSMS("expired", s.phone, {
            shop_name: s.name, owner: s.owner_name,
          }, { shopId: s.id });
        }

        // 2) T-1 warning
        const { data: warn1 } = await supabaseAdmin
          .from("shops")
          .select("id, name, owner_name, phone, subscription_end")
          .eq("status", "active")
          .gte("subscription_end", now.toISOString())
          .lt("subscription_end", in1.toISOString());
        for (const s of warn1 ?? []) {
          await sendTemplateSMS("expiry_warning", s.phone, {
            shop_name: s.name, owner: s.owner_name, days: 1,
            end_date: new Date(s.subscription_end!).toLocaleDateString("bn-BD"),
          }, { shopId: s.id });
        }

        // 3) T-7 warning (between 6 and 7 days out — dedupe by daily run)
        const in6 = new Date(now); in6.setDate(in6.getDate() + 6);
        const { data: warn7 } = await supabaseAdmin
          .from("shops")
          .select("id, name, owner_name, phone, subscription_end")
          .eq("status", "active")
          .gte("subscription_end", in6.toISOString())
          .lt("subscription_end", in7.toISOString());
        for (const s of warn7 ?? []) {
          await sendTemplateSMS("expiry_warning", s.phone, {
            shop_name: s.name, owner: s.owner_name, days: 7,
            end_date: new Date(s.subscription_end!).toLocaleDateString("bn-BD"),
          }, { shopId: s.id });
        }

        return Response.json({
          expired: expired?.length ?? 0,
          warned_1d: warn1?.length ?? 0,
          warned_7d: warn7?.length ?? 0,
        });
      },
    },
  },
});
