// Sends escalating reminder SMS for unpaid initial/upgrade invoices.
// Schedule (days since creation): 3, 7, 14 — max 3 reminders per invoice.
// Guard with CRON_SECRET header. Call daily.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/cron/invoice-reminders")({
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
        const { logAudit } = await import("@/lib/audit.server");

        const now = new Date();
        const nowMs = now.getTime();

        const { data: invoices } = await supabaseAdmin
          .from("subscription_payments")
          .select("id, invoice_no, invoice_type, amount, due_date, created_at, last_reminder_at, reminder_count, shop:shops(id, name, owner_name, phone)")
          .eq("status", "pending")
          .in("invoice_type", ["initial", "upgrade"])
          .lt("reminder_count", 3);

        let sent = 0;
        for (const inv of invoices ?? []) {
          const created = new Date(inv.created_at as any).getTime();
          const ageDays = Math.floor((nowMs - created) / 86400_000);
          const count = Number(inv.reminder_count ?? 0);
          // Reminder schedule
          const shouldSend =
            (count === 0 && ageDays >= 3) ||
            (count === 1 && ageDays >= 7) ||
            (count === 2 && ageDays >= 14);
          if (!shouldSend) continue;

          const shop: any = inv.shop;
          if (!shop?.phone) continue;

          try {
            await sendTemplateSMS(
              "invoice_reminder",
              shop.phone,
              {
                shop_name: shop.name,
                owner: shop.owner_name,
                invoice_no: (inv as any).invoice_no ?? "",
                amount: String(inv.amount ?? 0),
                days: String(ageDays),
              },
              { shopId: shop.id },
            );
          } catch (e) {
            // Template may not exist yet — fall back to a raw message once.
            try {
              const { sendRawSMS } = await import("@/lib/sms.server");
              await sendRawSMS(
                shop.phone,
                `${shop.name}: বকেয়া ইনভয়েস ${(inv as any).invoice_no ?? ""} — ৳${inv.amount}. অনুগ্রহ করে দ্রুত পরিশোধ করুন।`,
              );
            } catch (e2) { console.error("reminder SMS failed", e2); }
          }

          await supabaseAdmin
            .from("subscription_payments")
            .update({ last_reminder_at: now.toISOString(), reminder_count: count + 1 })
            .eq("id", inv.id);

          await logAudit({
            actor_role: "cron",
            shop_id: shop.id,
            action: "invoice.reminder_sent",
            target_type: "subscription_payment",
            target_id: inv.id,
            details: { invoice_no: (inv as any).invoice_no, reminder_no: count + 1, age_days: ageDays },
          });
          sent++;
        }

        return Response.json({ processed: invoices?.length ?? 0, sent });
      },
    },
  },
});