// Shared report section components. Each section is a self-contained
// panel with its own filters, data query (real DB via server fns), and
// CSV/Excel/PDF export. Used by per-report route pages under /app/reports/*.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, FileText, FileDown, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { downloadCSV, downloadExcel, downloadPDF } from "@/lib/export-utils";
import { getSalesReport, getPurchaseReport, getCashBook, getProfitReport } from "@/lib/reports.functions";
import {
  getStockReport, getStockMovementReport, getProductSalesReport, getCategorySalesReport,
  getCustomerSalesReport, getSupplierPurchaseReport, getReceivableAging, getPayableReport,
  getInstallmentReport, getSalesReturnReport, getTaxReport, getPaymentMethodReport,
  getShiftReport, getDiscountReport, getLowStockReport,
} from "@/lib/mis-reports.functions";

export const fmt = (n: number) => `৳${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;
export const today = () => new Date().toISOString().slice(0, 10);
export const monthStart = () => today().slice(0, 8) + "01";

export function ExportButtons({ name, title, headers, rows, totals }: {
  name: string; title: string; headers: string[]; rows: (string | number)[][]; totals?: (string | number)[];
}) {
  const all = totals ? [...rows, totals] : rows;
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={() => downloadCSV(name, headers, all)}>
        <FileDown className="mr-1 h-4 w-4" /> CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => downloadExcel(name, headers, all)}>
        <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
      </Button>
      <Button variant="outline" size="sm" onClick={() => downloadPDF({ name, title, headers, rows, totalsRow: totals })}>
        <FileText className="mr-1 h-4 w-4" /> PDF
      </Button>
    </div>
  );
}

export function Snap({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Card><CardContent className="p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
    <div className="mt-2 text-xl font-bold">{value}</div>
  </CardContent></Card>;
}

export function ReportTable({ loading, headers, rows, totals }: { loading: boolean; headers: string[]; rows: any[][]; totals?: any[] | null | false }) {
  return (
    <div className="rounded-lg border overflow-x-auto">
      <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-muted/50 text-left"><tr>{headers.map((h, i) => <th key={i} className={`p-3 ${i >= 2 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={headers.length} className="p-6 text-center text-muted-foreground">লোড হচ্ছে...</td></tr> :
            rows.length === 0 ? <tr><td colSpan={headers.length} className="p-6 text-center text-muted-foreground">কোনো ডেটা নেই</td></tr> :
            rows.map((r, i) => <tr key={i} className="border-t">{r.map((c, j) => <td key={j} className={`p-3 ${j >= 2 ? "text-right" : ""}`}>{c}</td>)}</tr>)}
          {totals && <tr className="border-t bg-muted font-bold">{totals.map((c, j) => <td key={j} className={`p-3 ${j >= 2 ? "text-right" : ""}`}>{c}</td>)}</tr>}
        </tbody>
      </table>
    </div>
  );
}

function DateOnly({ from, to, onChange }: { from: string; to: string; onChange: (v: { from: string; to: string }) => void }) {
  return (
    <div className="grid gap-3 sm:flex sm:items-end">
      <div><Label>শুরুর তারিখ</Label><Input type="date" value={from} onChange={e => onChange({ from: e.target.value, to })} /></div>
      <div><Label>শেষ তারিখ</Label><Input type="date" value={to} onChange={e => onChange({ from, to: e.target.value })} /></div>
    </div>
  );
}

