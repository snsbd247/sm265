import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getReportSnapshot } from "@/lib/reports.functions";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp, TrendingDown, Wallet, ShoppingCart, Package, BarChart3,
  Users, Truck, Boxes, ArrowUpDown, AlertTriangle, Clock, Undo2,
  Receipt, Percent, CreditCard, Timer, Banknote, Smartphone, PieChart,
} from "lucide-react";

export const Route = createFileRoute("/app/reports/")({
  component: Hub,
  head: () => ({ meta: [
    { title: "রিপোর্ট হাব — Tally BD" },
    { name: "description", content: "বিক্রয়, ক্রয়, স্টক, লাভ, বাকি, ট্যাক্স, শিফট সহ সব MIS রিপোর্ট" },
    { property: "og:title", content: "রিপোর্ট হাব — Tally BD" },
    { property: "og:description", content: "সম্পূর্ণ ব্যবসায়িক MIS রিপোর্ট এক জায়গায়" },
  ] }),
});

const fmt = (n: number) => `৳${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;

type ReportItem = { to: string; title: string; desc: string; icon: React.ReactNode; color: string };

const groups: { name: string; items: ReportItem[] }[] = [
  { name: "বিক্রয় ও লাভ", items: [
    { to: "/app/reports/sales", title: "বিক্রয় রিপোর্ট", desc: "দৈনিক/মাসিক বিক্রয় সারাংশ", icon: <ShoppingCart className="h-5 w-5" />, color: "text-emerald-600" },
    { to: "/app/reports/purchase", title: "ক্রয় রিপোর্ট", desc: "দৈনিক/মাসিক ক্রয় সারাংশ", icon: <Package className="h-5 w-5" />, color: "text-blue-600" },
    { to: "/app/reports/profit", title: "লাভ রিপোর্ট", desc: "গ্রস প্রফিট ও মার্জিন", icon: <BarChart3 className="h-5 w-5" />, color: "text-emerald-600" },
  ]},
  { name: "প্রোডাক্ট / পার্টি", items: [
    { to: "/app/reports/product-sales", title: "প্রোডাক্ট বিক্রয়", desc: "প্রতিটি পণ্যের বিক্রয় ও লাভ", icon: <Package className="h-5 w-5" />, color: "text-indigo-600" },
    { to: "/app/reports/category-sales", title: "ক্যাটাগরি বিক্রয়", desc: "ক্যাটাগরি অনুযায়ী বিক্রয়", icon: <PieChart className="h-5 w-5" />, color: "text-purple-600" },
    { to: "/app/reports/customer-sales", title: "কাস্টমার বিক্রয়", desc: "কাস্টমার ভিত্তিক বিক্রয়", icon: <Users className="h-5 w-5" />, color: "text-teal-600" },
    { to: "/app/reports/supplier-purchase", title: "সাপ্লায়ার ক্রয়", desc: "সাপ্লায়ার ভিত্তিক ক্রয়", icon: <Truck className="h-5 w-5" />, color: "text-cyan-600" },
  ]},
  { name: "স্টক / ইনভেন্টরি", items: [
    { to: "/app/reports/stock", title: "স্টক ভ্যালুয়েশন", desc: "ক্রয়/বিক্রয় মূল্যে স্টক", icon: <Boxes className="h-5 w-5" />, color: "text-amber-600" },
    { to: "/app/reports/stock-movement", title: "স্টক মুভমেন্ট", desc: "ইন/আউট হিস্টরি", icon: <ArrowUpDown className="h-5 w-5" />, color: "text-orange-600" },
    { to: "/app/reports/low-stock", title: "লো/আউট স্টক", desc: "রি-অর্ডার প্রয়োজন", icon: <AlertTriangle className="h-5 w-5" />, color: "text-red-600" },
  ]},
  { name: "বাকি ও কিস্তি", items: [
    { to: "/app/reports/receivable", title: "কাস্টমার Aging", desc: "০-৩০/৬০/৯০/১৮০+ দিন", icon: <Wallet className="h-5 w-5" />, color: "text-rose-600" },
    { to: "/app/reports/payable", title: "সাপ্লায়ার বাকি", desc: "পেয়েবল ব্যালেন্স", icon: <Wallet className="h-5 w-5" />, color: "text-fuchsia-600" },
    { to: "/app/reports/installment", title: "কিস্তি বকেয়া", desc: "ওভারডিউসহ শিডিউল", icon: <Clock className="h-5 w-5" />, color: "text-amber-600" },
    { to: "/app/reports/sales-return", title: "সেল রিটার্ন", desc: "রিফান্ড ও রিটার্ন ইতিহাস", icon: <Undo2 className="h-5 w-5" />, color: "text-slate-600" },
  ]},
  { name: "ট্যাক্স / পেমেন্ট / শিফট", items: [
    { to: "/app/reports/tax", title: "ভ্যাট/ট্যাক্স", desc: "ট্যাক্সেবল ইনভয়েস", icon: <Receipt className="h-5 w-5" />, color: "text-blue-600" },
    { to: "/app/reports/discount", title: "ডিসকাউন্ট", desc: "ডিসকাউন্টেড বিক্রয়", icon: <Percent className="h-5 w-5" />, color: "text-pink-600" },
    { to: "/app/reports/payment-method", title: "পেমেন্ট মেথড", desc: "মেথড ভিত্তিক ইন/আউট", icon: <CreditCard className="h-5 w-5" />, color: "text-indigo-600" },
    { to: "/app/reports/shift", title: "শিফট রিপোর্ট", desc: "POS শিফট ও ভ্যারিয়েন্স", icon: <Timer className="h-5 w-5" />, color: "text-emerald-600" },
  ]},
  { name: "ক্যাশ বই", items: [
    { to: "/app/reports/cash-book", title: "ক্যাশ বই", desc: "নগদ আসা/যাওয়া", icon: <Banknote className="h-5 w-5" />, color: "text-emerald-600" },
    { to: "/app/reports/bkash-book", title: "bKash বই", desc: "bKash আসা/যাওয়া", icon: <Smartphone className="h-5 w-5" />, color: "text-pink-600" },
  ]},
];

function Hub() {
  const snapFn = useServerFn(getReportSnapshot);
  const { data: snap } = useQuery({ queryKey: ["report-snap"], queryFn: () => snapFn() });
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">রিপোর্ট</h1>
        <p className="text-sm text-muted-foreground">বিক্রয়, ক্রয়, স্টক, লাভ, বাকি, ট্যাক্স ও MIS — সব রিপোর্ট আলাদা পেজে</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Snap icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} label="আজকের বিক্রয়" value={fmt(snap?.sales_today ?? 0)} />
        <Snap icon={<TrendingUp className="h-5 w-5" />} label="এ মাসের বিক্রয়" value={fmt(snap?.sales_month ?? 0)} />
        <Snap icon={<TrendingDown className="h-5 w-5 text-amber-600" />} label="এ মাসের ক্রয়" value={fmt(snap?.purchase_month ?? 0)} />
        <Snap icon={<Wallet className="h-5 w-5 text-destructive" />} label="কাস্টমার বাকি" value={fmt(snap?.customer_due ?? 0)} />
      </div>

      {groups.map(g => (
        <section key={g.name} className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{g.name}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {g.items.map(it => (
              <Link key={it.to} to={it.to} className="group">
                <Card className="h-full transition hover:shadow-md hover:border-emerald-500/40">
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className={`rounded-lg bg-muted p-2 ${it.color}`}>{it.icon}</div>
                    <div className="min-w-0">
                      <div className="font-semibold group-hover:text-emerald-600 transition">{it.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{it.desc}</div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Snap({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <Card><CardContent className="p-4">
    <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}<span>{label}</span></div>
    <div className="mt-2 text-xl font-bold">{value}</div>
  </CardContent></Card>;
}