import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bkash/callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const paymentID = url.searchParams.get("paymentID");
        const status = url.searchParams.get("status"); // success | failure | cancel
        const pid = url.searchParams.get("pid");
        const origin = `${url.protocol}//${url.host}`;
        const redir = (r: string) => Response.redirect(`${origin}/renew?bkash=${r}`, 302);

        if (!paymentID || !pid) return redir("failed");
        if (status !== "success") return redir(status ?? "failed");

        try {
          const { executeBkashPayment } = await import("@/lib/bkash.server");
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { activatePaymentAndExtendShop } = await import("@/lib/subscription.server");
          const { logAudit } = await import("@/lib/audit.server");

          const exec = await executeBkashPayment(paymentID);
          if (exec?.transactionStatus !== "Completed" || exec?.statusCode !== "0000") {
            await supabaseAdmin
              .from("subscription_payments")
              .update({ status: "failed", raw_response: { execute: exec } })
              .eq("id", pid);
            await logAudit({
              actor_role: "bkash_callback", action: "invoice.rejected",
              target_type: "subscription_payment", target_id: pid,
              details: { execute: exec },
            });
            return redir("failed");
          }

          await supabaseAdmin
            .from("subscription_payments")
            .update({
              transaction_id: exec.trxID ?? paymentID,
              raw_response: { execute: exec },
            })
            .eq("id", pid);

          const r = await activatePaymentAndExtendShop(pid, { source: "bkash_callback" });
          await logAudit({
            actor_role: "bkash_callback", action: "invoice.paid",
            target_type: "subscription_payment", target_id: pid,
            details: { trxID: exec.trxID, alreadyProcessed: r.alreadyProcessed ?? false },
          });
          return redir("success");
        } catch (e) {
          console.error("bKash callback error", e);
          return redir("error");
        }
      },
    },
  },
});