function DateRange({ from, to, gran, onChange }: { from: string; to: string; gran: string; onChange: (v: { from: string; to: string; gran: string }) => void }) {
  return (
    <div className="grid gap-3 sm:flex sm:flex-wrap sm:items-end">
      <div><Label>শুরুর তারিখ</Label><Input type="date" value={from} onChange={e => onChange({ from: e.target.value, to, gran })} /></div>
      <div><Label>শেষ তারিখ</Label><Input type="date" value={to} onChange={e => onChange({ from, to: e.target.value, gran })} /></div>
      <div><Label>ভিউ</Label>
        <Select value={gran} onValueChange={v => onChange({ from, to, gran: v })}>
          <SelectTrigger className="w-full sm:w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="day">দৈনিক</SelectItem>
            <SelectItem value="month">মাসিক</SelectItem>
            <SelectItem value="year">বার্ষিক</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

/* ============ Sales / Purchase / Profit ============ */

export function SalesReport() {
  const fn = useServerFn(getSalesReport);
  const [f, setF] = useState({ from: monthStart(), to: today(), gran: "day" });
  const { data, isLoading } = useQuery({
    queryKey: ["rep-sales", f],
    queryFn: () => fn({ data: { from: f.from, to: f.to, granularity: f.gran as any } }),
  });
  const rows = data?.rows ?? []; const t = data?.totals;
  const headers = ["সময়", "ইনভয়েস #", "মোট বিক্রয়", "পরিশোধ", "বাকি", "নগদ", "বাকি বিক্রি", "কিস্তি"];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <DateRange from={f.from} to={f.to} gran={f.gran} onChange={setF} />
        <ExportButtons name={`sales_${f.from}_${f.to}`} title="বিক্রয় রিপোর্ট" headers={headers}
          rows={rows.map(r => [r.period, r.count, r.total, r.paid, r.due, r.cash, r.credit, r.installment])}
          totals={t ? ["মোট", t.count, t.total, t.paid, t.due, t.cash, t.credit, t.installment] : undefined} />
      </div>
      <ReportTable loading={isLoading} headers={["সময়", "ইনভয়েস #", "মোট বিক্রয়", "পরিশোধ", "বাকি", "নগদ", "বাকি বিক্রি", "কিস্তি"]}
        rows={rows.map(r => [r.period, r.count, fmt(r.total), fmt(r.paid), fmt(r.due), fmt(r.cash), fmt(r.credit), fmt(r.installment)])}
        totals={t && ["মোট", t.count, fmt(t.total), fmt(t.paid), fmt(t.due), fmt(t.cash), fmt(t.credit), fmt(t.installment)]} />
    </div>
  );
}

export function PurchaseReport() {
  const fn = useServerFn(getPurchaseReport);
  const [f, setF] = useState({ from: monthStart(), to: today(), gran: "day" });
  const { data, isLoading } = useQuery({
    queryKey: ["rep-purchase", f],
    queryFn: () => fn({ data: { from: f.from, to: f.to, granularity: f.gran as any } }),
  });
  const rows = data?.rows ?? []; const t = data?.totals;
  const headers = ["সময়", "ইনভয়েস #", "মোট ক্রয়", "পরিশোধ", "বাকি"];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <DateRange from={f.from} to={f.to} gran={f.gran} onChange={setF} />
        <ExportButtons name={`purchase_${f.from}_${f.to}`} title="ক্রয় রিপোর্ট" headers={headers}
          rows={rows.map(r => [r.period, r.count, r.total, r.paid, r.due])}
          totals={t ? ["মোট", t.count, t.total, t.paid, t.due] : undefined} />
      </div>
      <ReportTable loading={isLoading} headers={headers}
        rows={rows.map(r => [r.period, r.count, fmt(r.total), fmt(r.paid), fmt(r.due)])}
        totals={t && ["মোট", t.count, fmt(t.total), fmt(t.paid), fmt(t.due)]} />
    </div>
  );
}

export function ProfitReport() {
  const fn = useServerFn(getProfitReport);
  const [f, setF] = useState({ from: monthStart(), to: today(), gran: "day" });
  const { data, isLoading } = useQuery({
    queryKey: ["rep-profit", f],
    queryFn: () => fn({ data: { from: f.from, to: f.to, granularity: f.gran as any } }),
  });
  const rows = data?.rows ?? []; const t = data?.totals;
  const margin = (rev: number, p: number) => rev > 0 ? ((p / rev) * 100).toFixed(1) + "%" : "-";
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <DateRange from={f.from} to={f.to} gran={f.gran} onChange={setF} />
        <ExportButtons name={`profit_${f.from}_${f.to}`} title="লাভ রিপোর্ট"
          headers={["সময়", "পরিমাণ", "বিক্রয়", "খরচ", "লাভ"]}
          rows={rows.map(r => [r.period, r.qty, r.revenue, r.cost, r.profit])}
          totals={t ? ["মোট", t.qty, t.revenue, t.cost, t.profit] : undefined} />
      </div>
      <ReportTable loading={isLoading}
        headers={["সময়", "পরিমাণ", "বিক্রয়", "ক্রয়-খরচ", "লাভ", "মার্জিন"]}
        rows={rows.map(r => [r.period, r.qty, fmt(r.revenue), fmt(r.cost), fmt(r.profit), margin(r.revenue, r.profit)])}
        totals={t && ["মোট", t.qty, fmt(t.revenue), fmt(t.cost), fmt(t.profit), margin(t.revenue, t.profit)]} />
      {t && t.cost === 0 && t.revenue > 0 && (
        <p className="text-xs text-amber-600">⚠ কিছু পণ্যের ক্রয়মূল্য নেই — সঠিক লাভ পেতে পণ্যে ক্রয়মূল্য সেট করুন।</p>
      )}
    </div>
  );
}

