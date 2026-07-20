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

          const exec = await executeBkashPayment(paymentID);
          if (exec?.transactionStatus !== "Completed" || exec?.statusCode !== "0000") {
            await supabaseAdmin
              .from("subscription_payments")
              .update({ status: "failed", raw_response: { execute: exec } })
              .eq("id", pid);
            return redir("failed");
          }

          await supabaseAdmin
            .from("subscription_payments")
            .update({
              transaction_id: exec.trxID ?? paymentID,
              raw_response: { execute: exec },
            })
            .eq("id", pid);

          await activatePaymentAndExtendShop(pid);
          return redir("success");
        } catch (e) {
          console.error("bKash callback error", e);
          return redir("error");
        }
      },
    },
  },
});
