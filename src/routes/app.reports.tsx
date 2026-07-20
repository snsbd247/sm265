import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSalesReport, getPurchaseReport, getCashBook, getProfitReport, getReportSnapshot } from "@/lib/reports.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { FileSpreadsheet, FileText, FileDown, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { downloadCSV, downloadExcel, downloadPDF } from "@/lib/export-utils";

export const Route = createFileRoute("/app/reports")({ component: Page });

const fmt = (n: number) => `৳${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => today().slice(0, 8) + "01";

function ExportButtons({ name, title, headers, rows, totals }: {
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

function Page() {
  const snapFn = useServerFn(getReportSnapshot);
  const { data: snap } = useQuery({ queryKey: ["report-snap"], queryFn: () => snapFn() });

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold sm:text-2xl">রিপোর্ট</h1>
        <p className="text-sm text-muted-foreground">বিক্রয়, ক্রয়, ক্যাশ বই, লাভ</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Snap icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} label="আজকের বিক্রয়" value={fmt(snap?.sales_today ?? 0)} />
        <Snap icon={<TrendingUp className="h-5 w-5" />} label="এ মাসের বিক্রয়" value={fmt(snap?.sales_month ?? 0)} />
        <Snap icon={<TrendingDown className="h-5 w-5 text-amber-600" />} label="এ মাসের ক্রয়" value={fmt(snap?.purchase_month ?? 0)} />
        <Snap icon={<Wallet className="h-5 w-5 text-destructive" />} label="কাস্টমার বাকি" value={fmt(snap?.customer_due ?? 0)} />
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="h-auto max-w-full justify-start overflow-x-auto p-1">
          <TabsTrigger value="sales">বিক্রয়</TabsTrigger>
          <TabsTrigger value="purchase">ক্রয়</TabsTrigger>
          <TabsTrigger value="profit">লাভ</TabsTrigger>
          <TabsTrigger value="cash">ক্যাশ বই</TabsTrigger>
          <TabsTrigger value="bkash">bKash বই</TabsTrigger>
        </TabsList>

        <TabsContent value="sales"><SalesReport /></TabsContent>
        <TabsContent value="purchase"><PurchaseReport /></TabsContent>
        <TabsContent value="profit"><ProfitReport /></TabsContent>
        <TabsContent value="cash"><CashBook method="cash" title="ক্যাশ বই (নগদ)" /></TabsContent>
        <TabsContent value="bkash"><CashBook method="bkash" title="bKash বই" /></TabsContent>
      </Tabs>
    </div>
  );
}

function Snap({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Card><CardContent className="p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
    <div className="mt-2 text-xl font-bold">{value}</div>
  </CardContent></Card>;
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

function SalesReport() {
  const fn = useServerFn(getSalesReport);
  const [f, setF] = useState({ from: monthStart(), to: today(), gran: "day" });
  const { data, isLoading } = useQuery({
    queryKey: ["rep-sales", f],
    queryFn: () => fn({ data: { from: f.from, to: f.to, granularity: f.gran as any } }),
  });
  const rows = data?.rows ?? []; const t = data?.totals;
  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <DateRange from={f.from} to={f.to} gran={f.gran} onChange={setF} />
        <ExportButtons name={`sales_${f.from}_${f.to}`} title="বিক্রয় রিপোর্ট"
          headers={["সময়", "ইনভয়েস #", "মোট বিক্রয়", "পরিশোধ", "বাকি", "নগদ", "বাকি বিক্রি", "কিস্তি"]}
          rows={rows.map(r => [r.period, r.count, r.total, r.paid, r.due, r.cash, r.credit, r.installment])}
          totals={t ? ["মোট", t.count, t.total, t.paid, t.due, t.cash, t.credit, t.installment] : undefined} />
      </div>
      <ReportTable
        loading={isLoading}
        headers={["সময়", "ইনভয়েস #", "মোট বিক্রয়", "পরিশোধ", "বাকি", "নগদ", "বাকি বিক্রি", "কিস্তি"]}
        rows={rows.map(r => [r.period, r.count, fmt(r.total), fmt(r.paid), fmt(r.due), fmt(r.cash), fmt(r.credit), fmt(r.installment)])}
        totals={t && [`মোট`, t.count, fmt(t.total), fmt(t.paid), fmt(t.due), fmt(t.cash), fmt(t.credit), fmt(t.installment)]}
      />
    </div>
  );
}

function PurchaseReport() {
  const fn = useServerFn(getPurchaseReport);
  const [f, setF] = useState({ from: monthStart(), to: today(), gran: "day" });
  const { data, isLoading } = useQuery({
    queryKey: ["rep-purchase", f],
    queryFn: () => fn({ data: { from: f.from, to: f.to, granularity: f.gran as any } }),
  });
  const rows = data?.rows ?? []; const t = data?.totals;
  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <DateRange from={f.from} to={f.to} gran={f.gran} onChange={setF} />
        <ExportButtons name={`purchase_${f.from}_${f.to}`} title="ক্রয় রিপোর্ট"
          headers={["সময়", "ইনভয়েস #", "মোট ক্রয়", "পরিশোধ", "বাকি"]}
          rows={rows.map(r => [r.period, r.count, r.total, r.paid, r.due])}
          totals={t ? ["মোট", t.count, t.total, t.paid, t.due] : undefined} />
      </div>
      <ReportTable
        loading={isLoading}
        headers={["সময়", "ইনভয়েস #", "মোট ক্রয়", "পরিশোধ", "বাকি"]}
        rows={rows.map(r => [r.period, r.count, fmt(r.total), fmt(r.paid), fmt(r.due)])}
        totals={t && [`মোট`, t.count, fmt(t.total), fmt(t.paid), fmt(t.due)]}
      />
    </div>
  );
}

function ProfitReport() {
  const fn = useServerFn(getProfitReport);
  const [f, setF] = useState({ from: monthStart(), to: today(), gran: "day" });
  const { data, isLoading } = useQuery({
    queryKey: ["rep-profit", f],
    queryFn: () => fn({ data: { from: f.from, to: f.to, granularity: f.gran as any } }),
  });
  const rows = data?.rows ?? []; const t = data?.totals;
  const margin = (rev: number, p: number) => rev > 0 ? ((p / rev) * 100).toFixed(1) + "%" : "-";
  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <DateRange from={f.from} to={f.to} gran={f.gran} onChange={setF} />
        <ExportButtons name={`profit_${f.from}_${f.to}`} title="লাভ রিপোর্ট"
          headers={["সময়", "পরিমাণ", "বিক্রয়", "খরচ", "লাভ"]}
          rows={rows.map(r => [r.period, r.qty, r.revenue, r.cost, r.profit])}
          totals={t ? ["মোট", t.qty, t.revenue, t.cost, t.profit] : undefined} />
      </div>
      <ReportTable
        loading={isLoading}
        headers={["সময়", "পরিমাণ", "বিক্রয়", "ক্রয়-খরচ", "লাভ", "মার্জিন"]}
        rows={rows.map(r => [r.period, r.qty, fmt(r.revenue), fmt(r.cost), fmt(r.profit), margin(r.revenue, r.profit)])}
        totals={t && ["মোট", t.qty, fmt(t.revenue), fmt(t.cost), fmt(t.profit), margin(t.revenue, t.profit)]}
      />
      {t && t.cost === 0 && t.revenue > 0 && (
        <p className="text-xs text-amber-600">⚠ কিছু পণ্যের ক্রয়মূল্য নেই — সঠিক লাভ পেতে পণ্যে ক্রয়মূল্য সেট করুন।</p>
      )}
    </div>
  );
}

function CashBook({ method, title }: { method: "cash" | "bkash"; title: string }) {
  const fn = useServerFn(getCashBook);
  const [f, setF] = useState({ from: monthStart(), to: today() });
  const { data, isLoading } = useQuery({
    queryKey: ["cashbook", method, f],
    queryFn: () => fn({ data: { from: f.from, to: f.to, method } }),
  });
  const entries = data?.entries ?? []; const t = data?.totals;
  return (
    <div className="space-y-4 pt-4">
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

function ReportTable({ loading, headers, rows, totals }: { loading: boolean; headers: string[]; rows: any[][]; totals?: any[] | null | false }) {
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