/* ============ Product / Category / Customer / Supplier ============ */

export function ProductSalesReport() {
  const fn = useServerFn(getProductSalesReport);
  const [f, setF] = useState({ from: monthStart(), to: today() });
  const { data, isLoading } = useQuery({ queryKey: ["rep-prod-sales", f], queryFn: () => fn({ data: f }) });
  const rows = data?.rows ?? []; const t = data?.totals;
  const headers = ["পণ্য", "SKU", "ক্যাটাগরি", "পরিমাণ", "বিক্রয়", "খরচ", "ডিসকাউন্ট", "ট্যাক্স", "লাভ"];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <DateOnly from={f.from} to={f.to} onChange={setF} />
        <ExportButtons name={`product_sales_${f.from}_${f.to}`} title="প্রোডাক্ট বিক্রয় রিপোর্ট" headers={headers}
          rows={rows.map(r => [r.product, r.sku, r.category, r.qty, r.revenue, r.cost, r.discount, r.tax, r.profit])}
          totals={t ? ["মোট", "", "", t.qty, t.revenue, t.cost, t.discount, t.tax, t.profit] : undefined} />
      </div>
      <ReportTable loading={isLoading} headers={headers}
        rows={rows.map(r => [r.product, r.sku, r.category, r.qty, fmt(r.revenue), fmt(r.cost), fmt(r.discount), fmt(r.tax), fmt(r.profit)])}
        totals={t && ["মোট", "", "", t.qty, fmt(t.revenue), fmt(t.cost), fmt(t.discount), fmt(t.tax), fmt(t.profit)]} />
    </div>
  );
}

export function CategorySalesReport() {
  const fn = useServerFn(getCategorySalesReport);
  const [f, setF] = useState({ from: monthStart(), to: today() });
  const { data, isLoading } = useQuery({ queryKey: ["rep-cat-sales", f], queryFn: () => fn({ data: f }) });
  const rows = data?.rows ?? []; const t = data?.totals;
  const headers = ["ক্যাটাগরি", "পরিমাণ", "বিক্রয়", "খরচ", "লাভ"];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <DateOnly from={f.from} to={f.to} onChange={setF} />
        <ExportButtons name={`category_sales_${f.from}_${f.to}`} title="ক্যাটাগরি বিক্রয়" headers={headers}
          rows={rows.map(r => [r.category, r.qty, r.revenue, r.cost, r.profit])}
          totals={t ? ["মোট", t.qty, t.revenue, t.cost, t.profit] : undefined} />
      </div>
      <ReportTable loading={isLoading} headers={headers}
        rows={rows.map(r => [r.category, r.qty, fmt(r.revenue), fmt(r.cost), fmt(r.profit)])}
        totals={t && ["মোট", t.qty, fmt(t.revenue), fmt(t.cost), fmt(t.profit)]} />
    </div>
  );
}

