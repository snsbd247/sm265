import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useState } from "react";
import {
  Store,
  ShieldCheck,
  Package,
  CreditCard,
  MessageSquare,
  BarChart3,
  Sparkles,
  ArrowRight,
  Check,
  Zap,
  Users,
  Receipt,
  TrendingUp,
  Smartphone,
  Cloud,
  Star,
  ChevronRight,
  Mail,
  Phone,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBranding } from "@/hooks/use-branding";
import { listPublicPackages, submitDemoRequest } from "@/lib/landing.functions";
import { toast } from "sonner";

const SITE_URL = "https://tallybd.lovable.app";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "Supershop — বাংলাদেশের #১ মুদি দোকান POS ও ম্যানেজমেন্ট সফটওয়্যার" },
      {
        name: "description",
        content:
          "মুদি দোকানের জন্য সম্পূর্ণ POS, স্টক, বকেয়া, কিস্তি, কাস্টমার ও সাপ্লায়ার ম্যানেজমেন্ট। মোবাইল-ফ্রেন্ডলি, বাংলা ইন্টারফেস, বিকাশ ইন্টিগ্রেশন, ফ্রি ট্রায়াল।",
      },
      { name: "keywords", content: "মুদি দোকান সফটওয়্যার, POS বাংলা, দোকান হিসাব, inventory bangladesh, grocery pos" },
      { property: "og:title", content: "Supershop — মুদি দোকান POS ও ম্যানেজমেন্ট" },
      { property: "og:description", content: "POS, স্টক, বকেয়া, কিস্তি, রিপোর্ট — সবকিছু এক প্ল্যাটফর্মে।" },
      { property: "og:url", content: SITE_URL },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "bn_BD" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Supershop — মুদি দোকান POS" },
      { name: "twitter:description", content: "POS, স্টক, বকেয়া, রিপোর্ট — এক প্ল্যাটফর্মে।" },
    ],
    links: [{ rel: "canonical", href: SITE_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: "Supershop",
          applicationCategory: "BusinessApplication",
          operatingSystem: "Web, Android, iOS",
          offers: { "@type": "Offer", price: "500", priceCurrency: "BDT" },
          aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "1000" },
        }),
      },
    ],
  }),
});

const PricingSection = lazy(() => import("@/components/landing/pricing-section"));

