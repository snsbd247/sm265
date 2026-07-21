import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCustomers, createSale, getSale, cancelSale } from "@/lib/sales.functions";
import { sendInvoiceLinkSms } from "@/lib/public-invoice.functions";
import { listProducts, listCategories } from "@/lib/inventory.functions";
import { getCurrentShift } from "@/lib/shifts.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/searchable-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, Trash2, Search, ScanLine, User, Percent, X, ShoppingCart, ImageIcon, Printer, MessageSquare, Copy, CheckCircle2, Share2, Download, Pencil, CheckCheck } from "lucide-react";
import { UpgradePackageDialog } from "@/components/upgrade-package-dialog";

export const Route = createFileRoute("/app/sales/new")({ component: Page });

type Line = {
  product_id: string; quantity: number; unit_price: number; unit_cost: number;
  discount_amount: number;
  stock: number; name: string; unit?: string; image_url?: string | null; sku?: string | null;
};
type SaleType = "cash" | "due" | "installment";

function Page() {
  const nav = useNavigate();
  const custFn = useServerFn(listCustomers);
  const prodFn = useServerFn(listProducts);
  const catFn = useServerFn(listCategories);
  const createFn = useServerFn(createSale);
  const getSaleFn = useServerFn(getSale);
  const sendSmsFn = useServerFn(sendInvoiceLinkSms);
  const cancelFn = useServerFn(cancelSale);

  const cust = useQuery({ queryKey: ["customers"], queryFn: () => custFn() });
  const prod = useQuery({ queryKey: ["products"], queryFn: () => prodFn() });
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => catFn() });
  const shiftFn = useServerFn(getCurrentShift);
  const shiftQ = useQuery({ queryKey: ["shift-current"], queryFn: () => shiftFn() });

  const [customerId, setCustomerId] = useState<string>("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [paid, setPaid] = useState(0);
  const [method, setMethod] = useState<"cash" | "card" | "bkash" | "bank" | "due">("cash");
  const [saleType, setSaleType] = useState<SaleType>("cash");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [printAfter, setPrintAfter] = useState(true);

  const [installments, setInstallments] = useState(3);
  const [instFreq, setInstFreq] = useState<"weekly" | "monthly">("monthly");
  const [instStart, setInstStart] = useState(new Date().toISOString().slice(0, 10));

  const [search, setSearch] = useState("");
  const [barcode, setBarcode] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);

  // Post-sale success dialog
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const subtotal = useMemo(
    () => lines.reduce((s, l) => s + (l.quantity || 0) * (l.unit_price || 0), 0),
    [lines],
  );
  const itemDiscountTotal = useMemo(
    () => lines.reduce((s, l) => s + (l.discount_amount || 0), 0),
    [lines],
  );
  const taxable = Math.max(0, subtotal - itemDiscountTotal - discount);
  const taxAmount = Math.round((taxable * (taxRate || 0) / 100) * 100) / 100;
  const total = Math.max(0, taxable + taxAmount);
  const effectivePaid = saleType === "cash" ? total : paid;
  const due = Math.max(0, total - effectivePaid);
  const totalUnits = lines.reduce((s, l) => s + (l.quantity || 0), 0);

  const addProduct = (pid: string) => {
    if (!pid) return;
    const p = prod.data?.find((x: any) => x.id === pid);
    if (!p) return;
    const existing = lines.findIndex((l) => l.product_id === pid);
    if (existing >= 0) {
      const next = [...lines];
      next[existing] = { ...next[existing], quantity: next[existing].quantity + 1 };
      setLines(next);
    } else {
      setLines([
        ...lines,
        {
          product_id: p.id,
          quantity: 1,
          unit_price: Number(p.sale_price ?? 0),
          unit_cost: Number(p.purchase_price ?? 0),
          discount_amount: 0,
          stock: Number(p.stock_quantity ?? 0),
          name: p.name,
          unit: p.unit?.short_name,
          image_url: p.image_url ?? null,
          sku: p.sku ?? null,
        },
      ]);
    }
  };

  const updateLine = (i: number, patch: Partial<Line>) => {
    const next = [...lines];
    next[i] = { ...next[i], ...patch };
    setLines(next);
  };
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));
  const clearCart = () => {
    setLines([]); setDiscount(0); setTaxRate(0); setPaid(0); setNote(""); setCustomerId("");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField = !!target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
      if (e.key === "/" && !inField) {
        e.preventDefault(); searchRef.current?.focus();
      } else if (e.key === "F8") {
        e.preventDefault(); barcodeRef.current?.focus();
      } else if (e.key === "F9" && !inField) {
        e.preventDefault(); if (lines.length) setCheckoutOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lines.length]);

  // Auto-focus barcode on mount so a USB/Bluetooth scanner works instantly
  useEffect(() => { barcodeRef.current?.focus(); }, []);

  const onBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = barcode.trim();
    if (!code) return;
    const p = (prod.data ?? []).find(
      (x: any) =>
        (x.barcode && x.barcode === code) ||
        (x.sku && x.sku.toLowerCase() === code.toLowerCase()),
    );
    if (p) { addProduct(p.id); setBarcode(""); barcodeRef.current?.focus(); }
    else toast.error(`পণ্য পাওয়া যায়নি: ${code}`);
  };

  const catCounts = useMemo(() => {
    const map: Record<string, number> = { all: 0, uncat: 0 };
    for (const p of prod.data ?? []) {
      map.all++;
      const cid = (p as any).category_id ?? "uncat";
      map[cid] = (map[cid] ?? 0) + 1;
    }
    return map;
  }, [prod.data]);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (prod.data ?? []).filter((p: any) => {
      if (activeCat !== "all") {
        if (activeCat === "uncat") { if (p.category_id) return false; }
        else if (p.category_id !== activeCat) return false;
      }
      if (!q) return true;
      return (
        (p.name ?? "").toLowerCase().includes(q) ||
        (p.sku ?? "").toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
      );
    });
  }, [prod.data, search, activeCat]);

  const m = useMutation({
    mutationFn: () =>
      createFn({
        data: {
          customer_id: customerId || null,
          invoice_no: invoiceNo || null,
          sale_date: saleDate,
          discount,
          paid: effectivePaid,
          payment_method: saleType === "cash" ? method : saleType === "due" ? "due" : method,
          sale_type: saleType,
          note: note || null,
          items: lines.map((l) => ({
            product_id: l.product_id,
            quantity: l.quantity,
            unit_price: l.unit_price,
            unit_cost: l.unit_cost,
            discount_amount: l.discount_amount || 0,
            tax_rate: taxRate || 0,
          })),
          installments: saleType === "installment" ? installments : null,
          installment_frequency: instFreq,
          installment_start: instStart,
        },
      }),
    onSuccess: (saleId: any) => {
      toast.success("বিক্রয় সংরক্ষিত");
      // Refresh inventory + low-stock badge in real time
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["shop-notifications"] });
      qc.invalidateQueries({ queryKey: ["shop-trend"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      const id = typeof saleId === "string" ? saleId : saleId?.id;
      if (id) {
        setLastSaleId(id);
        setCheckoutOpen(false);
        setSuccessOpen(true);
      } else {
        nav({ to: "/app/sales" });
      }
    },
    onError: (e: any) => {
      const msg = e?.message ?? "";
      if (/লিমিট|LIMIT_EXCEEDED|সীমা/i.test(msg)) {
        setUpgradeMsg(msg);
        setUpgradeOpen(true);
        setCheckoutOpen(false);
      } else {
        toast.error(msg);
      }
    },
  });

  const submit = () => {
    if (lines.length === 0) return toast.error("কমপক্ষে একটি পণ্য যোগ করুন");
    if (!shiftQ.data?.shift) return toast.error("আগে POS শিফট শুরু করুন");
    if (saleType !== "cash" && !customerId)
      return toast.error("বাকি/কিস্তি বিক্রির জন্য কাস্টমার বাছাই করুন");
    for (const l of lines) {
      if (l.quantity > l.stock)
        return toast.error(`"${l.name}" এর স্টক অপর্যাপ্ত (${l.stock})`);
    }
    m.mutate();
  };

  const catList: { id: string; name: string }[] = [
    { id: "all", name: "সব" },
    ...(cats.data ?? []).map((c: any) => ({ id: c.id, name: c.name })),
    { id: "uncat", name: "অন্যান্য" },
  ];

  const selectedCustomer = customerId
    ? (cust.data ?? []).find((c: any) => c.id === customerId)
    : null;

  const OrderPanel = () => (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            অর্ডার
          </div>
          <div className="text-lg font-bold text-slate-900">ড্রাফ্ট</div>
        </div>
        {lines.length > 0 && (
          <Button size="sm" variant="ghost" className="text-rose-600 hover:text-rose-700" onClick={clearCart}>
            <Trash2 className="mr-1 h-4 w-4" /> ক্লিয়ার
          </Button>
        )}
      </div>

      <div className="border-b px-4 py-3">
        <button
          type="button"
          onClick={() => setCustomerPickerOpen(true)}
          className={`flex w-full items-center gap-3 rounded-lg border-2 border-dashed px-3 py-2.5 text-left transition ${
            customerId
              ? "border-emerald-400 bg-emerald-50/40"
              : "border-orange-300 bg-orange-50/40 hover:bg-orange-50"
          }`}
        >
          <div className={`flex h-9 w-9 items-center justify-center rounded-md ${customerId ? "bg-emerald-100 text-emerald-700" : "bg-orange-100 text-orange-700"}`}>
            <User className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">
              {selectedCustomer ? selectedCustomer.name : "কাস্টমার যোগ করুন"}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">
              {selectedCustomer
                ? selectedCustomer.phone ?? "—"
                : "লয়ালটি অর্জন করুন, অর্ডার সংযুক্ত করুন"}
            </div>
          </div>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        {lines.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-muted-foreground">
            <ShoppingCart className="h-10 w-10 opacity-30" />
            <div>কার্ট খালি</div>
            <div className="text-xs">বামের গ্রিড থেকে পণ্য যোগ করুন</div>
          </div>
        ) : (
          <div className="space-y-1.5">
            {lines.map((l, i) => (
              <div key={i} className="group flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-slate-50">
                  {l.image_url ? (
                    <img src={l.image_url} alt={l.name} className="h-full w-full object-contain" />
                  ) : (
                    <ImageIcon className="h-4 w-4 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">{l.name}</div>
                      {l.sku && (
                        <div className="text-[10px] font-medium uppercase text-muted-foreground">{l.sku}</div>
                      )}
                      <div className="text-[11px] text-muted-foreground">
                        ৳{l.unit_price.toFixed(2)} {l.unit ? `/ ${l.unit}` : ""}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      ৳{(l.quantity * l.unit_price).toFixed(2)}
                    </div>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex items-center rounded-md border bg-white">
                      <button
                        type="button"
                        onClick={() => updateLine(i, { quantity: Math.max(0, l.quantity - 1) })}
                        className="flex h-7 w-7 items-center justify-center text-slate-600 hover:bg-slate-100"
                        aria-label="কমান"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <input
                        type="number" step="0.001" min="0" value={l.quantity}
                        onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })}
                        className="w-14 border-x bg-transparent px-1 py-1 text-center text-sm font-medium outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => updateLine(i, { quantity: l.quantity + 1 })}
                        className="flex h-7 w-7 items-center justify-center text-slate-600 hover:bg-slate-100"
                        aria-label="বাড়ান"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{l.unit ?? ""}</span>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="ml-auto text-slate-400 opacity-0 transition group-hover:opacity-100 hover:text-rose-600"
                      aria-label="মুছুন"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">ছাড়</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={l.discount_amount || 0}
                      onChange={(e) => updateLine(i, { discount_amount: Math.max(0, Number(e.target.value) || 0) })}
                      className="h-6 w-20 rounded border bg-white px-1.5 text-right text-xs outline-none"
                    />
                    <span className="text-[10px] text-muted-foreground">৳ / লাইন</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t bg-white px-4 py-3">
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {lines.length} আইটেম · {totalUnits.toFixed(2)} ইউনিট
          </span>
          <span className="text-slate-700">৳{subtotal.toFixed(2)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Percent className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">ছাড়</span>
          <Input
            type="number" step="0.01" min="0" value={discount}
            onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))}
            className="ml-auto h-8 w-24 text-right"
          />
        </div>

        <div className="mt-3 flex items-baseline justify-between border-t pt-3">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            মোট প্রদেয়
          </span>
          <span className="text-2xl font-black text-slate-900">৳{total.toFixed(2)}</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button type="button" variant="outline" className="h-11" onClick={() => nav({ to: "/app/sales" })}>
            বাতিল
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={lines.length === 0}
            onClick={() => { setSaleType("due"); setCheckoutOpen(true); }}
          >
            বাকি
          </Button>
          <Button
            type="button"
            disabled={lines.length === 0}
            onClick={() => setCheckoutOpen(true)}
            className="h-11 bg-orange-500 font-bold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            চেকআউট
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-3rem)] min-w-0 flex-col bg-slate-50 md:h-[calc(100dvh-3.25rem)]">
      {!shiftQ.isLoading && !shiftQ.data?.shift && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span>⚠️ POS শিফট বন্ধ। বিক্রয় করার আগে শিফট শুরু করুন।</span>
          <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600">
            <Link to="/app/shifts">শিফট শুরু করুন</Link>
          </Button>
        </div>
      )}
      {/* Top bar */}
      <div className="flex items-center gap-2 border-b bg-white px-3 py-2 md:px-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="পণ্য সার্চ (নাম / SKU)..."
            className="h-11 rounded-full border-slate-200 bg-slate-50 pl-9 pr-12"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded border bg-white px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline-block">/</kbd>
        </div>
        <form onSubmit={onBarcodeSubmit} className="relative hidden md:block">
          <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            ref={barcodeRef}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="বারকোড স্ক্যান..."
            className="h-11 w-60 rounded-full border-slate-200 bg-slate-50 pl-9 pr-12"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border bg-white px-1.5 py-0.5 text-[10px] text-muted-foreground">F8</kbd>
        </form>
        <Sheet open={cartOpen} onOpenChange={setCartOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" className="relative h-11 w-11 shrink-0 md:hidden" size="icon" aria-label="কার্ট">
              <ShoppingCart className="h-5 w-5" />
              {lines.length > 0 && (
                <Badge className="absolute -right-1.5 -top-1.5 h-5 min-w-5 rounded-full bg-orange-500 px-1 text-[10px]">
                  {lines.length}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(92vw,22rem)] p-0">
            <SheetTitle className="sr-only">অর্ডার</SheetTitle>
            <OrderPanel />
          </SheetContent>
        </Sheet>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b bg-white px-3 py-2 md:px-4">
        {!shiftQ.isLoading && !shiftQ.data?.shift && (
          <div className="hidden" />
        )}
        {catList.map((c) => {
          const count = catCounts[c.id] ?? 0;
          if (c.id === "uncat" && count === 0) return null;
          const active = activeCat === c.id;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveCat(c.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className={`inline-block h-2 w-2 rounded-full ${active ? "bg-white/80" : "bg-orange-400"}`} />
              {c.name}
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-white/25 text-white" : "bg-slate-100 text-slate-600"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main grid + cart */}
      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-y-auto p-3 md:p-4">
          {prod.isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">লোড হচ্ছে...</div>
          ) : visibleProducts.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">কোনো পণ্য পাওয়া যায়নি</div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {visibleProducts.map((p: any) => {
                const stock = Number(p.stock_quantity ?? 0);
                const low = stock > 0 && stock <= Number(p.low_stock_alert ?? 0);
                const out = stock <= 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={out}
                    onClick={() => addProduct(p.id)}
                    className={`group relative flex flex-col overflow-hidden rounded-xl border bg-white text-left transition hover:border-orange-300 hover:shadow-md ${
                      out ? "opacity-50" : ""
                    }`}
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-slate-50">
                      {p.image_url ? (
                        <img
                          src={p.image_url}
                          alt={p.name}
                          className="h-full w-full object-contain p-2 transition group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <ImageIcon className="h-10 w-10" />
                        </div>
                      )}
                      {out ? (
                        <div className="absolute left-2 top-2 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          স্টক নেই
                        </div>
                      ) : low ? (
                        <div className="absolute left-2 top-2 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                          কম: {stock.toFixed(0)}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex min-h-[64px] flex-col justify-between gap-1 p-2.5">
                      <div className="line-clamp-2 text-[13px] font-semibold leading-tight text-slate-900">
                        {p.name}
                      </div>
                      <div className="flex items-baseline justify-between">
                        <div className="text-sm font-bold text-slate-900">
                          ৳{Number(p.sale_price).toFixed(2)}
                        </div>
                        {!out && !low && (
                          <div className="text-[10px] text-muted-foreground">
                            {stock.toFixed(0)} {p.unit?.short_name ?? ""}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Right cart — desktop */}
        <aside className="hidden w-[22rem] shrink-0 border-l bg-white md:flex md:flex-col">
          <OrderPanel />
        </aside>
      </div>

      {/* Customer picker dialog */}
      <Dialog open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>কাস্টমার বাছাই করুন</DialogTitle>
          </DialogHeader>
          <SearchableSelect
            value={customerId}
            onChange={(v) => { setCustomerId(v); setCustomerPickerOpen(false); }}
            placeholder="Walk-in (ঐচ্ছিক)"
            searchPlaceholder="নাম / ফোন সার্চ..."
            options={(cust.data ?? []).map((c: any) => ({
              value: c.id,
              label: c.name,
              hint: c.phone ?? "",
              keywords: `${c.name} ${c.phone ?? ""}`,
            }))}
          />
          {customerId && (
            <Button variant="ghost" className="mt-2 text-rose-600" onClick={() => { setCustomerId(""); setCustomerPickerOpen(false); }}>
              <X className="mr-1 h-4 w-4" /> কাস্টমার সরান
            </Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Checkout dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>চেকআউট — ৳{total.toFixed(2)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>বিক্রয়ের ধরন</Label>
              <Select
                value={saleType}
                onValueChange={(v) => { setSaleType(v as SaleType); if (v === "cash") setPaid(0); }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">নগদ বিক্রি</SelectItem>
                  <SelectItem value="due">বাকিতে বিক্রি</SelectItem>
                  <SelectItem value="installment">কিস্তিতে বিক্রি</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>পেমেন্ট মেথড</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">নগদ</SelectItem>
                    <SelectItem value="card">কার্ড</SelectItem>
                    <SelectItem value="bkash">বিকাশ</SelectItem>
                    <SelectItem value="bank">ব্যাংক</SelectItem>
                    {saleType !== "cash" && <SelectItem value="due">বাকি</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>তারিখ</Label>
                <Input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
              </div>
            </div>
            {saleType !== "cash" && (
              <div>
                <Label>এখন পরিশোধ</Label>
                <Input
                  type="number" step="0.01" min="0" max={total} value={paid}
                  onChange={(e) => setPaid(Number(e.target.value))}
                />
              </div>
            )}
            {saleType === "installment" && (
              <div className="grid grid-cols-3 gap-2 rounded-lg border bg-slate-50 p-2.5">
                <div>
                  <Label className="text-xs">কিস্তি</Label>
                  <Input
                    type="number" min="1" max="60" value={installments}
                    onChange={(e) => setInstallments(Math.max(1, Number(e.target.value)))}
                  />
                </div>
                <div>
                  <Label className="text-xs">ফ্রিকোয়েন্সি</Label>
                  <Select value={instFreq} onValueChange={(v) => setInstFreq(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">সাপ্তাহিক</SelectItem>
                      <SelectItem value="monthly">মাসিক</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">শুরু</Label>
                  <Input type="date" value={instStart} onChange={(e) => setInstStart(e.target.value)} />
                </div>
              </div>
            )}
            <div>
              <Label>নোট</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div>
              <Label>ইনভয়েস নং (ঐচ্ছিক)</Label>
              <Input
                value={invoiceNo}
                onChange={(e) => setInvoiceNo(e.target.value)}
                placeholder="স্বয়ংক্রিয় হলে ফাঁকা রাখুন"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>অর্ডার ছাড় (৳)</Label>
                <Input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} />
              </div>
              <div>
                <Label>VAT / ট্যাক্স (%)</Label>
                <Input type="number" min="0" step="0.01" value={taxRate} onChange={(e) => setTaxRate(Math.max(0, Number(e.target.value) || 0))} />
              </div>
            </div>

            <label className="flex items-center gap-2 rounded-lg border bg-slate-50 px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={printAfter}
                onChange={(e) => setPrintAfter(e.target.checked)}
                className="h-4 w-4 accent-orange-500"
              />
              <span>বিক্রয়ের পর রিসিট প্রিন্ট/দেখাও</span>
            </label>

            <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 text-sm">
              <div className="text-muted-foreground">সাবটোটাল</div>
              <div className="text-right">৳{subtotal.toFixed(2)}</div>
              {itemDiscountTotal > 0 && (
                <>
                  <div className="text-muted-foreground">আইটেম ছাড়</div>
                  <div className="text-right">-৳{itemDiscountTotal.toFixed(2)}</div>
                </>
              )}
              <div className="text-muted-foreground">ছাড়</div>
              <div className="text-right">৳{discount.toFixed(2)}</div>
              {taxAmount > 0 && (
                <>
                  <div className="text-muted-foreground">VAT ({taxRate}%)</div>
                  <div className="text-right">+৳{taxAmount.toFixed(2)}</div>
                </>
              )}
              <div className="text-muted-foreground">পরিশোধিত</div>
              <div className="text-right text-emerald-600">৳{effectivePaid.toFixed(2)}</div>
              <div className="text-muted-foreground">বাকি</div>
              <div className="text-right font-semibold text-orange-600">৳{due.toFixed(2)}</div>
              <div className="col-span-2 flex items-baseline justify-between border-t pt-2">
                <span className="text-xs font-bold uppercase text-muted-foreground">মোট</span>
                <span className="text-xl font-black">৳{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutOpen(false)}>
              <X className="mr-1 h-4 w-4" /> বাতিল
            </Button>
            <Button
              disabled={m.isPending}
              onClick={submit}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <Plus className="mr-1 h-4 w-4" /> বিক্রয় নিশ্চিত করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SuccessDialog
        open={successOpen}
        onOpenChange={setSuccessOpen}
        saleId={lastSaleId}
        getSaleFn={getSaleFn}
        sendSmsFn={sendSmsFn}
        onNewSale={() => { setSuccessOpen(false); clearCart(); barcodeRef.current?.focus(); }}
        onOpenFullReceipt={(id) => nav({ to: "/app/sales/$saleId", params: { saleId: id } })}
        onEdit={async (sale) => {
          if (!confirm("বর্তমান বিক্রয়টি বাতিল করে সম্পাদনার জন্য কার্টে ফেরত আনা হবে। চালিয়ে যাবেন?")) return;
          try {
            await cancelFn({ data: { sale_id: sale.id, reason: "Edit before finalize" } });
            // Restore cart lines from sale
            const restored: Line[] = (sale.items ?? []).map((it: any) => ({
              product_id: it.product_id,
              name: it.product?.name ?? "-",
              sku: it.product?.sku ?? "",
              unit_price: Number(it.unit_price ?? 0),
              unit_cost: Number(it.unit_cost ?? 0),
              quantity: Number(it.quantity ?? 1),
              stock: Number(it.product?.stock_quantity ?? 999999),
              discount_amount: Number(it.discount_amount ?? 0),
              image_url: it.product?.image_url ?? null,
            }));
            setLines(restored);
            if (sale.customer_id) setCustomerId(sale.customer_id);
            if (sale.discount) setDiscount(Number(sale.discount) || 0);
            if (sale.note) setNote(sale.note);
            setSaleType(sale.sale_type || "cash");
            setSuccessOpen(false);
            qc.invalidateQueries({ queryKey: ["products"] });
            qc.invalidateQueries({ queryKey: ["sales"] });
            toast.success("বিক্রয় বাতিল হয়েছে — কার্টে সম্পাদনা করুন");
          } catch (e: any) {
            toast.error(e?.message ?? "বাতিল ব্যর্থ");
          }
        }}
      />
      <UpgradePackageDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} message={upgradeMsg} />
    </div>
  );
}

function SuccessDialog({
  open, onOpenChange, saleId, getSaleFn, sendSmsFn, onNewSale, onOpenFullReceipt, onEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  saleId: string | null;
  getSaleFn: (args: { data: { id: string } }) => Promise<any>;
  sendSmsFn: (args: { data: { sale_id: string; phone?: string | null; origin: string } }) => Promise<any>;
  onNewSale: () => void;
  onOpenFullReceipt: (id: string) => void;
  onEdit: (sale: any) => void | Promise<void>;
}) {
  const q = useQuery({
    queryKey: ["sale-share", saleId],
    queryFn: () => getSaleFn({ data: { id: saleId! } }),
    enabled: !!saleId && open,
  });
  const sale: any = q.data?.sale;
  const customer = sale?.customer;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = sale?.share_token ? `${origin}/i/${sale.share_token}` : "";

  const [smsPhone, setSmsPhone] = useState("");
  const [lastSmsAt, setLastSmsAt] = useState<Date | null>(null);
  const [smsSentTo, setSmsSentTo] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  useEffect(() => {
    if (customer?.phone) setSmsPhone(customer.phone);
  }, [customer?.phone]);
  useEffect(() => {
    if (!open) { setLastSmsAt(null); setSmsSentTo(null); }
  }, [open]);

  const smsM = useMutation({
    mutationFn: () => sendSmsFn({ data: { sale_id: saleId!, phone: smsPhone || null, origin } }),
    onSuccess: () => {
      setLastSmsAt(new Date());
      setSmsSentTo(smsPhone);
      toast.success("SMS পাঠানো হয়েছে");
    },
    onError: (e: any) => toast.error(e.message ?? "SMS পাঠানো যায়নি"),
  });

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("লিংক কপি হয়েছে");
    } catch {
      toast.error("কপি করা যায়নি");
    }
  };

  const nativeShare = async () => {
    if (!publicUrl) return;
    try {
      if (typeof navigator !== "undefined" && (navigator as any).share) {
        await (navigator as any).share({
          title: `ইনভয়েস #${sale?.invoice_no ?? ""}`,
          text: `৳${Number(sale?.total || 0).toFixed(2)} — ইনভয়েস দেখুন`,
          url: publicUrl,
        });
      } else {
        await copyLink();
      }
    } catch { /* cancelled */ }
  };

  const printInvoice = () => {
    if (typeof window === "undefined") return;
    const el = document.getElementById("pos-invoice-preview");
    if (!el) return;
    document.body.classList.add("printing-invoice");
    const done = () => {
      document.body.classList.remove("printing-invoice");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
    // fallback cleanup
    setTimeout(done, 2000);
  };

  const downloadPdf = async () => {
    const el = document.getElementById("pos-invoice-preview");
    if (!el) return;
    setPdfBusy(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 6;
      const availW = pageW - margin * 2;
      const ratio = canvas.height / canvas.width;
      let w = availW;
      let h = availW * ratio;
      if (h > pageH - margin * 2) { h = pageH - margin * 2; w = h / ratio; }
      pdf.addImage(imgData, "PNG", (pageW - w) / 2, margin, w, h);
      const name = `invoice-${sale?.invoice_no ?? sale?.id ?? Date.now()}.pdf`;
      pdf.save(name);
      toast.success("PDF ডাউনলোড হয়েছে");
    } catch (e: any) {
      toast.error(e?.message ?? "PDF তৈরি করা যায়নি");
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md print:max-w-none print:border-0 print:shadow-none">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 print:hidden">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            বিক্রয় সম্পন্ন
          </DialogTitle>
        </DialogHeader>

        {!sale ? (
          <div className="py-6 text-center text-sm text-muted-foreground">লোড হচ্ছে...</div>
        ) : (
          <div className="space-y-3 max-h-[70vh] overflow-y-auto print:max-h-none print:overflow-visible">
            <InvoicePreview sale={sale} />

            <div className="flex flex-wrap gap-2 print:hidden">
              <Button size="sm" variant="outline" onClick={printInvoice} className="flex-1 min-w-[110px]">
                <Printer className="mr-1 h-4 w-4" /> প্রিন্ট
              </Button>
              <Button size="sm" variant="outline" onClick={downloadPdf} disabled={pdfBusy} className="flex-1 min-w-[110px]">
                <Download className="mr-1 h-4 w-4" /> {pdfBusy ? "..." : "PDF"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onEdit(sale)} className="flex-1 min-w-[110px]">
                <Pencil className="mr-1 h-4 w-4" /> সম্পাদনা
              </Button>
            </div>

            <div className="print:hidden">
              <Label className="text-xs">পাবলিক শেয়ারযোগ্য লিংক</Label>
              <div className="mt-1 flex items-center gap-1">
                <Input readOnly value={publicUrl} className="h-9 text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button size="icon" variant="outline" onClick={copyLink} title="কপি" className="h-9 w-9 shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={nativeShare} title="শেয়ার" className="h-9 w-9 shrink-0">
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                লিংকে ক্লিক করলে কাস্টমার লগিন ছাড়াই ইনভয়েস দেখতে পাবে।
              </p>
            </div>

            <div className="print:hidden">
              <Label className="text-xs">SMS পাঠান (কাস্টমারের মোবাইলে লিংক যাবে)</Label>
              <div className="mt-1 flex items-center gap-1">
                <Input
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="h-9 text-sm"
                />
                <Button
                  size="sm"
                  className="h-9 shrink-0"
                  disabled={smsM.isPending || !smsPhone.trim()}
                  onClick={() => smsM.mutate()}
                >
                  <MessageSquare className="mr-1 h-4 w-4" />
                  {smsM.isPending ? "পাঠাচ্ছে..." : lastSmsAt ? "আবার পাঠান" : "পাঠান"}
                </Button>
              </div>
              {smsM.isError && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                  <X className="h-3 w-3" /> পাঠানো যায়নি — আবার চেষ্টা করুন
                </div>
              )}
              {lastSmsAt && !smsM.isPending && !smsM.isError && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                  <CheckCheck className="h-3 w-3" />
                  পাঠানো হয়েছে {smsSentTo && `→ ${smsSentTo}`} • {lastSmsAt.toLocaleTimeString("bn-BD")}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-between print:hidden">
          <Button variant="outline" onClick={onNewSale}>
            <Plus className="mr-1 h-4 w-4" /> নতুন বিক্রয়
          </Button>
          <Button
            disabled={!saleId}
            onClick={() => saleId && onOpenFullReceipt(saleId)}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Printer className="mr-1 h-4 w-4" /> ফুল রিসিট
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InvoicePreview({ sale }: { sale: any }) {
  const items = sale.items ?? [];
  const fmt = (n: number) => Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const typeLabel: Record<string, string> = { cash: "নগদ", due: "বাকি", installment: "কিস্তি" };
  return (
    <div id="pos-invoice-preview" className="rounded-lg border bg-white p-3 text-[12px] leading-tight text-black">
      <div className="text-center">
        <div className="text-base font-black uppercase tracking-wide">INVOICE</div>
      </div>
      <div className="my-1.5 border-t border-dashed" />
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px]">
        <div className="text-muted-foreground">Invoice</div>
        <div className="text-right font-semibold">{sale.invoice_no ?? String(sale.id).slice(0, 8)}</div>
        <div className="text-muted-foreground">Date</div>
        <div className="text-right">{new Date(sale.sale_date).toLocaleString("en-GB")}</div>
        <div className="text-muted-foreground">Type</div>
        <div className="text-right">{typeLabel[sale.sale_type] ?? sale.sale_type}</div>
        <div className="text-muted-foreground">Customer</div>
        <div className="text-right">{sale.customer?.name ?? "Walk-in"}</div>
        {sale.customer?.phone && (
          <>
            <div className="text-muted-foreground">Phone</div>
            <div className="text-right">{sale.customer.phone}</div>
          </>
        )}
      </div>
      <div className="my-1.5 border-t border-dashed" />
      <div className="space-y-0.5">
        {items.map((it: any, i: number) => (
          <div key={it.id} className="grid grid-cols-[1fr_auto] gap-x-2 text-[11px]">
            <div>
              <div className="font-medium">{i + 1}. {it.product?.name ?? "-"}</div>
              <div className="text-[10px] text-muted-foreground">
                {it.quantity} {it.product?.unit?.short_name ?? ""} × {fmt(it.unit_price)}
                {Number(it.discount_amount || 0) > 0 && ` − ${fmt(it.discount_amount)}`}
                {Number(it.tax_rate || 0) > 0 && ` + VAT ${it.tax_rate}%`}
              </div>
            </div>
            <div className="text-right font-semibold">{fmt(it.line_total)}</div>
          </div>
        ))}
      </div>
      <div className="my-1.5 border-t border-dashed" />
      <div className="space-y-0.5 text-[11px]">
        <div className="flex justify-between"><span>Subtotal</span><span>{fmt(sale.subtotal)}</span></div>
        {Number(sale.discount || 0) > 0 && (
          <div className="flex justify-between"><span>Discount</span><span>-{fmt(sale.discount)}</span></div>
        )}
        {Number(sale.tax_amount || 0) > 0 && (
          <div className="flex justify-between"><span>VAT</span><span>+{fmt(sale.tax_amount)}</span></div>
        )}
        <div className="mt-0.5 flex justify-between border-t pt-0.5 text-sm font-black">
          <span>TOTAL</span><span>৳ {fmt(sale.total)}</span>
        </div>
        <div className="flex justify-between"><span>Paid</span><span>{fmt(sale.paid)}</span></div>
        {Number(sale.due || 0) > 0 && (
          <div className="flex justify-between font-bold text-rose-600">
            <span>Due</span><span>{fmt(sale.due)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
