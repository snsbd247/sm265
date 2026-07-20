import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSubscriptionInvoice } from "@/lib/admin.functions";
import { useEffect } from "react";
import { ReceiptShell } from "@/components/receipt-preview";
import {
  useReceiptConfig,
  receiptStyleCss,
  separatorChar,
} from "@/lib/receipt-config";

export const Route = createFileRoute("/admin/invoices/en/$subscriptionId")({ component: InvoicePage });

function InvoicePage() {
  const { subscriptionId } = useParams({ from: "/admin/invoices/en/$subscriptionId" });
  const fn = useServerFn(getSubscriptionInvoice);
  const { data, isLoading } = useQuery({
    queryKey: ["subscription-invoice-en", subscriptionId],
    queryFn: () => fn({ data: { subscription_id: subscriptionId } }),
  });
  const { cfg, ready } = useReceiptConfig();

  useEffect(() => {
    if (data && ready && cfg.autoPrint) {
      const t = setTimeout(() => { try { window.print(); } catch { /* ignore */ } }, 500);
      return () => clearTimeout(t);
    }
  }, [data, ready, cfg.autoPrint]);

  if (isLoading || !data) return <div className="p-6 text-sm text-muted-foreground">Loading...</div>;
  const s: any = (data as any).subscription;
  const p: any = (data as any).payment;
  const brand: any = (data as any).brand ?? {};

  const line = separatorChar(cfg.separator);
  const row = (k: string, v: string) => (
    <div className="flex justify-between gap-2">
      <span>{k}</span><span className="r-wrap text-right">{v}</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/40 py-6 print:bg-white print:py-0">
      <ReceiptShell autoOpen={!cfg.autoPrint}>
        <div id="pos-receipt" className="mx-auto bg-white p-3 leading-tight text-black shadow-sm print:shadow-none">
          <div className="text-center">
            <div className="r-title font-bold uppercase r-wrap">{brand.site_name ?? "Supershop"}</div>
            {brand.tagline && <div className="r-wrap text-[11px]">{brand.tagline}</div>}
            {brand.contact_phone && <div>Phone: {brand.contact_phone}</div>}
            {brand.contact_email && <div className="r-wrap">{brand.contact_email}</div>}
            {brand.contact_address && <div className="r-wrap text-[11px]">{brand.contact_address}</div>}
          </div>
          <div className="my-1 text-center">{line}</div>
          <div className="text-center font-bold">SUBSCRIPTION INVOICE</div>
          <div className="my-1 text-center">{line}</div>

          {row("Invoice #", s.id.slice(0, 8).toUpperCase())}
          {row("Issue Date", new Date(s.created_at ?? s.starts_at).toLocaleDateString("en-GB"))}
          {row("Status", (s.status ?? "").toUpperCase())}

          <div className="my-1 text-center">{line}</div>
          <div className="font-bold">Bill To</div>
          {row("Shop", s.shop?.name ?? "-")}
          {row("Owner", s.shop?.owner_name ?? "-")}
          {row("Phone", s.shop?.phone ?? "-")}
          {s.shop?.email && row("Email", s.shop.email)}

          <div className="my-1 text-center">{line}</div>
          <div className="font-bold">Plan</div>
          {row("Package", s.package?.name ?? "-")}
          {row("Billing", s.billing_cycle === "yearly" ? "Yearly" : "Monthly")}
          {row("Starts", new Date(s.starts_at).toLocaleDateString("en-GB"))}
          {row("Ends", new Date(s.ends_at).toLocaleDateString("en-GB"))}

          {p && (
            <>
              <div className="my-1 text-center">{line}</div>
              <div className="font-bold">Payment</div>
              {row("Method", p.payment_method ?? "-")}
              {row("Txn ID", p.transaction_id ?? "-")}
              {row("Paid At", p.paid_at ? new Date(p.paid_at).toLocaleString("en-GB") : "-")}
            </>
          )}

          <div className="my-1 text-center">{line}</div>
          <div className="r-total flex justify-between font-bold">
            <span>AMOUNT</span>
            <span>BDT {Number(s.amount).toLocaleString("en-US")}</span>
          </div>
          <div className="my-1 text-center">{line}</div>

          <div className="r-wrap mt-2 text-center text-[11px]">
            {brand.footer_note ?? "Thank you for choosing us."}
          </div>
          <div className="mt-1 text-center text-[10px]">
            Printed: {new Date().toLocaleString("en-GB")}
          </div>
        </div>
      </ReceiptShell>

      <style>{receiptStyleCss(cfg)}</style>
    </div>
  );
}
