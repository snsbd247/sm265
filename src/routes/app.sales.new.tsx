import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCustomers, createSale, updateSale, getSale, cancelSale, saveCustomer } from "@/lib/sales.functions";
import { sendInvoiceLinkSms } from "@/lib/public-invoice.functions";
import { sendInvoiceLinkEmail } from "@/lib/invoice-delivery.functions";
import { snapshotSale } from "@/lib/sale-revisions.functions";
import { getInvoiceTemplate, DEFAULT_TEMPLATE } from "@/lib/invoice-template.functions";
import { SaleDeliveryHistory } from "@/components/invoice-delivery-history";
import { InvoicePreview } from "@/components/invoice-preview";
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
import { Plus, Minus, Trash2, Search, ScanLine, User, Percent, X, ShoppingCart, ImageIcon, Printer, MessageSquare, Copy, CheckCircle2, Share2, Download, Pencil, CheckCheck, Mail, UserPlus, Phone, Camera, CloudOff, RefreshCcw } from "lucide-react";
import { UpgradePackageDialog } from "@/components/upgrade-package-dialog";
import { computeCartTotals, clampDiscount as clampD, validateSale } from "@/lib/pos-calc";
import { BarcodeScannerDialog } from "@/components/barcode-scanner-dialog";
import { loadDraft, saveDraft, clearDraft, readQueue, enqueueSale, removeFromQueue, isNetworkError, type SaleQueueItem } from "@/lib/pos-offline";

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return (crypto as any).randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

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
  const updateFn = useServerFn(updateSale);
  const getSaleFn = useServerFn(getSale);
  const sendSmsFn = useServerFn(sendInvoiceLinkSms);
  const cancelFn = useServerFn(cancelSale);
  const sendEmailFn = useServerFn(sendInvoiceLinkEmail);
  const snapshotFn = useServerFn(snapshotSale);
  const saveCustomerFn = useServerFn(saveCustomer);

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
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickName, setQuickName] = useState("");
  const [quickPhone, setQuickPhone] = useState("");
  const [quickAddress, setQuickAddress] = useState("");
  const [quickOpening, setQuickOpening] = useState(0);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => cryptoRandomId());
  const [editSaleId, setEditSaleId] = useState<string | null>(null);
  const [editInvoiceNo, setEditInvoiceNo] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === "undefined" ? true : navigator.onLine);
  const [queueCount, setQueueCount] = useState<number>(() => (typeof window === "undefined" ? 0 : readQueue().length));

  // Post-sale success dialog
  const [successOpen, setSuccessOpen] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [upgradeMsg, setUpgradeMsg] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);
  const barcodeRef = useRef<HTMLInputElement>(null);
  const customerBoxRef = useRef<HTMLDivElement>(null);
  const focusCustomerPicker = () => {
    const btn = customerBoxRef.current?.querySelector<HTMLButtonElement>('button[role="combobox"]');
    btn?.click();
  };
  const qc = useQueryClient();

  const totals = useMemo(
    () => computeCartTotals({ lines, order_discount: discount, tax_rate: taxRate, sale_type: saleType, paid }),
    [lines, discount, taxRate, saleType, paid],
  );
  const { subtotal, itemDiscountTotal, discountBase, total, taxAmount, due, unitCount: totalUnits, paid: effectivePaid } = totals;
  const clampDiscount = (v: number) => clampD(v, discountBase);

  // Auto-clamp discount if base shrinks (e.g. line removed)
  useEffect(() => {
    if (discount > discountBase) setDiscount(discountBase);
  }, [discountBase]);
  // Keep paid within [0, total] when total changes
  useEffect(() => {
    if (paid > total) setPaid(total);
  }, [total]);

  // Restore cart from an edit-invoice flow (populated in sessionStorage by the sale detail page)
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    if (!prod.data) return;
    let raw: string | null = null;
    try { raw = sessionStorage.getItem("pos:restore-sale"); } catch { /* ignore */ }
    if (!raw) return;
    restoredRef.current = true;
    try { sessionStorage.removeItem("pos:restore-sale"); } catch { /* ignore */ }
    try {
      const payload = JSON.parse(raw) as {
        edit_sale_id?: string;
        invoice_no?: string | null;
        items?: Array<{ product_id: string; quantity: number; unit_price?: number; unit_cost?: number; discount_amount?: number; product?: { name?: string; sku?: string; unit?: { short_name?: string } } }>;
        customer_id?: string | null;
        discount?: number;
        paid?: number;
        sale_type?: SaleType;
        payment_method?: "cash" | "card" | "bkash" | "bank" | "due";
        note?: string;
      };
      const restored: Line[] = (payload.items ?? []).map((it) => {
        const p = prod.data?.find((x: any) => x.id === it.product_id);
        return {
          product_id: it.product_id,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price ?? p?.sale_price ?? 0),
          unit_cost: Number(it.unit_cost ?? p?.purchase_price ?? 0),
          discount_amount: Number(it.discount_amount ?? 0),
          stock: Number(p?.stock_quantity ?? 0),
          name: p?.name ?? it.product?.name ?? "পণ্য",
          unit: p?.unit?.short_name ?? it.product?.unit?.short_name,
          image_url: p?.image_url ?? null,
          sku: p?.sku ?? it.product?.sku ?? null,
        };
      });
      if (restored.length) setLines(restored);
      if (payload.customer_id) setCustomerId(payload.customer_id);
      if (typeof payload.discount === "number") setDiscount(payload.discount);
      if (typeof payload.paid === "number") setPaid(payload.paid);
      if (payload.sale_type) setSaleType(payload.sale_type);
      if (payload.payment_method) setMethod(payload.payment_method);
      if (payload.note) setNote(payload.note);
      if (payload.edit_sale_id) {
        setEditSaleId(payload.edit_sale_id);
        setEditInvoiceNo(payload.invoice_no ?? null);
        if (payload.invoice_no) setInvoiceNo(payload.invoice_no);
        toast.success(`সম্পাদনা মোড: ইনভয়েস #${payload.invoice_no ?? ""}`);
      } else {
        toast.success("সম্পাদনার জন্য ইনভয়েসের ডাটা কার্টে লোড হয়েছে");
      }
    } catch { /* ignore malformed */ }
  }, [prod.data]);

  // Auto-persist current cart as a local draft so a reload / brief network drop won't lose it.
  const draftHydrated = useRef(false);
  useEffect(() => {
    if (draftHydrated.current) return;
    if (!prod.data) return;
    // Skip auto-hydration if the edit-invoice flow already loaded something
    if (restoredRef.current || lines.length > 0) { draftHydrated.current = true; return; }
    const d = loadDraft<any>();
    if (d?.lines?.length) {
      const restored: Line[] = d.lines.map((it: any) => {
        const p = prod.data?.find((x: any) => x.id === it.product_id);
        return {
          product_id: it.product_id,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price ?? p?.sale_price ?? 0),
          unit_cost: Number(it.unit_cost ?? p?.purchase_price ?? 0),
          discount_amount: Number(it.discount_amount ?? 0),
          stock: Number(p?.stock_quantity ?? it.stock ?? 0),
          name: p?.name ?? it.name ?? "পণ্য",
          unit: p?.unit?.short_name ?? it.unit,
          image_url: p?.image_url ?? it.image_url ?? null,
          sku: p?.sku ?? it.sku ?? null,
        };
      });
      setLines(restored);
      if (d.customer_id) setCustomerId(d.customer_id);
      if (typeof d.discount === "number") setDiscount(d.discount);
      if (typeof d.taxRate === "number") setTaxRate(d.taxRate);
      if (d.note) setNote(d.note);
      toast.info("অসম্পূর্ণ কার্ট পুনরুদ্ধার হয়েছে");
    }
    draftHydrated.current = true;
  }, [prod.data]);
  useEffect(() => {
    if (!draftHydrated.current) return;
    if (editSaleId) return; // don't overwrite draft with an in-flight edit
    if (lines.length === 0 && !customerId && !discount && !taxRate && !note) {
      clearDraft();
      return;
    }
    saveDraft({
      lines: lines.map((l) => ({
        product_id: l.product_id, quantity: l.quantity, unit_price: l.unit_price,
        unit_cost: l.unit_cost, discount_amount: l.discount_amount,
        name: l.name, sku: l.sku, unit: l.unit, image_url: l.image_url, stock: l.stock,
      })),
      customer_id: customerId || null,
      discount, taxRate, note,
    });
  }, [lines, customerId, discount, taxRate, note, editSaleId]);

  // Online/offline listeners + auto-flush queued sales when back online
  const createFnRef = useRef(createFn);
  createFnRef.current = createFn;
  const flushQueue = async () => {
    const queue = readQueue();
    if (queue.length === 0) return;
    let flushed = 0;
    for (const item of queue) {
      try {
        // Only createSale is queueable (updates are rare and safer to redo manually)
        await createFnRef.current({ data: item.payload });
        removeFromQueue(item.id);
        flushed++;
      } catch (e) {
        if (isNetworkError(e)) break; // stop; will retry later
        // Non-network error → drop it so it doesn't loop forever
        removeFromQueue(item.id);
      }
    }
    setQueueCount(readQueue().length);
    if (flushed > 0) {
      toast.success(`${flushed}টি অফলাইন বিক্রয় সিঙ্ক হয়েছে`);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["shop-notifications"] });
    }
  };
  useEffect(() => {
    const on = () => { setIsOnline(true); flushQueue(); };
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    // Attempt an initial flush in case queued items were left from an earlier session
    if (navigator.onLine) flushQueue();
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); focusCustomerPicker();
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

  const handleScannedCode = (code: string) => {
    const c = code.trim();
    if (!c) return;
    const p = (prod.data ?? []).find(
      (x: any) =>
        (x.barcode && x.barcode === c) ||
        (x.sku && x.sku.toLowerCase() === c.toLowerCase()),
    );
    if (p) {
      addProduct(p.id);
      toast.success(`যোগ হয়েছে: ${p.name}`);
    } else {
      toast.error(`পণ্য পাওয়া যায়নি: ${c}`);
    }
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
    mutationFn: (vars: { saleTypeOverride?: SaleType; paidOverride?: number } = {}) => {
      const st = vars.saleTypeOverride ?? saleType;
      const p = vars.paidOverride ?? (st === "cash" ? total : paid);
      const payload = {
          customer_id: customerId || null,
          invoice_no: invoiceNo || null,
          sale_date: saleDate,
          discount,
          paid: p,
          payment_method: st === "cash" ? method : st === "due" ? "due" : method,
          sale_type: st,
          note: note || null,
          items: lines.map((l) => ({
            product_id: l.product_id,
            quantity: l.quantity,
            unit_price: l.unit_price,
            unit_cost: l.unit_cost,
            discount_amount: l.discount_amount || 0,
            tax_rate: taxRate || 0,
          })),
          installments: st === "installment" ? installments : null,
          installment_frequency: instFreq,
          installment_start: instStart,
          idempotency_key: idempotencyKey,
      };
      if (editSaleId) {
        return updateFn({ data: { ...payload, sale_id: editSaleId } as any });
      }
      return createFn({ data: payload });
    },
    onSuccess: (saleId: any) => {
      if (editSaleId) toast.success("ইনভয়েস আপডেট হয়েছে");
      else if ((saleId as any)?.duplicate) toast.info("এই বিক্রয় ইতিমধ্যে সংরক্ষিত (ডুপ্লিকেট এড়ানো হয়েছে)");
      else toast.success("বিক্রয় সংরক্ষিত");
      // Refresh inventory + low-stock badge in real time
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["shop-notifications"] });
      qc.invalidateQueries({ queryKey: ["shop-trend"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      if (editSaleId) qc.invalidateQueries({ queryKey: ["sale", editSaleId] });
      // Successful commit → clear the offline draft
      clearDraft();
      const id = typeof saleId === "string" ? saleId : saleId?.id;
      if (id) {
        if (editSaleId) {
          const editedId = editSaleId;
          setEditSaleId(null);
          setEditInvoiceNo(null);
          setCheckoutOpen(false);
          nav({ to: "/app/sales/$saleId", params: { saleId: editedId } });
        } else {
          setLastSaleId(id);
          setCheckoutOpen(false);
          setSuccessOpen(true);
          setIdempotencyKey(cryptoRandomId());
        }
      } else {
        nav({ to: "/app/sales" });
      }
    },
    onError: (e: any, vars: any) => {
      const msg = e?.message ?? "";
      // Offline / network failure → queue the sale locally and reset the cart
      if (!editSaleId && isNetworkError(e)) {
        try {
          const st = vars?.saleTypeOverride ?? saleType;
          const p = vars?.paidOverride ?? (st === "cash" ? total : paid);
          const payload = {
            customer_id: customerId || null,
            invoice_no: invoiceNo || null,
            sale_date: saleDate,
            discount,
            paid: p,
            payment_method: st === "cash" ? method : st === "due" ? "due" : method,
            sale_type: st,
            note: note || null,
            items: lines.map((l) => ({
              product_id: l.product_id, quantity: l.quantity,
              unit_price: l.unit_price, unit_cost: l.unit_cost,
              discount_amount: l.discount_amount || 0, tax_rate: taxRate || 0,
            })),
            installments: st === "installment" ? installments : null,
            installment_frequency: instFreq,
            installment_start: instStart,
            idempotency_key: idempotencyKey,
          };
          enqueueSale({ payload, is_update: false });
          setQueueCount(readQueue().length);
          toast.success("অফলাইন — বিক্রয় সংরক্ষিত হয়েছে, কানেকশন ফিরে এলে সিঙ্ক হবে");
          setCheckoutOpen(false);
          clearDraft();
          setLines([]); setDiscount(0); setTaxRate(0); setPaid(0); setNote(""); setInvoiceNo("");
          setIdempotencyKey(cryptoRandomId());
          return;
        } catch { /* fall through to error toast */ }
      }
      if (/লিমিট|LIMIT_EXCEEDED|সীমা/i.test(msg)) {
        setUpgradeMsg(msg);
        setUpgradeOpen(true);
        setCheckoutOpen(false);
      } else {
        toast.error(msg);
      }
    },
  });

  const submit = (overrides: { saleTypeOverride?: SaleType; paidOverride?: number } = {}) => {
    const st = overrides.saleTypeOverride ?? saleType;
    const paidNow = overrides.paidOverride ?? (st === "cash" ? total : paid);
    if (m.isPending) return; // block duplicate submissions
    const t2 = computeCartTotals({ lines, order_discount: discount, tax_rate: taxRate, sale_type: st, paid: paidNow });
    const err = validateSale({ totals: t2, sale_type: st, hasCustomer: !!customerId, installments });
    if (err) return toast.error(err);
    if (!shiftQ.data?.shift) return toast.error("আগে POS শিফট শুরু করুন");
    for (const l of lines) {
      if (l.quantity > l.stock)
        return toast.error(`"${l.name}" এর স্টক অপর্যাপ্ত (${l.stock})`);
    }
    setCheckoutError(null);
    m.mutate(overrides);
  };

  const fullDueSave = () => {
    if (m.isPending) return;
    if (lines.length === 0) return toast.error("কমপক্ষে একটি পণ্য যোগ করুন");
    if (!customerId) {
      toast.error("ফুল বাকি বিক্রির জন্য কাস্টমার বাছাই করুন");
      focusCustomerPicker();
      return;
    }
    setSaleType("due");
    setPaid(0);
    submit({ saleTypeOverride: "due", paidOverride: 0 });
  };

  const quickAddM = useMutation({
    mutationFn: () => {
      const phone = quickPhone.trim();
      const existingByPhone = phone
        ? (cust.data ?? []).find((c: any) => (c.phone ?? "").trim() === phone) ?? null
        : null;
      if (phone && existingByPhone) {
        throw new Error(`এই ফোন নাম্বারে ইতিমধ্যে কাস্টমার আছে: ${existingByPhone.name}`);
      }
      return saveCustomerFn({ data: {
        name: quickName.trim(),
        phone: phone || null,
        address: quickAddress.trim() || null,
        opening_balance: Number(quickOpening) || 0,
        is_active: true,
      } as any });
    },
    onSuccess: async (res: any) => {
      toast.success("কাস্টমার যোগ হয়েছে");
      await qc.invalidateQueries({ queryKey: ["customers"] });
      const newId = res?.id;
      if (newId) setCustomerId(newId);
      setQuickAddOpen(false);
      setQuickName(""); setQuickPhone(""); setQuickAddress(""); setQuickOpening(0);
    },
    onError: (e: any) => toast.error(e?.message ?? "যোগ করা যায়নি"),
  });

  const catList: { id: string; name: string }[] = [
    { id: "all", name: "সব" },
    ...(cats.data ?? []).map((c: any) => ({ id: c.id, name: c.name })),
    { id: "uncat", name: "অন্যান্য" },
  ];

  const selectedCustomer = customerId
    ? (cust.data ?? []).find((c: any) => c.id === customerId)
    : null;

  const existingQuickPhoneMatch = useMemo(() => {
    const p = quickPhone.trim();
    if (!p) return null;
    return (cust.data ?? []).find((c: any) => (c.phone ?? "").trim() === p) ?? null;
  }, [quickPhone, cust.data]);

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
                       className="ml-auto text-slate-400 transition hover:text-rose-600 md:opacity-0 md:group-hover:opacity-100"
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
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            <span className="font-semibold text-slate-700">{lines.length}</span> আইটেম ·{" "}
            <span className="font-semibold text-slate-700">{totalUnits.toFixed(2)}</span> ইউনিট
          </span>
          <span className="text-slate-700">৳{subtotal.toFixed(2)}</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Percent className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">ছাড়</span>
          <Input
            type="number" step="0.01" min="0" max="100"
            value={discountBase > 0 ? Number(((discount / discountBase) * 100).toFixed(2)) : 0}
            onChange={(e) => {
              const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
              setDiscount(clampDiscount(+(discountBase * pct / 100).toFixed(2)));
            }}
            className="ml-auto h-8 w-16 text-right"
            placeholder="%"
          />
          <span className="text-xs text-muted-foreground">%</span>
          <Input
            type="number" step="0.01" min="0" value={discount}
            onChange={(e) => setDiscount(clampDiscount(Number(e.target.value) || 0))}
            className="h-8 w-20 text-right"
            placeholder="৳"
          />
          <span className="text-xs text-muted-foreground">৳</span>
        </div>

        <div className="mt-3 flex items-baseline justify-between border-t pt-3">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            মোট প্রদেয়
          </span>
          <span className="text-2xl font-black text-slate-900">৳{total.toFixed(2)}</span>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button type="button" variant="outline" className="h-11" onClick={clearCart}>
            বাতিল
          </Button>
          <Button
            type="button"
            className="h-11 bg-amber-500 font-bold text-white hover:bg-amber-600 disabled:opacity-50"
            disabled={lines.length === 0 || m.isPending}
            onClick={fullDueSave}
            title="ফুল বাকি — সরাসরি সেভ ও ইনভয়েস"
          >
            ফুল বাকি
          </Button>
          <Button
            type="button"
            disabled={lines.length === 0 || m.isPending}
            onClick={() => { setSaleType("cash"); setCheckoutOpen(true); }}
            className="h-11 bg-orange-500 font-bold text-white hover:bg-orange-600 disabled:opacity-50"
          >
            {m.isPending ? "সেভ হচ্ছে..." : "চেকআউট"}
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
      {editSaleId && (
        <div className="flex items-center justify-between gap-3 border-b border-sky-300 bg-sky-50 px-4 py-2 text-sm text-sky-900">
          <span>✏️ সম্পাদনা মোড — ইনভয়েস <b>#{editInvoiceNo ?? editSaleId.slice(0,8)}</b> আপডেট হবে (নতুন ইনভয়েস তৈরি হবে না)।</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!confirm("সম্পাদনা বাতিল করবেন? পরিবর্তনগুলো হারিয়ে যাবে।")) return;
              const id = editSaleId;
              setEditSaleId(null); setEditInvoiceNo(null); clearCart();
              nav({ to: "/app/sales/$saleId", params: { saleId: id! } });
            }}
          >
            বাতিল করুন
          </Button>
        </div>
      )}
      {/* Top bar */}
      {/* Customer bar */}
      <div ref={customerBoxRef} className="flex flex-wrap items-center gap-2 border-b bg-white px-3 py-2 md:px-4">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <User className="h-4 w-4" /> কাস্টমার
        </div>
        <div className="min-w-0 flex-1">
          <SearchableSelect
            value={customerId}
            onChange={(v) => setCustomerId(v)}
            placeholder="Walk-in Customer (ডিফল্ট)"
            searchPlaceholder="আইডি / ফোন / নাম দিয়ে সার্চ..."
            options={(cust.data ?? []).map((c: any) => ({
              value: c.id,
              label: c.name,
              hint: [c.phone, Number(c.current_balance) > 0 ? `বকেয়া ৳${Number(c.current_balance).toFixed(0)}` : null]
                .filter(Boolean).join(" · "),
              keywords: `${c.name} ${c.phone ?? ""} ${String(c.id).slice(0, 8)}`,
            }))}
          />
        </div>
        {selectedCustomer && (
          <div className="hidden items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-800 sm:inline-flex">
            <Phone className="h-3 w-3" />
            <span>{selectedCustomer.phone ?? "—"}</span>
            {Number(selectedCustomer.current_balance) > 0 && (
              <span className="ml-1 rounded bg-rose-100 px-1.5 py-0.5 font-semibold text-rose-700">
                বকেয়া ৳{Number(selectedCustomer.current_balance).toFixed(0)}
              </span>
            )}
          </div>
        )}
        {customerId && (
          <Button size="sm" variant="ghost" className="h-8 text-rose-600" onClick={() => setCustomerId("")}>
            <X className="mr-1 h-3.5 w-3.5" /> Walk-in
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-8" onClick={() => setQuickAddOpen(true)}>
          <UserPlus className="mr-1 h-3.5 w-3.5" /> নতুন
        </Button>
        <kbd className="hidden rounded border bg-slate-50 px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline-block">Ctrl+K</kbd>
      </div>

      {/* Search bar */}
      <div className="flex items-center gap-2 border-b bg-white px-3 py-2 md:px-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              const code = search.trim();
              if (!code) return;
              const p = (prod.data ?? []).find(
                (x: any) =>
                  (x.barcode && x.barcode === code) ||
                  (x.sku && x.sku.toLowerCase() === code.toLowerCase()),
              );
              if (p) { addProduct(p.id); setSearch(""); }
              else if (visibleProducts.length === 1) { addProduct((visibleProducts[0] as any).id); setSearch(""); }
            }}
            placeholder="পণ্য / বারকোড সার্চ..."
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
          <SheetContent side="right" className="w-[min(96vw,24rem)] p-0">
            <SheetTitle className="sr-only">অর্ডার</SheetTitle>
            <OrderPanel />
          </SheetContent>
        </Sheet>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setScanOpen(true)}
          className="h-11 w-11 shrink-0"
          aria-label="ক্যামেরা স্ক্যান"
        >
          <Camera className="h-5 w-5" />
        </Button>
      </div>

      {(!isOnline || queueCount > 0) && (
        <div className="flex items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 md:px-4">
          <div className="flex items-center gap-1.5">
            <CloudOff className="h-3.5 w-3.5" />
            {!isOnline ? "অফলাইন — বিক্রয় লোকালি সেভ হবে" : `অনলাইন — ${queueCount}টি বিক্রয় সিঙ্ক অপেক্ষমাণ`}
          </div>
          {queueCount > 0 && isOnline && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-amber-900" onClick={() => { flushQueue(); }}>
              <RefreshCcw className="mr-1 h-3 w-3" /> এখনই সিঙ্ক
            </Button>
          )}
        </div>
      )}

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
        <div className="min-w-0 flex-1 overflow-y-auto p-2 pb-24 md:p-4 md:pb-4">
          {prod.isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">লোড হচ্ছে...</div>
          ) : visibleProducts.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">কোনো পণ্য পাওয়া যায়নি</div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2.5 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
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
                    <div className="flex min-h-[56px] flex-col justify-between gap-1 p-2 sm:p-2.5">
                      <div className="line-clamp-2 text-[12px] font-semibold leading-tight text-slate-900 sm:text-[13px]">
                        {p.name}
                      </div>
                      <div className="flex items-baseline justify-between">
                        <div className="text-[13px] font-bold text-slate-900 sm:text-sm">
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

      {/* Sticky mobile bottom action bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-white/95 px-3 py-2 shadow-[0_-4px_16px_-8px_rgba(0,0,0,0.15)] backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative flex h-12 shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-left"
            aria-label="কার্ট খুলুন"
          >
            <ShoppingCart className="h-5 w-5 text-slate-700" />
            <div className="leading-tight">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">কার্ট</div>
              <div className="text-sm font-black text-slate-900">৳{total.toFixed(2)}</div>
            </div>
            {lines.length > 0 && (
              <Badge className="absolute -right-1.5 -top-1.5 h-5 min-w-5 rounded-full bg-orange-500 px-1 text-[10px]">
                {lines.length}
              </Badge>
            )}
          </button>
          <Button
            type="button"
            className="h-12 flex-1 bg-amber-500 font-bold text-white hover:bg-amber-600 disabled:opacity-50"
            disabled={lines.length === 0 || m.isPending}
            onClick={fullDueSave}
          >
            ফুল বাকি
          </Button>
          <Button
            type="button"
            className="h-12 flex-1 bg-orange-500 font-bold text-white hover:bg-orange-600 disabled:opacity-50"
            disabled={lines.length === 0 || m.isPending}
            onClick={() => { setSaleType("cash"); setCheckoutOpen(true); }}
          >
            {m.isPending ? "..." : "চেকআউট"}
          </Button>
        </div>
      </div>

      {/* Quick add customer dialog */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>দ্রুত কাস্টমার যোগ</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>নাম *</Label>
              <Input
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                placeholder="কাস্টমারের নাম"
                autoFocus
              />
            </div>
            <div>
              <Label>ফোন (ডুপ্লিকেট চেক করা হবে)</Label>
              <Input
                value={quickPhone}
                onChange={(e) => setQuickPhone(e.target.value)}
                placeholder="01XXXXXXXXX"
              />
              {existingQuickPhoneMatch && (
                <div className="mt-2 flex items-start justify-between gap-2 rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                  <div>
                    <div className="font-semibold">এই ফোন ইতিমধ্যে আছে</div>
                    <div>{existingQuickPhoneMatch.name} · {existingQuickPhoneMatch.phone}</div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 border-rose-300 bg-white text-rose-700 hover:bg-rose-100"
                    onClick={() => {
                      setCustomerId(existingQuickPhoneMatch.id);
                      setQuickAddOpen(false);
                      setQuickName(""); setQuickPhone(""); setQuickAddress(""); setQuickOpening(0);
                      toast.success(`কাস্টমার বাছাই: ${existingQuickPhoneMatch.name}`);
                    }}
                  >
                    এই কাস্টমার ব্যবহার
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label>ঠিকানা (ঐচ্ছিক)</Label>
              <Input
                value={quickAddress}
                onChange={(e) => setQuickAddress(e.target.value)}
                placeholder="গ্রাম / থানা / জেলা"
              />
            </div>
            <div>
              <Label>প্রারম্ভিক বকেয়া (৳)</Label>
              <Input
                type="number" min="0" step="0.01"
                value={quickOpening}
                onChange={(e) => setQuickOpening(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAddOpen(false)}>বাতিল</Button>
            <Button
              disabled={!quickName.trim() || quickAddM.isPending}
              onClick={() => quickAddM.mutate()}
              className="bg-orange-500 hover:bg-orange-600"
            >
              <UserPlus className="mr-1 h-4 w-4" /> যোগ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Checkout dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
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
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(total, Number(e.target.value) || 0));
                    setPaid(v);
                  }}
                />
                {paid > total && (
                  <div className="mt-1 text-xs text-rose-600">পরিশোধ মোটের চেয়ে বেশি হতে পারবে না</div>
                )}
                {saleType === "due" && paid >= total && total > 0 && (
                  <div className="mt-1 text-xs text-amber-600">সম্পূর্ণ পরিশোধ — 'নগদ বিক্রি' বাছাই করুন</div>
                )}
                {saleType === "installment" && paid >= total && total > 0 && (
                  <div className="mt-1 text-xs text-rose-600">কিস্তির জন্য কিছু বাকি থাকতে হবে</div>
                )}
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
                <Input type="number" min="0" max={discountBase} step="0.01" value={discount} onChange={(e) => setDiscount(clampDiscount(Number(e.target.value) || 0))} />
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
              onClick={() => submit()}
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
        sendEmailFn={sendEmailFn}
        onNewSale={() => { setSuccessOpen(false); clearCart(); barcodeRef.current?.focus(); }}
        onOpenFullReceipt={(id) => nav({ to: "/app/sales/$saleId", params: { saleId: id } })}
        onEdit={async (sale) => {
          if (!confirm("বর্তমান বিক্রয়টি বাতিল করে সম্পাদনার জন্য কার্টে ফেরত আনা হবে। চালিয়ে যাবেন?")) return;
          try {
            try { await snapshotFn({ data: { sale_id: sale.id, reason: "Edit before finalize" } }); } catch { /* non-fatal */ }
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
      <BarcodeScannerDialog open={scanOpen} onOpenChange={setScanOpen} onDetected={handleScannedCode} />
    </div>
  );
}

function SuccessDialog({
  open, onOpenChange, saleId, getSaleFn, sendSmsFn, sendEmailFn, onNewSale, onOpenFullReceipt, onEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  saleId: string | null;
  getSaleFn: (args: { data: { id: string } }) => Promise<any>;
  sendSmsFn: (args: { data: { sale_id: string; phone?: string | null; origin: string } }) => Promise<any>;
  sendEmailFn: (args: { data: { sale_id: string; email?: string | null; origin: string } }) => Promise<any>;
  onNewSale: () => void;
  onOpenFullReceipt: (id: string) => void;
  onEdit: (sale: any) => void | Promise<void>;
}) {
  const q = useQuery({
    queryKey: ["sale-share", saleId],
    queryFn: () => getSaleFn({ data: { id: saleId! } }),
    enabled: !!saleId && open,
  });
  const tplFn = useServerFn(getInvoiceTemplate);
  const tplQ = useQuery({
    queryKey: ["invoice-template"],
    queryFn: () => tplFn(),
    staleTime: 5 * 60_000,
  });
  const tpl = { ...DEFAULT_TEMPLATE, ...(tplQ.data ?? {}) } as any;
  const sale: any = q.data?.sale;
  const shop: any = q.data?.shop;
  const customer = sale?.customer;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const publicUrl = sale?.share_token ? `${origin}/i/${sale.share_token}` : "";

  const [smsPhone, setSmsPhone] = useState("");
  const [lastSmsAt, setLastSmsAt] = useState<Date | null>(null);
  const [smsSentTo, setSmsSentTo] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  const [lastEmailAt, setLastEmailAt] = useState<Date | null>(null);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  useEffect(() => {
    if (customer?.phone) setSmsPhone(customer.phone);
  }, [customer?.phone]);
  useEffect(() => {
    if (customer?.email) setEmailTo(customer.email);
  }, [customer?.email]);
  useEffect(() => {
    if (!open) { setLastSmsAt(null); setSmsSentTo(null); setLastEmailAt(null); setEmailSentTo(null); }
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
  const emailM = useMutation({
    mutationFn: () => sendEmailFn({ data: { sale_id: saleId!, email: emailTo || null, origin } }),
    onSuccess: () => {
      setLastEmailAt(new Date());
      setEmailSentTo(emailTo);
      toast.success("ইমেইল পাঠানো হয়েছে");
    },
    onError: (e: any) => toast.error(e.message ?? "ইমেইল পাঠানো যায়নি"),
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
        import("html2canvas-pro"),
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
            <InvoicePreview sale={sale} shop={shop} tpl={tpl} publicUrl={publicUrl} />

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

            <div className="print:hidden">
              <Label className="text-xs">ইমেইলে পাঠান</Label>
              <div className="mt-1 flex items-center gap-1">
                <Input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="customer@example.com"
                  className="h-9 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 shrink-0"
                  disabled={emailM.isPending || !emailTo.trim()}
                  onClick={() => emailM.mutate()}
                >
                  <Mail className="mr-1 h-4 w-4" />
                  {emailM.isPending ? "পাঠাচ্ছে..." : lastEmailAt ? "আবার" : "পাঠান"}
                </Button>
              </div>
              {emailM.isError && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                  <X className="h-3 w-3" /> {(emailM.error as any)?.message ?? "পাঠানো যায়নি"}
                </div>
              )}
              {lastEmailAt && !emailM.isPending && !emailM.isError && (
                <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-600">
                  <CheckCheck className="h-3 w-3" />
                  পাঠানো হয়েছে {emailSentTo && `→ ${emailSentTo}`} • {lastEmailAt.toLocaleTimeString("bn-BD")}
                </div>
              )}
            </div>

            {saleId && (
              <div className="print:hidden">
                <Label className="text-xs">ডেলিভারি হিস্ট্রি</Label>
                <div className="mt-1">
                  <SaleDeliveryHistory saleId={saleId} />
                </div>
              </div>
            )}
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

// InvoicePreview has been extracted to @/components/invoice-preview