export function CustomerSalesReport() {
  const fn = useServerFn(getCustomerSalesReport);
  const [f, setF] = useState({ from: monthStart(), to: today() });
  const { data, isLoading } = useQuery({ queryKey: ["rep-cust-sales", f], queryFn: () => fn({ data: f }) });
  const rows = data?.rows ?? []; const t = data?.totals;
  const headers = ["কাস্টমার", "ফোন", "ইনভয়েস", "মোট", "পরিশোধ", "বাকি"];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <DateOnly from={f.from} to={f.to} onChange={setF} />
        <ExportButtons name={`customer_sales_${f.from}_${f.to}`} title="কাস্টমার বিক্রয়" headers={headers}
          rows={rows.map(r => [r.name, r.phone, r.invoices, r.total, r.paid, r.due])}
          totals={t ? ["মোট", "", t.invoices, t.total, t.paid, t.due] : undefined} />
      </div>
      <ReportTable loading={isLoading} headers={headers}
        rows={rows.map(r => [r.name, r.phone, r.invoices, fmt(r.total), fmt(r.paid), fmt(r.due)])}
        totals={t && ["মোট", "", t.invoices, fmt(t.total), fmt(t.paid), fmt(t.due)]} />
    </div>
  );
}

export function SupplierPurchaseReport() {
  const fn = useServerFn(getSupplierPurchaseReport);
  const [f, setF] = useState({ from: monthStart(), to: today() });
  const { data, isLoading } = useQuery({ queryKey: ["rep-supp-buy", f], queryFn: () => fn({ data: f }) });
  const rows = data?.rows ?? []; const t = data?.totals;
  const headers = ["সাপ্লায়ার", "ফোন", "ইনভয়েস", "মোট", "পরিশোধ", "বাকি"];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <DateOnly from={f.from} to={f.to} onChange={setF} />
        <ExportButtons name={`supplier_purchase_${f.from}_${f.to}`} title="সাপ্লায়ার ক্রয়" headers={headers}
          rows={rows.map(r => [r.name, r.phone, r.invoices, r.total, r.paid, r.due])}
          totals={t ? ["মোট", "", t.invoices, t.total, t.paid, t.due] : undefined} />
      </div>
      <ReportTable loading={isLoading} headers={headers}
        rows={rows.map(r => [r.name, r.phone, r.invoices, fmt(r.total), fmt(r.paid), fmt(r.due)])}
        totals={t && ["মোট", "", t.invoices, fmt(t.total), fmt(t.paid), fmt(t.due)]} />
    </div>
  );
}

/* ============ Stock ============ */

export function StockReport() {
  const fn = useServerFn(getStockReport);
  const { data, isLoading } = useQuery({ queryKey: ["rep-stock"], queryFn: () => fn() });
  const rows = data?.rows ?? []; const t = data?.totals;
  const headers = ["পণ্য", "SKU", "ক্যাটাগরি", "একক", "স্টক", "ক্রয় মূল্য", "বিক্রয় মূল্য", "সম্ভাব্য লাভ", "স্ট্যাটাস"];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="grid gap-3 sm:grid-cols-3 flex-1">
          <Snap icon={<Wallet className="h-5 w-5" />} label="মোট ক্রয় মূল্য" value={fmt(t?.cost_value ?? 0)} />
          <Snap icon={<Wallet className="h-5 w-5 text-emerald-600" />} label="মোট বিক্রয় মূল্য" value={fmt(t?.retail_value ?? 0)} />
          <Snap icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} label="সম্ভাব্য লাভ" value={fmt(t?.potential_profit ?? 0)} />
        </div>
        <ExportButtons name="stock_report" title="স্টক রিপোর্ট" headers={headers}
          rows={rows.map(r => [r.name, r.sku, r.category, r.unit, r.qty, r.cost_value, r.retail_value, r.potential_profit, r.dead ? "আউট" : r.low ? "লো" : "ঠিক"])}
          totals={t ? ["মোট", "", "", "", t.qty, t.cost_value, t.retail_value, t.potential_profit, ""] : undefined} />
      </div>
      <ReportTable loading={isLoading} headers={headers}
        rows={rows.map(r => [r.name, r.sku, r.category, r.unit, r.qty, fmt(r.cost_value), fmt(r.retail_value), fmt(r.potential_profit),
          r.dead ? <Badge variant="destructive">আউট</Badge> : r.low ? <Badge className="bg-amber-500">লো</Badge> : <Badge variant="secondary">ঠিক</Badge>])}
        totals={t && ["মোট", "", "", "", t.qty, fmt(t.cost_value), fmt(t.retail_value), fmt(t.potential_profit), ""]} />
    </div>
  );
}

