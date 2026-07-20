import { createFileRoute, useParams, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getSale } from "@/lib/sales.functions";
import { getMyShop } from "@/lib/shop.functions";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { ReceiptShell } from "@/components/receipt-preview";
import {
  useReceiptConfig,
  receiptStyleCss,
  separatorChar,
} from "@/lib/receipt-config";

export const Route = createFileRoute("/app/sales/$saleId")({ component: InvoicePage });

const fmt = (n: number) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const typeLabel: Record<string, string> = { cash: "নগদ", due: "বাকি", installment: "কিস্তি" };

function InvoicePage() {
  const { saleId } = useParams({ from: "/app/sales/$saleId" });
  const nav = useNavigate();
  const saleFn = useServerFn(getSale);
  const shopFn = useServerFn(getMyShop);

  const q = useQuery({ queryKey: ["sale", saleId], queryFn: () => saleFn({ data: { id: saleId } }) });
  const shopQ = useQuery({ queryKey: ["my-shop"], queryFn: () => shopFn() });
  const { cfg, ready } = useReceiptConfig();

  const sale: any = q.data?.sale;
  const items: any[] = q.data?.items ?? [];
  const installments: any[] = q.data?.installments ?? [];
  const shop: any = shopQ.data?.shop;

  useEffect(() => {
    if (sale && ready && cfg.autoPrint) {
      const t = setTimeout(() => {
        try { window.print(); } catch { /* ignore */ }
      }, 500);
      return () => clearTimeout(t);
    }
  }, [sale, ready, cfg.autoPrint]);

  if (q.isLoading) return <div className="p-4 text-muted-foreground sm:p-6">লোড হচ্ছে...</div>;
  if (!sale) return <div className="p-4 sm:p-6">ইনভয়েস পাওয়া যায়নি</div>;

  const line = separatorChar(cfg.separator);

  return (
    <div className="min-h-screen bg-muted/40 py-4 print:bg-white print:py-0">
      <div className="mx-auto mb-2 flex max-w-[302px] items-center justify-start print:hidden">
        <Button variant="ghost" size="sm" onClick={() => nav({ to: "/app/sales" })}>
          <ArrowLeft className="mr-1 h-4 w-4" /> ফিরে
        </Button>
      </div>

      <ReceiptShell autoOpen={!cfg.autoPrint}>
        <div
          id="pos-receipt"
          className="mx-auto bg-white p-3 leading-tight text-black shadow-sm print:shadow-none"
        >
          <div className="text-center">
            <div className="r-title r-wrap font-bold uppercase">{shop?.name ?? "Shop"}</div>
            {shop?.address && <div className="r-wrap text-[11px]">{shop.address}</div>}
            {shop?.phone && <div>ফোন: {shop.phone}</div>}
          </div>
          <div className="my-1 text-center">{line}</div>
          <div className="text-center font-bold">SALES INVOICE</div>
          <div className="my-1 text-center">{line}</div>

          <div className="flex justify-between gap-2"><span>Inv#</span><span className="r-wrap text-right">{sale.invoice_no ?? sale.id.slice(0, 8)}</span></div>
          <div className="flex justify-between gap-2"><span>Date</span><span className="r-wrap text-right">{new Date(sale.sale_date).toLocaleString("en-GB")}</span></div>
          <div className="flex justify-between gap-2"><span>Type</span><span>{typeLabel[sale.sale_type] ?? sale.sale_type}</span></div>
          {sale.payment_method && <div className="flex justify-between gap-2"><span>Method</span><span>{sale.payment_method}</span></div>}
          <div className="flex justify-between gap-2"><span>Customer</span><span className="r-wrap text-right">{sale.customer?.name ?? "Walk-in"}</span></div>
          {sale.customer?.phone && <div className="flex justify-between gap-2"><span>Phone</span><span>{sale.customer.phone}</span></div>}

          <div className="my-1 text-center">{line}</div>

          <div className="grid grid-cols-[1fr_auto] gap-x-2 font-bold">
            <div>Item</div><div className="text-right">Total</div>
          </div>
          <div className="text-center">{line}</div>

          {items.map((it: any, i: number) => (
            <div key={it.id} className="grid grid-cols-[1fr_auto] gap-x-2">
              <div className="r-wrap">{i + 1}. {it.product?.name ?? "-"}</div>
              <div className="text-right">{fmt(it.line_total)}</div>
              <div className="r-wrap col-span-2 text-[11px] text-neutral-700">
                {it.quantity} {it.product?.unit?.short_name ?? ""} × {fmt(it.unit_price)}
                {Number(it.discount || 0) > 0 && ` − ${fmt(it.discount)}`}
              </div>
            </div>
          ))}

          <div className="my-1 text-center">{line}</div>

          <div className="flex justify-between"><span>Subtotal</span><span>{fmt(sale.subtotal)}</span></div>
          {Number(sale.discount || 0) > 0 && (
            <div className="flex justify-between"><span>Discount</span><span>-{fmt(sale.discount)}</span></div>
          )}
          <div className="r-total flex justify-between font-bold">
            <span>TOTAL</span><span>BDT {fmt(sale.total)}</span>
          </div>
          <div className="flex justify-between"><span>Paid</span><span>{fmt(sale.paid)}</span></div>
          {Number(sale.due || 0) > 0 && (
            <div className="flex justify-between font-bold"><span>Due</span><span>{fmt(sale.due)}</span></div>
          )}

          {installments.length > 0 && (
            <>
              <div className="my-1 text-center">{line}</div>
              <div className="font-bold">Installments</div>
              {installments.map((ins: any) => (
                <div key={ins.id} className="grid grid-cols-[auto_1fr_auto] gap-x-2">
                  <div>#{ins.installment_no}</div>
                  <div className="r-wrap">{ins.due_date}</div>
                  <div className="text-right">{fmt(ins.amount)} <span className="text-[10px]">({ins.status})</span></div>
                </div>
              ))}
            </>
          )}

          <div className="my-1 text-center">{line}</div>
          <div className="r-wrap text-center text-[11px]">ধন্যবাদ, আবার আসবেন।</div>
          <div className="text-center text-[10px]">Printed: {new Date().toLocaleString("en-GB")}</div>
        </div>
      </ReceiptShell>

      <style>{receiptStyleCss(cfg)}</style>
    </div>
  );
}