function Landing() {
  const { siteName, logoUrl, tagline, footerNote } = useBranding();
  const [showForm, setShowForm] = useState(false);

  const features = [
    { icon: Package, title: "স্টক ম্যানেজমেন্ট", desc: "প্রোডাক্ট, ক্যাটাগরি, ইউনিট, ব্যারকোড, লো-স্টক অ্যালার্ট", grad: "grad-emerald", soft: "soft-emerald" },
    { icon: CreditCard, title: "নগদ / বাকি / কিস্তি", desc: "সব ধরনের বিক্রি ও অটোমেটিক লেজার আপডেট", grad: "grad-blue", soft: "soft-blue" },
    { icon: BarChart3, title: "সম্পূর্ণ রিপোর্ট", desc: "দৈনিক, মাসিক, বাৎসরিক ও প্রোডাক্ট-ওয়াইজ রিপোর্ট", grad: "grad-violet", soft: "soft-violet" },
    { icon: MessageSquare, title: "SMS নোটিফিকেশন", desc: "কাস্টমারকে বিল ও পেমেন্ট রিসিভের ম্যাসেজ", grad: "grad-sunset", soft: "soft-amber" },
    { icon: Users, title: "মাল্টি-স্টাফ", desc: "মালিক, ম্যানেজার, ক্যাশিয়ার — আলাদা রোল ও পারমিশন", grad: "grad-cyan", soft: "soft-cyan" },
    { icon: ShieldCheck, title: "সুরক্ষিত ডেটা", desc: "প্রতিটি দোকানের ডেটা আলাদা ও এনক্রিপ্টেড", grad: "grad-rose", soft: "soft-rose" },
  ];

  const stats = [
    { value: "১০০০+", label: "সক্রিয় দোকান", icon: Store },
    { value: "৫০ লাখ+", label: "ট্রান্সেকশন", icon: Receipt },
    { value: "৯৯.৯%", label: "আপটাইম", icon: Zap },
    { value: "২৪/৭", label: "সাপোর্ট", icon: ShieldCheck },
  ];

  const workflow = [
    { step: "০১", title: "সাইন আপ করুন", desc: "মিনিটেই দোকানের অ্যাকাউন্ট তৈরি করুন", icon: Sparkles },
    { step: "০২", title: "প্রোডাক্ট যোগ করুন", desc: "স্টক, সাপ্লায়ার ও কাস্টমার সেটআপ", icon: Package },
    { step: "০৩", title: "বিক্রি শুরু করুন", desc: "POS দিয়ে দ্রুত বিক্রি ও রিপোর্ট", icon: TrendingUp },
  ];

  const highlights = [
    "মাল্টি-ডিভাইস (মোবাইল, ট্যাব, ল্যাপটপ)",
    "থার্মাল প্রিন্টার সাপোর্ট (৮০mm)",
    "বিকাশ পেমেন্ট ইন্টিগ্রেশন",
    "অটো ব্যাকআপ ও ক্লাউড সিঙ্ক",
    "বাংলা ইন্টারফেস",
    "রিয়েল-টাইম ড্যাশবোর্ড",
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {logoUrl ? (
              <img src={logoUrl} alt={siteName} width={40} height={40} className="h-10 w-10 rounded-xl object-contain bg-white p-1 shadow-md ring-1 ring-black/5" />
            ) : (
              <div className="grad-ocean flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg shadow-blue-500/30">
                <Store className="h-5 w-5" />
              </div>
            )}
            <span className="truncate text-lg font-extrabold tracking-tight sm:text-xl">{siteName}</span>
          </div>

          <nav className="flex shrink-0 items-center gap-1 sm:gap-2">
            <a href="#features" className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground md:inline-block">ফিচার</a>
            <a href="#pricing" className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground md:inline-block">প্রাইসিং</a>
            <a href="#contact" className="hidden rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground md:inline-block">যোগাযোগ</a>
            <Link to="/login">
              <Button variant="ghost" size="sm" className="px-2 sm:px-3">লগিন</Button>
            </Link>
            <button onClick={() => setShowForm(true)} className="hidden sm:inline-flex">
              <Button size="sm" className="grad-ocean border-0">ডেমো নিন</Button>
            </button>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-0 -z-10 motion-reduce:hidden">
            <div className="absolute -top-40 left-1/2 h-[420px] w-[900px] max-w-full -translate-x-1/2 rounded-full bg-gradient-to-br from-blue-400/30 via-indigo-400/20 to-transparent blur-3xl" />
            <div className="absolute -bottom-40 -left-32 h-[400px] w-[600px] rounded-full bg-gradient-to-tr from-emerald-300/30 to-transparent blur-3xl hidden sm:block" />
            <div className="absolute -right-32 top-40 h-[400px] w-[500px] rounded-full bg-gradient-to-bl from-rose-300/30 to-transparent blur-3xl hidden sm:block" />
          </div>

          <div className="mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pb-24 sm:pt-20">
            <div className="mx-auto max-w-4xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
                <span className="grad-emerald inline-block h-1.5 w-1.5 rounded-full" />
                বাংলাদেশের #১ মুদি দোকান সফটওয়্যার
                <Sparkles className="h-3 w-3 text-amber-500" />
              </div>

              <h1 className="mt-6 text-3xl font-black leading-[1.08] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
                দোকান চালান{" "}
                <span className="relative inline-block">
                  <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                    স্মার্টলি
                  </span>
                </span>
                <br />
                বাড়ান বিক্রি ও লাভ
              </h1>

              <p className="mx-auto mt-5 max-w-2xl text-sm text-muted-foreground sm:text-lg">
                POS, স্টক, ক্রয়-বিক্রয়, বকেয়া, কিস্তি, কাস্টমার ও সাপ্লায়ার লেজার —
                সবকিছু এক জায়গায়। মোবাইল, ট্যাব বা ল্যাপটপ থেকে যেকোনো জায়গা থেকে চালান।
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                <Link to="/login">
                  <Button size="lg" className="grad-ocean h-12 gap-2 rounded-full border-0 px-6 text-base font-semibold shadow-xl shadow-blue-500/30 hover:opacity-95">
                    এখনই শুরু করুন <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <button onClick={() => setShowForm(true)}>
                  <Button size="lg" variant="outline" className="h-12 gap-2 rounded-full border-2 px-6 text-base font-semibold" asChild={false}>
                    <span>ডেমো রিকোয়েস্ট <ChevronRight className="h-4 w-4" /></span>
                  </Button>
                </button>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> ফ্রি ট্রায়াল</div>
                <div className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> কার্ড লাগবে না</div>
                <div className="flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-600" /> ২ মিনিটে সেটআপ</div>
              </div>
            </div>

            {/* Preview mockup — hidden on small screens for perf */}
            <div className="relative mx-auto mt-12 hidden max-w-5xl sm:block sm:mt-16">
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-r from-blue-400/30 via-indigo-400/30 to-violet-400/30 opacity-70 blur-2xl" />
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl ring-1 ring-black/5">
                <div className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="grid gap-3 p-4 sm:grid-cols-4 sm:p-5">
                  {stats.map((s) => (
                    <div key={s.label} className="soft-blue rounded-xl border border-border/50 p-4">
                      <s.icon className="h-4 w-4 text-blue-700" />
                      <div className="mt-2 text-2xl font-black text-slate-900">{s.value}</div>
                      <div className="text-xs text-slate-700">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="grid gap-3 border-t p-4 sm:grid-cols-3 sm:p-5">
                  <div className="grad-emerald rounded-xl p-4 shadow-md">
                    <TrendingUp className="h-5 w-5" />
                    <div className="mt-2 text-xs opacity-90">আজকের বিক্রয়</div>
                    <div className="text-xl font-extrabold">৳৪২,৩৫০</div>
                  </div>
                  <div className="grad-violet rounded-xl p-4 shadow-md">
                    <Receipt className="h-5 w-5" />
                    <div className="mt-2 text-xs opacity-90">এ মাসের বিক্রয়</div>
                    <div className="text-xl font-extrabold">৳১২,৮৫,০০০</div>
                  </div>
                  <div className="grad-sunset rounded-xl p-4 shadow-md">
                    <Users className="h-5 w-5" />
                    <div className="mt-2 text-xs opacity-90">কাস্টমার</div>
                    <div className="text-xl font-extrabold">১,২৪৭</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats bar */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-4 sm:px-6">
            {stats.map((s) => (
              <div key={s.label} className="text-center">
                <div className="text-2xl font-black tracking-tight sm:text-3xl">
                  <span className="bg-gradient-to-r from-blue-600 to-violet-600 bg-clip-text text-transparent">{s.value}</span>
                </div>
                <div className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section id="features" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              <Sparkles className="h-3 w-3" /> ফিচার সমূহ
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
              যা যা দরকার, সব <span className="bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">এক প্ল্যাটফর্মে</span>
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">দোকান পরিচালনার প্রতিটি ধাপ সহজ ও অটোমেটেড</p>
          </div>

          <div className="mt-10 grid gap-4 sm:mt-12 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="card-hover group relative overflow-hidden rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:p-6">
                <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-20 blur-2xl ${f.grad}`} />
                <div className={`inline-flex h-11 w-11 items-center justify-center rounded-xl shadow-lg sm:h-12 sm:w-12 ${f.grad}`}>
                  <f.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <h3 className="mt-4 text-base font-bold sm:text-lg">{f.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border bg-gradient-to-br from-slate-50 to-blue-50/50 p-5 sm:mt-10 sm:p-8">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {highlights.map((h) => (
                <div key={h} className="flex items-center gap-2.5 text-sm">
                  <div className="grad-emerald flex h-6 w-6 shrink-0 items-center justify-center rounded-full shadow-md">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                  <span className="font-medium text-slate-800">{h}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <Suspense fallback={<div className="py-24 text-center text-sm text-muted-foreground">লোড হচ্ছে…</div>}>
          <PricingSection onDemoClick={() => setShowForm(true)} />
        </Suspense>

        {/* Workflow */}
        <section id="workflow" className="border-t bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                <Zap className="h-3 w-3" /> কিভাবে কাজ করে
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">৩ ধাপে শুরু</h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">টেকনিক্যাল জ্ঞান লাগবে না — যেকেউ পারবে</p>
            </div>

            <div className="mt-10 grid gap-5 sm:mt-12 md:grid-cols-3">
              {workflow.map((w, i) => (
                <div key={w.step} className="relative">
                  <div className="card-hover relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                    <div className="flex items-start justify-between">
                      <div className="grad-ocean inline-flex h-11 w-11 items-center justify-center rounded-xl shadow-lg shadow-blue-500/30 sm:h-12 sm:w-12">
                        <w.icon className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                      <span className="text-3xl font-black text-muted-foreground/20 sm:text-4xl">{w.step}</span>
                    </div>
                    <h3 className="mt-4 text-base font-bold sm:text-lg">{w.title}</h3>
                    <p className="mt-1.5 text-sm text-muted-foreground">{w.desc}</p>
                  </div>
                  {i < workflow.length - 1 && (
                    <ArrowRight className="absolute -right-3 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-muted-foreground/30 md:block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-24">
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
            {[
              { name: "মোঃ রফিকুল ইসলাম", role: "মালিক, রফিক স্টোর", stars: 5, quote: "আগে হিসাব রাখতে অনেক ঝামেলা হতো। এখন সব অটোমেটিক — বকেয়া, স্টক, রিপোর্ট সব হাতের মুঠোয়।" },
              { name: "সাদিয়া আক্তার", role: "মালিক, সাদিয়া মার্ট", stars: 5, quote: "SMS দিয়ে কাস্টমারকে বিল পাঠানো যায়। বকেয়া আদায় অনেক সহজ হয়ে গেছে।" },
              { name: "কামাল হোসেন", role: "মালিক, নিউ ঢাকা স্টোর", stars: 5, quote: "মোবাইল থেকেই দোকান চালাচ্ছি। বিকাশ পেমেন্ট ইন্টিগ্রেশন সবচেয়ে ভালো ফিচার।" },
            ].map((t) => (
              <div key={t.name} className="card-hover rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
                <div className="flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-700">"{t.quote}"</p>
                <div className="mt-5 flex items-center gap-3 border-t pt-4">
                  <div className="grad-violet flex h-10 w-10 items-center justify-center rounded-full font-bold shadow-md">
                    {t.name.charAt(0)}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{t.name}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Contact / Demo form */}
        <section id="contact" className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="grid gap-8 rounded-3xl border bg-gradient-to-br from-blue-50 via-white to-violet-50 p-6 shadow-lg sm:p-10 lg:grid-cols-2">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
                <Mail className="h-3 w-3" /> যোগাযোগ করুন
              </div>
              <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-3xl">
                ফ্রি ডেমো নিন
              </h2>
              <p className="mt-3 text-sm text-muted-foreground sm:text-base">
                আপনার দোকান ও প্রয়োজন জানান — আমাদের এক্সপার্ট আপনাকে কল দিয়ে সম্পূর্ণ সিস্টেম দেখাবে।
              </p>
              <ul className="mt-5 space-y-2 text-sm">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> ৩০ মিনিটের ফ্রি ডেমো</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> সেটআপে সাহায্য</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> কোনো কার্ড লাগবে না</li>
              </ul>
              <div className="mt-6 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <a href="tel:+8801700000000" className="flex items-center gap-2 hover:text-foreground"><Phone className="h-4 w-4" /> +৮৮ ০১৭০০-০০০০০০</a>
                <a href="mailto:hello@supershop.app" className="flex items-center gap-2 hover:text-foreground"><Mail className="h-4 w-4" /> hello@supershop.app</a>
              </div>
            </div>
            <DemoForm />
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="grad-ocean relative overflow-hidden rounded-3xl p-6 shadow-2xl shadow-blue-500/30 sm:p-14">
            <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/15 blur-3xl motion-reduce:hidden" />
            <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-medium backdrop-blur">
                  <Sparkles className="h-3 w-3" /> আজই শুরু করুন
                </div>
                <h2 className="mt-3 text-2xl font-black leading-tight sm:text-4xl">
                  আপনার দোকানকে ডিজিটাল করুন
                </h2>
                <p className="mt-3 max-w-xl text-sm text-white/90 sm:text-base">
                  হাজার হাজার দোকানদার আমাদের সাথে বিক্রি বাড়াচ্ছেন। আজই যোগ দিন।
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-white/90">
                  <div className="flex items-center gap-1.5"><Smartphone className="h-4 w-4" /> মোবাইল ফ্রেন্ডলি</div>
                  <div className="flex items-center gap-1.5"><Cloud className="h-4 w-4" /> ক্লাউড ব্যাকআপ</div>
                  <div className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> সুরক্ষিত</div>
                </div>
              </div>
              <Link to="/login">
                <Button size="lg" className="h-12 gap-2 rounded-full bg-white px-6 text-base font-bold text-blue-700 shadow-xl hover:bg-white/95 sm:h-14 sm:px-8">
                  ফ্রি শুরু করুন <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="grid gap-8 sm:grid-cols-2 md:grid-cols-4">
            <div className="sm:col-span-2">
              <div className="flex items-center gap-2.5">
                {logoUrl ? (
                  <img src={logoUrl} alt={siteName} width={36} height={36} loading="lazy" className="h-9 w-9 rounded-lg bg-white object-contain p-1 ring-1 ring-black/5" />
                ) : (
                  <div className="grad-ocean flex h-9 w-9 items-center justify-center rounded-lg shadow-md">
                    <Store className="h-4 w-4" />
                  </div>
                )}
                <span className="text-lg font-extrabold">{siteName}</span>
              </div>
              <p className="mt-3 max-w-md text-sm text-muted-foreground">
                {tagline || "মুদি দোকানের সম্পূর্ণ ম্যানেজমেন্ট সফটওয়্যার — POS, স্টক, বকেয়া, রিপোর্ট সবকিছু এক জায়গায়।"}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold">প্রোডাক্ট</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">ফিচার</a></li>
                <li><a href="#pricing" className="hover:text-foreground">প্রাইসিং</a></li>
                <li><a href="#workflow" className="hover:text-foreground">কিভাবে কাজ করে</a></li>
                <li><Link to="/login" className="hover:text-foreground">লগিন</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold">যোগাযোগ</h4>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li><a href="#contact" className="hover:text-foreground">ডেমো রিকোয়েস্ট</a></li>
                <li><a href="mailto:hello@supershop.app" className="hover:text-foreground">hello@supershop.app</a></li>
                <li><a href="tel:+8801700000000" className="hover:text-foreground">+৮৮ ০১৭০০-০০০০০০</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-2 border-t pt-6 text-center text-xs text-muted-foreground sm:flex-row sm:text-left">
            <div>© {new Date().getFullYear()} {siteName}. সর্বস্বত্ব সংরক্ষিত।</div>
            {footerNote && <div>{footerNote}</div>}
          </div>
        </div>
      </footer>

      {/* Modal demo form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="relative w-full max-w-lg rounded-2xl bg-card p-6 shadow-2xl sm:p-8" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowForm(false)} className="absolute right-3 top-3 rounded-full p-1.5 hover:bg-muted" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
            <h3 className="text-xl font-bold">ফ্রি ডেমো রিকোয়েস্ট</h3>
            <p className="mt-1 text-sm text-muted-foreground">আপনার তথ্য দিন, আমরা যোগাযোগ করব।</p>
            <div className="mt-5">
              <DemoForm onSuccess={() => setShowForm(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DemoForm({ onSuccess }: { onSuccess?: () => void }) {
  const submitFn = useServerFn(submitDemoRequest);
  const [form, setForm] = useState({ name: "", phone: "", email: "", shop_name: "", message: "" });
  const mutation = useMutation({
    mutationFn: (data: typeof form) => submitFn({ data }),
    onSuccess: () => {
      toast.success("ধন্যবাদ! আমরা শীঘ্রই যোগাযোগ করব।");
      setForm({ name: "", phone: "", email: "", shop_name: "", message: "" });
      onSuccess?.();
    },
    onError: (err: Error) => toast.error(err.message || "সাবমিট ব্যর্থ"),
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(form);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <input required minLength={2} maxLength={100} placeholder="আপনার নাম *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <input required minLength={6} maxLength={20} placeholder="মোবাইল নম্বর *" inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-11 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input type="email" maxLength={255} placeholder="ইমেইল (ঐচ্ছিক)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
        <input maxLength={150} placeholder="দোকানের নাম" value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} className="h-11 rounded-lg border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <textarea maxLength={1000} rows={3} placeholder="আপনার বার্তা (ঐচ্ছিক)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" />
      <Button type="submit" disabled={mutation.isPending} size="lg" className="grad-ocean w-full gap-2 rounded-lg border-0 text-base font-semibold">
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {mutation.isPending ? "পাঠানো হচ্ছে..." : "রিকোয়েস্ট পাঠান"}
      </Button>
    </form>
  );
}
