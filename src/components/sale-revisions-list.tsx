import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listSaleRevisions, getSaleRevision } from "@/lib/sale-revisions.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useState } from "react";
import { History, Eye, Download } from "lucide-react";
import { toast } from "sonner";

type Rev = { id: string; version: number; reason?: string | null; created_at: string };

export function SaleRevisionsList({ saleId }: { saleId: string }) {
  const listFn = useServerFn(listSaleRevisions);
  const getFn = useServerFn(getSaleRevision);
  const q = useQuery<Rev[]>({
    queryKey: ["sale-revisions", saleId],
    queryFn: () => listFn({ data: { sale_id: saleId } }) as any,
  });
  const [openId, setOpenId] = useState<string | null>(null);
  const [snap, setSnap] = useState<any>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const openRev = async (id: string) => {
    setOpenId(id); setSnap(null);
    try {
      const row = await getFn({ data: { id } });
      setSnap(row);
    } catch (e: any) {
      toast.error(e?.message ?? "সংস্করণ লোড করা যায়নি");
      setOpenId(null);
    }
  };

  const downloadPdf = async () => {
    const el = document.getElementById("revision-preview");
    if (!el) return;
    setPdfBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"), import("jspdf"),
      ]);
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const availW = pageW - margin * 2;
      const ratio = canvas.height / canvas.width;
      let w = availW; let h = availW * ratio;
      if (h > pageH - margin * 2) { h = pageH - margin * 2; w = h / ratio; }
      pdf.addImage(img, "PNG", (pageW - w) / 2, margin, w, h);
      const inv = snap?.snapshot?.sale?.invoice_no ?? snap?.sale_id?.slice(0, 8);
      pdf.save(`invoice-${inv}-v${snap?.version}.pdf`);
    } catch (e: any) {
      toast.error(e?.message ?? "PDF তৈরি করা যায়নি");
    } finally {
      setPdfBusy(false);
    }
  };

  const rows = q.data ?? [];
  if (q.isLoading) return <div className="text-xs text-muted-foreground">লোড হচ্ছে...</div>;
  if (rows.length === 0) {
    return <div className="rounded-md border bg-muted/30 p-3 text-center text-xs text-muted-foreground">কোন সম্পাদনার হিস্ট্রি নেই</div>;
  }

  return (
    <>
      <div className="divide-y rounded-md border bg-card">
        {rows.map((r) => (
          <div key={r.id} className="flex items-center gap-3 p-2.5 text-xs">
            <History className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="font-semibold">সংস্করণ v{r.version}</div>
              {r.reason && <div className="truncate text-[11px] text-muted-foreground">{r.reason}</div>}
            </div>
            <div className="text-[10px] text-muted-foreground whitespace-nowrap">
              {new Date(r.created_at).toLocaleString("bn-BD")}
            </div>
            <Button size="sm" variant="outline" onClick={() => openRev(r.id)}>
              <Eye className="mr-1 h-3 w-3" /> দেখুন
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!openId} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>সংস্করণ v{snap?.version ?? ""} — প্রিভিউ</DialogTitle>
          </DialogHeader>
          {!snap ? (
            <div className="py-6 text-center text-xs text-muted-foreground">লোড হচ্ছে...</div>
          ) : (
            <>
              <RevisionPreview snap={snap.snapshot} />
              <div className="flex justify-end">
                <Button size="sm" onClick={downloadPdf} disabled={pdfBusy}>
                  <Download className="mr-1 h-4 w-4" /> {pdfBusy ? "..." : "PDF ডাউনলোড"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function RevisionPreview({ snap }: { snap: any }) {
  const sale = snap?.sale ?? {};
  const items: any[] = snap?.items ?? [];
  const fmt = (n: number) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return (
    <div id="revision-preview" className="rounded-lg border bg-white p-3 text-[12px] leading-tight text-black">
      <div className="text-center text-base font-black uppercase tracking-wide">INVOICE (Archived)</div>
      <div className="my-1.5 border-t border-dashed" />
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
        <div className="text-muted-foreground">Invoice</div>
        <div className="text-right font-semibold">{sale.invoice_no ?? String(sale.id ?? "").slice(0, 8)}</div>
        <div className="text-muted-foreground">Date</div>
        <div className="text-right">{sale.sale_date ? new Date(sale.sale_date).toLocaleString("en-GB") : "-"}</div>
        <div className="text-muted-foreground">Customer</div>
        <div className="text-right">{sale.customer?.name ?? "Walk-in"}</div>
      </div>
      <div className="my-1.5 border-t border-dashed" />
      {items.map((it: any, i: number) => (
        <div key={i} className="grid grid-cols-[1fr_auto] gap-x-2 text-[11px]">
          <div>
            <div className="font-medium">{i + 1}. {it.product?.name ?? "-"}</div>
            <div className="text-[10px] text-muted-foreground">
              {it.quantity} {it.product?.unit?.short_name ?? ""} × {fmt(it.unit_price)}
            </div>
          </div>
          <div className="text-right font-semibold">{fmt(it.line_total)}</div>
        </div>
      ))}
      <div className="my-1.5 border-t border-dashed" />
      <div className="flex justify-between text-[11px]"><span>Subtotal</span><span>{fmt(sale.subtotal)}</span></div>
      {Number(sale.discount || 0) > 0 && (
        <div className="flex justify-between text-[11px]"><span>Discount</span><span>-{fmt(sale.discount)}</span></div>
      )}
      {Number(sale.tax_amount || 0) > 0 && (
        <div className="flex justify-between text-[11px]"><span>VAT</span><span>+{fmt(sale.tax_amount)}</span></div>
      )}
      <div className="mt-0.5 flex justify-between border-t pt-0.5 text-sm font-black">
        <span>TOTAL</span><span>৳ {fmt(sale.total)}</span>
      </div>
    </div>
  );
}