export function StockMovementReport() {
  const fn = useServerFn(getStockMovementReport);
  const [f, setF] = useState({ from: monthStart(), to: today() });
  const { data, isLoading } = useQuery({ queryKey: ["rep-stock-move", f], queryFn: () => fn({ data: f }) });
  const rows = data ?? [];
  const headers = ["তারিখ", "পণ্য", "একক", "টাইপ", "পরিমাণ", "ক্রয় মূল্য", "ভ্যালু", "রেফ", "নোট"];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <DateOnly from={f.from} to={f.to} onChange={setF} />
        <ExportButtons name={`stock_movement_${f.from}_${f.to}`} title="স্টক মুভমেন্ট" headers={headers}
          rows={rows.map(r => [r.date, r.product, r.unit, r.type, r.qty, r.cost, r.value, r.ref, r.note])} />
      </div>
      <ReportTable loading={isLoading} headers={headers}
        rows={rows.map(r => [r.date, r.product, r.unit, <Badge variant="outline">{r.type}</Badge>, r.qty, fmt(r.cost), fmt(r.value), r.ref, r.note])} />
    </div>
  );
}

export function LowStockReport() {
  const fn = useServerFn(getLowStockReport);
  const { data, isLoading } = useQuery({ queryKey: ["rep-low-stock"], queryFn: () => fn() });
  const low = data?.low ?? []; const out = data?.out ?? [];
  const headers = ["পণ্য", "SKU", "ক্যাটাগরি", "স্টক", "অ্যালার্ট", "একক", "ক্রয় মূল্য", "ভ্যালু"];
  const mkRows = (arr: any[]) => arr.map(r => [r.name, r.sku, r.category, r.qty, r.alert, r.unit, r.cost, r.value]);
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-lg font-semibold">আউট অফ স্টক <Badge variant="destructive" className="ml-2">{out.length}</Badge></h3>
          <ExportButtons name="out_of_stock" title="আউট অফ স্টক" headers={headers} rows={mkRows(out)} />
        </div>
        <ReportTable loading={isLoading} headers={headers}
          rows={out.map(r => [r.name, r.sku, r.category, r.qty, r.alert, r.unit, fmt(r.cost), fmt(r.value)])} />
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h3 className="text-lg font-semibold">লো স্টক <Badge className="ml-2 bg-amber-500">{low.length}</Badge></h3>
          <ExportButtons name="low_stock" title="লো স্টক" headers={headers} rows={mkRows(low)} />
        </div>
        <ReportTable loading={isLoading} headers={headers}
          rows={low.map(r => [r.name, r.sku, r.category, r.qty, r.alert, r.unit, fmt(r.cost), fmt(r.value)])} />
      </section>
    </div>
  );
}

/* ============ Aging / Payable / Installment / Return ============ */

export function ReceivableReport() {
  const fn = useServerFn(getReceivableAging);
  const { data, isLoading } = useQuery({ queryKey: ["rep-ar"], queryFn: () => fn() });
  const rows = data?.rows ?? []; const t = data?.totals;
  const headers = ["কাস্টমার", "ফোন", "মোট বাকি", "০-৩০ দিন", "৩১-৬০", "৬১-৯০", "৯১-১৮০", "১৮০+"];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-end gap-3 flex-wrap">
        <ExportButtons name="receivable_aging" title="কাস্টমার বাকি — Aging" headers={headers}
          rows={rows.map(r => [r.name, r.phone, r.balance, r.current, r.d30, r.d60, r.d90, r.over])}
          totals={t ? ["মোট", "", t.balance, t.current, t.d30, t.d60, t.d90, t.over] : undefined} />
      </div>
      <ReportTable loading={isLoading} headers={headers}
        rows={rows.map(r => [r.name, r.phone, fmt(r.balance), fmt(r.current), fmt(r.d30), fmt(r.d60), fmt(r.d90), fmt(r.over)])}
        totals={t && ["মোট", "", fmt(t.balance), fmt(t.current), fmt(t.d30), fmt(t.d60), fmt(t.d90), fmt(t.over)]} />
    </div>
  );
}

