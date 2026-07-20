import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Check, Sparkles, Package, Users, MessageSquare, Crown, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listPublicPackages } from "@/lib/landing.functions";
import { useState } from "react";

const fmt = (n: number) => `৳${Number(n).toLocaleString("bn-BD")}`;

type Cycle = "monthly" | "yearly";

export default function PricingSection({ onDemoClick }: { onDemoClick?: () => void }) {
  const listFn = useServerFn(listPublicPackages);
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["public-packages"],
    queryFn: () => listFn(),
    staleTime: 5 * 60 * 1000,
  });
  const [cycle, setCycle] = useState<Cycle>("monthly");

  return (
    <section id="pricing" className="border-t bg-gradient-to-b from-white to-slate-50/50">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <Sparkles className="h-3 w-3" /> প্রাইসিং প্ল্যান
          </div>
          <h2 className="mt-4 text-2xl font-black tracking-tight sm:text-4xl">
            আপনার প্রয়োজন অনুযায়ী <span className="bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">প্ল্যান বেছে নিন</span>
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            যেকোনো প্ল্যান — যখন খুশি আপগ্রেড বা ডাউনগ্রেড করুন
          </p>

          <div className="mt-6 inline-flex rounded-full border bg-white p-1 shadow-sm">
            <button
              onClick={() => setCycle("monthly")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${cycle === "monthly" ? "grad-ocean text-white shadow" : "text-muted-foreground"}`}
            >
              মাসিক
            </button>
            <button
              onClick={() => setCycle("yearly")}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${cycle === "yearly" ? "grad-ocean text-white shadow" : "text-muted-foreground"}`}
            >
              বার্ষিক <span className="ml-1 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] text-white">২ মাস ফ্রি</span>
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-96 animate-pulse rounded-2xl border bg-muted/40" />
            ))}
          </div>
        ) : (
          <div className="mt-10 grid gap-5 sm:mt-12 lg:grid-cols-3">
            {packages.map((pkg, i) => {
              const featured = i === 1;
              const price = cycle === "monthly" ? Number(pkg.price_monthly) : Number(pkg.price_yearly);
              const features = Array.isArray(pkg.features) ? (pkg.features as string[]) : [];
              return (
                <div
                  key={pkg.id}
                  className={`card-hover relative overflow-hidden rounded-2xl border p-6 shadow-sm ${
                    featured
                      ? "border-blue-500/40 bg-gradient-to-br from-white to-blue-50 shadow-xl ring-2 ring-blue-500/30 lg:-translate-y-2"
                      : "bg-card"
                  }`}
                >
                  {featured && (
                    <div className="absolute right-4 top-4 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow">
                      জনপ্রিয়
                    </div>
                  )}
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl shadow-lg ${featured ? "grad-ocean" : "grad-violet"}`}>
                    <Crown className="h-6 w-6" />
                  </div>
                  <h3 className="mt-5 text-2xl font-black">{pkg.name}</h3>
                  {pkg.description && <p className="mt-1 text-sm text-muted-foreground">{pkg.description}</p>}
                  <div className="mt-5 flex items-baseline gap-1">
                    <span className="text-4xl font-black tracking-tight">{fmt(price)}</span>
                    <span className="text-sm text-muted-foreground">/{cycle === "monthly" ? "মাস" : "বছর"}</span>
                  </div>

                  <ul className="mt-6 space-y-2.5 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                      <Package className="h-3.5 w-3.5 text-muted-foreground" />
                      {pkg.max_products.toLocaleString("bn-BD")} প্রোডাক্ট পর্যন্ত
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      {pkg.max_users} জন ইউজার
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                      মাসে {pkg.max_sms_per_month.toLocaleString("bn-BD")} SMS
                    </li>
                    {features.map((f) => (
                      <li key={f} className="flex items-center gap-2">
                        <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-7 flex flex-col gap-2">
                    <Link to="/login">
                      <Button className={`w-full gap-2 rounded-lg ${featured ? "grad-ocean border-0 text-white" : ""}`} variant={featured ? "default" : "outline"}>
                        শুরু করুন <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                    {onDemoClick && (
                      <button onClick={onDemoClick} className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
                        অথবা ডেমো রিকোয়েস্ট করুন
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Feature comparison */}
        {packages.length > 0 && (
          <div className="mt-14 overflow-x-auto rounded-2xl border bg-card shadow-sm">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-4 text-left font-semibold">ফিচার</th>
                  {packages.map((p) => (
                    <th key={p.id} className="p-4 text-center font-semibold">{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="p-4 text-muted-foreground">প্রোডাক্ট লিমিট</td>
                  {packages.map((p) => (
                    <td key={p.id} className="p-4 text-center font-medium">{p.max_products.toLocaleString("bn-BD")}</td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 text-muted-foreground">ইউজার</td>
                  {packages.map((p) => (
                    <td key={p.id} className="p-4 text-center font-medium">{p.max_users}</td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 text-muted-foreground">মাসিক SMS</td>
                  {packages.map((p) => (
                    <td key={p.id} className="p-4 text-center font-medium">{p.max_sms_per_month.toLocaleString("bn-BD")}</td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 text-muted-foreground">POS ও স্টক</td>
                  {packages.map((p) => (
                    <td key={p.id} className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-emerald-600" /></td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 text-muted-foreground">রিপোর্ট ও লেজার</td>
                  {packages.map((p) => (
                    <td key={p.id} className="p-4 text-center"><Check className="mx-auto h-4 w-4 text-emerald-600" /></td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
