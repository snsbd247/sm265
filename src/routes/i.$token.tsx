import { createFileRoute, notFound, useLoaderData } from "@tanstack/react-router";
import { getPublicInvoice } from "@/lib/public-invoice.functions";
import { Button } from "@/components/ui/button";
import { Printer, Share2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/i/$token")({
  head: ({ loaderData }) => {
    const inv = (loaderData as any)?.sale?.invoice_no ?? "Invoice";
    const shopName = (loaderData as any)?.shop?.name ?? "Shop";
    const total = Number((loaderData as any)?.sale?.total ?? 0).toFixed(2);
    return {
      meta: [
        { title: `Invoice #${inv} — ${shopName}` },
        { name: "description", content: `${shopName} থেকে ইনভয়েস #${inv}, মোট ৳${total}` },
        { name: "robots", content: "noindex, nofollow" },
      ],
    };
  },
  loader: async ({ params }) => {
    try {
      return await getPublicInvoice({ data: { token: params.token } });
    } catch {
      throw notFound();
    }
  },
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="rounded-lg border bg-background p-8 text-center shadow-sm">
        <div className="text-lg font-semibold">ইনভয়েস পাওয়া যায়নি</div>
        <p className="mt-2 text-sm text-muted-foreground">লিংকটি ভুল বা মেয়াদোত্তীর্ণ হতে পারে।</p>
      </div>
    </div>
  ),
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <div className="rounded-lg border bg-background p-8 text-center shadow-sm">
        <div className="text-lg font-semibold">ইনভয়েস পাওয়া যায়নি</div>
        <p className="mt-2 text-sm text-muted-foreground">লিংকটি ভুল বা মেয়াদোত্তীর্ণ হতে পারে।</p>
      </div>
    </div>
  ),
  component: PublicInvoicePage,
});

const fmt = (n: number) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
const typeLabel: Record<string, string> = { cash: "নগদ", due: "বাকি", installment: "কিস্তি" };

function PublicInvoicePage() {
  const { sale, shop } = useLoaderData({ from: "/i/$token" }) as any;
  const items = sale.items ?? [];

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = `Invoice #${sale.invoice_no ?? sale.id.slice(0, 8)}`;
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast.success("লিংক কপি হয়েছে");
      }
    } catch { /* user cancelled */ }
  };

  const cancelled = sale.status === "cancelled";

  return (
    <div className="min-h-screen bg-muted/30 py-4 print:bg-white print:py-0">
      <div className="mx-auto flex max-w-md items-center justify-end gap-2 px-3 pb-2 print:hidden">
        <Button size="sm" variant="outline" onClick={share}>
          <Share2 className="mr-1 h-4 w-4" /> শেয়ার
        </Button>
        <Button size="sm" onClick={() => window.print()}>
          <Printer className="mr-1 h-4 w-4" /> প্রিন্ট
        </Button>
      </div>

      <div
        id="pos-receipt"
        className="mx-auto max-w-md rounded-lg border bg-white p-4 text-[13px] leading-tight text-black shadow-sm print:border-0 print:shadow-none"
      >
        <div className="text-center">
          {shop?.logo_url && (
            <img src={shop.logo_url} alt={shop?.name ?? ""} className="mx-auto mb-1 h-12 object-contain" />
          )}
          <div className="text-lg font-black uppercase tracking-wide">{shop?.name ?? "Shop"}</div>
          {shop?.address && <div className="text-[11px]">{shop.address}</div>}
          {shop?.phone && <div className="text-[11px]">ফোন: {shop.phone}</div>}
        </div>

        <div className="my-2 border-t border-dashed" />
        <div className="text-center font-bold">SALES INVOICE</div>
        {cancelled && (
          <div className="mt-1 rounded border border-rose-300 bg-rose-50 py-1 text-center text-xs font-bold text-rose-700">
            ক্যান্সেল করা হয়েছে
          </div>
        )}
        <div className="my-2 border-t border-dashed" />

        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
          <div className="text-muted-foreground">Invoice</div>
          <div className="text-right font-semibold">{sale.invoice_no ?? sale.id.slice(0, 8)}</div>
          <div className="text-muted-foreground">Date</div>
          <div className="text-right">{new Date(sale.sale_date).toLocaleString("en-GB")}</div>
          <div className="text-muted-foreground">Type</div>
          <div className="text-right">{typeLabel[sale.sale_type] ?? sale.sale_type}</div>
          {sale.payment_method && (
            <>
              <div className="text-muted-foreground">Method</div>
              <div className="text-right uppercase">{sale.payment_method}</div>
            </>
          )}
          <div className="text-muted-foreground">Customer</div>
          <div className="text-right">{sale.customer?.name ?? "Walk-in"}</div>
          {sale.customer?.phone && (
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
            <div key={it.id} className="grid grid-cols-[1fr_auto] gap-x-2 text-xs">
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
          <div className="flex justify-between"><span>Subtotal</span><span>{fmt(sale.subtotal)}</span></div>
          {Number(sale.discount || 0) > 0 && (
            <div className="flex justify-between"><span>Discount</span><span>-{fmt(sale.discount)}</span></div>
          )}
          {Number(sale.tax_amount || 0) > 0 && (
            <div className="flex justify-between"><span>VAT</span><span>+{fmt(sale.tax_amount)}</span></div>
          )}
          <div className="mt-1 flex justify-between border-t pt-1 text-base font-black">
            <span>TOTAL</span><span>৳ {fmt(sale.total)}</span>
          </div>
          <div className="flex justify-between"><span>Paid</span><span>{fmt(sale.paid)}</span></div>
          {Number(sale.due || 0) > 0 && (
            <div className="flex justify-between font-bold text-rose-600">
              <span>Due</span><span>{fmt(sale.due)}</span>
            </div>
          )}
        </div>

        <div className="my-2 border-t border-dashed" />
        <div className="text-center text-xs">ধন্যবাদ, আবার আসবেন।</div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; }
          #pos-receipt { box-shadow: none !important; border: 0 !important; }
        }
      `}</style>
    </div>
  );
}