export function PayableReport() {
  const fn = useServerFn(getPayableReport);
  const { data, isLoading } = useQuery({ queryKey: ["rep-ap"], queryFn: () => fn() });
  const rows = data?.rows ?? [];
  const headers = ["সাপ্লায়ার", "ফোন", "বাকি"];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-end gap-3 flex-wrap">
        <ExportButtons name="payable" title="সাপ্লায়ার বাকি" headers={headers}
          rows={rows.map(r => [r.name, r.phone, r.balance])}
          totals={["মোট", "", data?.total ?? 0]} />
      </div>
      <ReportTable loading={isLoading} headers={headers}
        rows={rows.map(r => [r.name, r.phone, fmt(r.balance)])}
        totals={["মোট", "", fmt(data?.total ?? 0)]} />
    </div>
  );
}

export function InstallmentReport() {
  const fn = useServerFn(getInstallmentReport);
  const { data, isLoading } = useQuery({ queryKey: ["rep-inst"], queryFn: () => fn() });
  const rows = data?.rows ?? []; const t = data?.totals;
  const headers = ["ইনভয়েস", "কাস্টমার", "ফোন", "কিস্তি #", "শেষ তারিখ", "পরিমাণ", "পরিশোধ", "বাকি", "স্ট্যাটাস"];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-end gap-3 flex-wrap">
        <ExportButtons name="installments_due" title="কিস্তি বকেয়া" headers={headers}
          rows={rows.map(r => [r.invoice, r.customer, r.phone, r.no, r.due_date, r.amount, r.paid, r.remaining, r.overdue ? "ওভারডিউ" : r.status])}
          totals={t ? ["মোট", "", "", "", "", t.amount, t.paid, t.remaining, `ওভারডিউ ${fmt(t.overdue)}`] : undefined} />
      </div>
      <ReportTable loading={isLoading} headers={headers}
        rows={rows.map(r => [r.invoice, r.customer, r.phone, r.no, r.due_date, fmt(r.amount), fmt(r.paid), fmt(r.remaining),
          r.overdue ? <Badge variant="destructive">ওভারডিউ</Badge> : <Badge variant="secondary">{r.status}</Badge>])}
        totals={t && ["মোট", "", "", "", "", fmt(t.amount), fmt(t.paid), fmt(t.remaining), `ওভারডিউ ${fmt(t.overdue)}`]} />
    </div>
  );
}

export function SalesReturnReport() {
  const fn = useServerFn(getSalesReturnReport);
  const [f, setF] = useState({ from: monthStart(), to: today() });
  const { data, isLoading } = useQuery({ queryKey: ["rep-return", f], queryFn: () => fn({ data: f }) });
  const rows = data?.rows ?? []; const t = data?.totals;
  const headers = ["তারিখ", "ইনভয়েস", "কাস্টমার", "আইটেম", "আইটেম ভ্যালু", "রিফান্ড", "মেথড", "কারণ"];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <DateOnly from={f.from} to={f.to} onChange={setF} />
        <ExportButtons name={`sales_return_${f.from}_${f.to}`} title="সেল রিটার্ন" headers={headers}
          rows={rows.map(r => [r.date, r.invoice, r.customer, r.items, r.item_value, r.refund, r.method, r.reason])}
          totals={t ? ["মোট", `${t.count} টি`, "", "", t.item_value, t.refund, "", ""] : undefined} />
      </div>
      <ReportTable loading={isLoading} headers={headers}
        rows={rows.map(r => [r.date, r.invoice, r.customer, r.items, fmt(r.item_value), fmt(r.refund), r.method, r.reason])}
        totals={t && ["মোট", `${t.count} টি`, "", "", fmt(t.item_value), fmt(t.refund), "", ""]} />
    </div>
  );
}

/* ============ Tax / Discount / Payment / Shift ============ */

