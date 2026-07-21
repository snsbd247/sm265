// bKash IPN-style webhook. Verifies via bKash Query API before flipping status.
// Idempotent: re-delivery is safe because activatePaymentAndExtendShop claims atomically.
// Optional shared secret header (BKASH_WEBHOOK_SECRET) if bKash is configured to send one.
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/bkash/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Optional shared secret
        const expected = process.env.BKASH_WEBHOOK_SECRET;
        if (expected) {
          const provided = request.headers.get("x-webhook-secret") ?? "";
          if (provided !== expected) {
            return new Response("Unauthorized", { status: 401 });
          }
        }

        let payload: any = null;
        try {
          payload = await request.json();
        } catch {
          return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
        }

        const paymentID: string | undefined =
          payload?.paymentID ?? payload?.payment_id ?? payload?.data?.paymentID;
        const pid: string | undefined = payload?.pid ?? payload?.invoice_id;

        if (!paymentID && !pid) {
          return Response.json({ ok: false, error: "missing paymentID/pid" }, { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { queryBkashPayment } = await import("@/lib/bkash.server");
        const { activatePaymentAndExtendShop } = await import("@/lib/subscription.server");
        const { logAudit } = await import("@/lib/audit.server");

        // Locate the payment row
        let payRow: any = null;
        if (pid) {
          const { data } = await supabaseAdmin.from("subscription_payments").select("id, status, shop_id").eq("id", pid).maybeSingle();
          payRow = data;
        }
        if (!payRow && paymentID) {
          const { data } = await supabaseAdmin.from("subscription_payments").select("id, status, shop_id").eq("bkash_payment_id", paymentID).maybeSingle();
          payRow = data;
        }
        if (!payRow) {
          return Response.json({ ok: false, error: "payment not found" }, { status: 404 });
        }
        if (payRow.status === "success") {
          return Response.json({ ok: true, alreadyProcessed: true });
        }

        // Verify with bKash Query API — never trust the webhook body alone
        try {
          const q = await queryBkashPayment(paymentID!);
          const completed = q?.transactionStatus === "Completed" && q?.statusCode === "0000";
          if (!completed) {
            await supabaseAdmin.from("subscription_payments").update({
              status: "failed",
              raw_response: { webhook: payload, query: q },
            }).eq("id", payRow.id);
            await logAudit({
              actor_role: "webhook", shop_id: payRow.shop_id,
              action: "invoice.rejected", target_type: "subscription_payment", target_id: payRow.id,
              details: { source: "bkash_webhook", query: q },
            });
            return Response.json({ ok: false, verified: false, status: q?.transactionStatus });
          }
          await supabaseAdmin.from("subscription_payments").update({
            transaction_id: q.trxID ?? paymentID,
            raw_response: { webhook: payload, query: q },
          }).eq("id", payRow.id);

          const r = await activatePaymentAndExtendShop(payRow.id, { source: "bkash_webhook" });
          await logAudit({
            actor_role: "webhook", shop_id: payRow.shop_id,
            action: "invoice.webhook_processed",
            target_type: "subscription_payment", target_id: payRow.id,
            details: { trxID: q.trxID, alreadyProcessed: r.alreadyProcessed ?? false },
          });
          return Response.json({ ok: true, ...r });
        } catch (e: any) {
          console.error("bkash webhook error", e);
          return Response.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
        }
      },
    },
  },
});