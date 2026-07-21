import type React from "react";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

const fmt = (n: number) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const typeLabel: Record<string, string> = { cash: "নগদ", due: "বাকি", installment: "কিস্তি" };

export type InvoicePreviewProps = {
  sale: any;
  shop?: any;
  tpl?: any;
  publicUrl?: string;
  installments?: any[];
  domId?: string;
  className?: string;
  /** Called when the user taps "Regenerate link" in the QR fallback. */
  onRegenerateLink?: () => void;
  regenerating?: boolean;
};

/**
 * Original full invoice preview used inside:
 *  - POS success dialog
 *  - Sale detail page
 *  - PDF snapshot (via html2canvas on `domId`)
 */
export function InvoicePreview({
  sale,
  shop,
  tpl,
  publicUrl,
  installments,
  domId = "pos-invoice-preview",
  className,
  onRegenerateLink,
  regenerating = false,
}: InvoicePreviewProps) {
  const items = sale?.items ?? [];
  const primary = tpl?.primary_color ?? "#0f766e";
  const accent = tpl?.accent_color ?? "#f0fdfa";
  const textColor = tpl?.text_color ?? "#0f172a";
  const logoSrc = (tpl?.show_logo !== false) ? (tpl?.logo_url || shop?.logo_url) : null;
  const cancelled = sale?.status === "cancelled";
  const returned = sale?.status === "returned" || sale?.status === "partial_return";
  const showQr = tpl?.show_qr !== false;
  const isValidHttpUrl = !!publicUrl && /^https?:\/\/\S+\/i\/[0-9a-f-]{8,}/i.test(publicUrl);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  useEffect(() => {
    let cancelledFlag = false;
    if (!showQr || !isValidHttpUrl || !publicUrl) { setQrDataUrl(null); setQrError(null); return; }
    // High error-correction + 512px raster => crisp on screen, print, PDF.
    QRCode.toDataURL(publicUrl, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 512,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => { if (!cancelledFlag) { setQrDataUrl(url); setQrError(null); } })
      .catch((e) => { if (!cancelledFlag) { setQrError(String(e?.message ?? e)); setQrDataUrl(null); } });
    return () => { cancelledFlag = true; };
  }, [publicUrl, showQr, isValidHttpUrl]);

  return (
    <div
      id={domId}
      className={
        "mx-auto max-w-md overflow-hidden rounded-lg border bg-white text-[13px] leading-tight " +
        (className ?? "")
      }
      style={{ color: textColor }}
    >
      <div className="flex items-center gap-3 px-4 py-3" style={{ background: primary, color: "#ffffff" }}>
        {logoSrc && (
          <img src={logoSrc} alt={shop?.name ?? ""} className="h-10 w-10 rounded bg-white/15 object-contain p-0.5" />
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-widest opacity-80">Invoice</div>
          <div className="truncate text-lg font-black uppercase">{shop?.name ?? tpl?.header_title ?? "SALES INVOICE"}</div>
        </div>
      </div>
      {(tpl?.address_line || tpl?.contact_line || shop?.address || shop?.phone) && (
        <div className="px-4 py-2 text-[11px]" style={{ background: accent }}>
          {(tpl?.address_line || shop?.address) && <div>{tpl?.address_line || shop.address}</div>}
          {(tpl?.contact_line || shop?.phone) && (
            <div className="opacity-80">{tpl?.contact_line || `ফোন: ${shop.phone}`}</div>
          )}
        </div>
      )}
      <div className="p-4">
        <div className="my-2 border-t border-dashed" />
        <div className="text-center font-bold">SALES INVOICE</div>
        {cancelled && (
          <div className="mt-1 rounded border border-rose-300 bg-rose-50 py-1 text-center text-xs font-bold text-rose-700">
            ক্যান্সেল করা হয়েছে
          </div>
        )}
        {returned && !cancelled && (
          <div className="mt-1 rounded border border-amber-300 bg-amber-50 py-1 text-center text-xs font-bold text-amber-800">
            {sale?.status === "partial_return" ? "আংশিক রিটার্ন" : "রিটার্ন"}
          </div>
        )}
        <div className="my-2 border-t border-dashed" />
        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
          <div className="text-muted-foreground">Invoice</div>
          <div className="text-right font-semibold">{sale?.invoice_no ?? String(sale?.id ?? "").slice(0, 8)}</div>
          <div className="text-muted-foreground">Date</div>
          <div className="text-right">{sale?.sale_date ? new Date(sale.sale_date).toLocaleString("en-GB") : "-"}</div>
          <div className="text-muted-foreground">Type</div>
          <div className="text-right">{typeLabel[sale?.sale_type] ?? sale?.sale_type}</div>
          {sale?.payment_method && (
            <>
              <div className="text-muted-foreground">Method</div>
              <div className="text-right uppercase">{sale.payment_method}</div>
            </>
          )}
          <div className="text-muted-foreground">Customer</div>
          <div className="text-right">{sale?.customer?.name ?? "Walk-in"}</div>
          {sale?.customer?.phone && (
            <>
              <div className="text-muted-foreground">Phone</div>
              <div className="text-right">{sale.customer.phone}</div>
            </>
          )}
        </div>
        <div className="my-2 border-t border-dashed" />
        <div className="grid grid-cols-[1fr_auto] gap-x-2 text-xs font-bold uppercase text-muted-foreground">
          <div>Item</div>
          <div className="text-right">Total</div>
        </div>
        <div className="mt-1 space-y-1">
          {items.map((it: any, i: number) => (
            <div key={it.id ?? i} className="grid grid-cols-[1fr_auto] gap-x-2 text-xs">
              <div>
                <div className="font-medium">{i + 1}. {it.product?.name ?? "-"}</div>
                <div className="text-[10px] text-muted-foreground">
                  {it.quantity} {it.product?.unit?.short_name ?? ""} × {fmt(it.unit_price)}
                  {Number(it.discount_amount || 0) > 0 && ` − ছাড় ${fmt(it.discount_amount)}`}
                  {Number(it.tax_rate || 0) > 0 && ` + VAT ${it.tax_rate}%`}
                </div>
              </div>
              <div className="text-right font-semibold">{fmt(it.line_total)}</div>
            </div>
          ))}
        </div>
        <div className="my-2 border-t border-dashed" />
        <div className="space-y-0.5 text-xs">
          <div className="flex justify-between"><span>Subtotal</span><span>{fmt(sale?.subtotal)}</span></div>
          {Number(sale?.discount || 0) > 0 && (
            <div className="flex justify-between"><span>Discount</span><span>-{fmt(sale.discount)}</span></div>
          )}
          {Number(sale?.tax_amount || 0) > 0 && (
            <div className="flex justify-between"><span>VAT</span><span>+{fmt(sale.tax_amount)}</span></div>
          )}
          <div className="mt-1 flex justify-between border-t pt-1 text-base font-black" style={{ color: primary }}>
            <span>TOTAL</span><span>৳ {fmt(sale?.total)}</span>
          </div>
          <div className="flex justify-between"><span>Paid</span><span>{fmt(sale?.paid)}</span></div>
          {Number(sale?.due || 0) > 0 && (
            <div className="flex justify-between font-bold text-rose-600">
              <span>Due</span><span>{fmt(sale.due)}</span>
            </div>
          )}
        </div>
        {sale?.payment_breakdown && (
          <div className="mt-2 rounded-md border border-dashed p-2 text-[11px]">
            <div className="mb-0.5 font-semibold" style={{ color: primary }}>Payment</div>
            <div className="grid grid-cols-2 gap-x-2">
              <div className="text-muted-foreground">Method</div>
              <div className="text-right">{sale.payment_breakdown.method ?? "-"}</div>
              <div className="text-muted-foreground">Paid now</div>
              <div className="text-right">৳ {fmt(sale.payment_breakdown.paid_now)}</div>
              {Number(sale.payment_breakdown.due || 0) > 0 && (
                <>
                  <div className="text-muted-foreground">Remaining</div>
                  <div className="text-right">৳ {fmt(sale.payment_breakdown.due)}</div>
                </>
              )}
              {sale.payment_breakdown.sale_type === "installment" && (
                <>
                  <div className="text-muted-foreground">Installments</div>
                  <div className="text-right">{sale.payment_breakdown.installments} × {sale.payment_breakdown.installment_frequency}</div>
                </>
              )}
              {sale.payment_breakdown.is_partial && (
                <>
                  <div className="text-muted-foreground">Type</div>
                  <div className="text-right">আংশিক পেমেন্ট</div>
                </>
              )}
            </div>
          </div>
        )}
        {installments && installments.length > 0 && (
          <div className="mt-2 rounded-md border border-dashed p-2 text-[11px]">
            <div className="mb-0.5 font-semibold" style={{ color: primary }}>Installments</div>
            {installments.map((ins: any) => (
              <div key={ins.id} className="grid grid-cols-[auto_1fr_auto] gap-x-2">
                <div>#{ins.installment_no}</div>
                <div>{ins.due_date}</div>
                <div className="text-right">{fmt(ins.amount)} <span className="text-[10px] opacity-70">({ins.status})</span></div>
              </div>
            ))}
          </div>
        )}
        {tpl?.terms_note && (
          <div className="mt-2 rounded-md border border-dashed p-2 text-[11px] opacity-80">
            <span className="font-semibold">শর্তাবলী: </span>{tpl.terms_note}
          </div>
        )}
        {tpl?.show_signature && (
          <div className="my-3 grid grid-cols-2 gap-4 text-[11px]">
            <div className="text-center"><div className="mx-auto mb-1 h-8 border-b" /><div>কাস্টমার</div></div>
            <div className="text-center"><div className="mx-auto mb-1 h-8 border-b" /><div>{tpl?.signature_label || "অনুমোদনকারী"}</div></div>
          </div>
        )}
        <div className="mt-2 text-center text-xs">{tpl?.footer_note || "ধন্যবাদ, আবার আসবেন।"}</div>
        {publicUrl && (
          <div className="mt-3 flex flex-col items-center gap-1 border-t pt-3">
            <img
              alt="qr"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(publicUrl)}`}
              className="h-24 w-24"
              crossOrigin="anonymous"
            />
            <div className="text-[10px] opacity-70">স্ক্যান করে ইনভয়েস দেখুন</div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Global print / PDF styles targeting the invoice preview.
 * Include once per page that renders <InvoicePreview />.
 */
export function InvoicePrintStyles() {
  return (
    <style>{`
      @media print {
        body { background: white !important; }
        .invoice-hide-on-print { display: none !important; }
        #pos-invoice-preview { box-shadow: none !important; border: 0 !important; max-width: 100% !important; }
      }
      body.printing-invoice > *:not(.invoice-print-root) { display: none !important; }
      body.printing-invoice .invoice-print-root { display: block !important; }
    `}</style>
  );
}