export function TaxReport() {
  const fn = useServerFn(getTaxReport);
  const [f, setF] = useState({ from: monthStart(), to: today() });
  const { data, isLoading } = useQuery({ queryKey: ["rep-tax", f], queryFn: () => fn({ data: f }) });
  const rows = data?.rows ?? []; const t = data?.totals;
  const headers = ["তারিখ", "ইনভয়েস", "কাস্টমার", "সাব-টোটাল", "ডিসকাউন্ট", "ট্যাক্স", "মোট"];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <DateOnly from={f.from} to={f.to} onChange={setF} />
        <ExportButtons name={`tax_${f.from}_${f.to}`} title="ভ্যাট/ট্যাক্স রিপোর্ট" headers={headers}
          rows={rows.map(r => [r.date, r.invoice, r.customer, r.subtotal, r.discount, r.tax, r.total])}
          totals={t ? ["মোট", `${t.count} টি`, "", t.subtotal, t.discount, t.tax, t.total] : undefined} />
      </div>
      <ReportTable loading={isLoading} headers={headers}
        rows={rows.map(r => [r.date, r.invoice, r.customer, fmt(r.subtotal), fmt(r.discount), fmt(r.tax), fmt(r.total)])}
        totals={t && ["মোট", `${t.count} টি`, "", fmt(t.subtotal), fmt(t.discount), fmt(t.tax), fmt(t.total)]} />
    </div>
  );
}

export function DiscountReport() {
  const fn = useServerFn(getDiscountReport);
  const [f, setF] = useState({ from: monthStart(), to: today() });
  const { data, isLoading } = useQuery({ queryKey: ["rep-disc", f], queryFn: () => fn({ data: f }) });
  const rows = data?.rows ?? []; const t = data?.totals;
  const headers = ["তারিখ", "ইনভয়েস", "কাস্টমার", "সাব-টোটাল", "ডিসকাউন্ট", "%", "মোট"];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <DateOnly from={f.from} to={f.to} onChange={setF} />
        <ExportButtons name={`discount_${f.from}_${f.to}`} title="ডিসকাউন্ট রিপোর্ট" headers={headers}
          rows={rows.map(r => [r.date, r.invoice, r.customer, r.subtotal, r.discount, r.pct.toFixed(1), r.total])}
          totals={t ? ["মোট", `${t.count} টি`, "", t.subtotal, t.discount, "", t.total] : undefined} />
      </div>
      <ReportTable loading={isLoading} headers={headers}
        rows={rows.map(r => [r.date, r.invoice, r.customer, fmt(r.subtotal), fmt(r.discount), `${r.pct.toFixed(1)}%`, fmt(r.total)])}
        totals={t && ["মোট", `${t.count} টি`, "", fmt(t.subtotal), fmt(t.discount), "", fmt(t.total)]} />
    </div>
  );
}

export function PaymentMethodReport() {
  const fn = useServerFn(getPaymentMethodReport);
  const [f, setF] = useState({ from: monthStart(), to: today() });
  const { data, isLoading } = useQuery({ queryKey: ["rep-pm", f], queryFn: () => fn({ data: f }) });
  const rows = data?.rows ?? []; const t = data?.totals;
  const headers = ["মেথড", "আসা", "যাওয়া", "নেট"];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <DateOnly from={f.from} to={f.to} onChange={setF} />
        <ExportButtons name={`payment_methods_${f.from}_${f.to}`} title="পেমেন্ট মেথড" headers={headers}
          rows={rows.map(r => [r.method, r.inflow, r.outflow, r.net])}
          totals={t ? ["মোট", t.inflow, t.outflow, t.net] : undefined} />
      </div>
      <ReportTable loading={isLoading} headers={headers}
        rows={rows.map(r => [r.method, fmt(r.inflow), fmt(r.outflow), fmt(r.net)])}
        totals={t && ["মোট", fmt(t.inflow), fmt(t.outflow), fmt(t.net)]} />
    </div>
  );
}

export function ShiftReport() {
  const fn = useServerFn(getShiftReport);
  const [f, setF] = useState({ from: monthStart(), to: today() });
  const { data, isLoading } = useQuery({ queryKey: ["rep-shift", f], queryFn: () => fn({ data: f }) });
  const rows = data?.rows ?? []; const t = data?.totals;
  const headers = ["ওপেন", "ক্লোজ", "স্ট্যাটাস", "ওপেনিং", "নগদ", "কার্ড", "bKash", "ব্যাংক", "অন্য", "মোট", "সংখ্যা", "এক্সপেক্টেড", "একচুয়াল", "ভ্যারিয়েন্স"];
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <DateOnly from={f.from} to={f.to} onChange={setF} />
        <ExportButtons name={`shifts_${f.from}_${f.to}`} title="শিফট রিপোর্ট" headers={headers}
          rows={rows.map(r => [r.opened, r.closed, r.status, r.opening, r.cash, r.card, r.bkash, r.bank, r.other, r.total, r.count, r.expected, r.actual, r.variance])}
          totals={t ? ["মোট", "", "", t.opening, t.cash, t.card, t.bkash, t.bank, t.other, t.total, t.count, "", "", t.variance] : undefined} />
      </div>
      <ReportTable loading={isLoading} headers={headers}
        rows={rows.map(r => [r.opened, r.closed, <Badge variant={r.status === "open" ? "default" : "secondary"}>{r.status}</Badge>, fmt(r.opening), fmt(r.cash), fmt(r.card), fmt(r.bkash), fmt(r.bank), fmt(r.other), fmt(r.total), r.count, fmt(r.expected), fmt(r.actual), fmt(r.variance)])}
        totals={t && ["মোট", "", "", fmt(t.opening), fmt(t.cash), fmt(t.card), fmt(t.bkash), fmt(t.bank), fmt(t.other), fmt(t.total), t.count, "", "", fmt(t.variance)]} />
    </div>
  );
}

/* ============ Cash / bKash books ============ */

export function CashBook({ method, title }: { method: "cash" | "bkash"; title: string }) {
  const fn = useServerFn(getCashBook);
  const [f, setF] = useState({ from: monthStart(), to: today() });
  const { data, isLoading } = useQuery({ queryKey: ["cashbook", method, f], queryFn: () => fn({ data: { from: f.from, to: f.to, method } }) });
  const entries = data?.entries ?? []; const t = data?.totals;
  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div className="grid gap-3 sm:flex sm:items-end">
          <div><Label>শুরুর তারিখ</Label><Input type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></div>
          <div><Label>শেষ তারিখ</Label><Input type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></div>
        </div>
        <ExportButtons name={`${method}_book_${f.from}_${f.to}`} title={title}
          headers={["তারিখ", "ধরন", "উৎস", "পক্ষ", "রেফ", "নোট", "আসা", "যাওয়া", "ব্যালেন্স"]}
          rows={entries.map((e: any) => [e.date, e.type === "in" ? "আসা" : "যাওয়া", e.source, e.party, e.ref, e.note, e.type === "in" ? e.amount : "", e.type === "out" ? e.amount : "", e.running])} />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Snap icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} label="মোট আসা" value={fmt(t?.in ?? 0)} />
        <Snap icon={<TrendingDown className="h-5 w-5 text-destructive" />} label="মোট যাওয়া" value={fmt(t?.out ?? 0)} />
        <Snap icon={<Wallet className="h-5 w-5" />} label="নেট" value={fmt(data?.net ?? 0)} />
      </div>
      <div className="rounded-lg border overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-muted/50 text-left"><tr>
            <th className="p-2">তারিখ</th><th className="p-2">উৎস</th><th className="p-2">পক্ষ</th>
            <th className="p-2">রেফ</th><th className="p-2 text-right">আসা</th>
            <th className="p-2 text-right">যাওয়া</th><th className="p-2 text-right">ব্যালেন্স</th>
          </tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">লোড হচ্ছে...</td></tr> :
              entries.length === 0 ? <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">কোনো এন্ট্রি নেই</td></tr> :
              entries.map((e: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="p-2 whitespace-nowrap">{e.date}</td>
                  <td className="p-2"><Badge variant={e.type === "in" ? "default" : "secondary"}>{e.source}</Badge></td>
                  <td className="p-2">{e.party}</td>
                  <td className="p-2 text-xs text-muted-foreground">{e.ref}</td>
                  <td className="p-2 text-right text-emerald-600">{e.type === "in" ? fmt(e.amount) : "-"}</td>
                  <td className="p-2 text-right text-destructive">{e.type === "out" ? fmt(e.amount) : "-"}</td>
                  <td className="p-2 text-right font-semibold">{fmt(e.running)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}