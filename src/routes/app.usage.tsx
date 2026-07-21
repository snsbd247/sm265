import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUsageReport } from "@/lib/usage.functions";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine, Legend } from "recharts";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/usage")({ component: Page });

type UsageInfo = {
  used: number;
  limit: number | null;
  remaining: number | null;
  exceeded: boolean;
  packageName: string | null;
};

const labels: Record<string, string> = {
  products: "পণ্য",
  users: "ইউজার",
  sms: "SMS (মাসিক)",
  customers: "কাস্টমার",
  invoices: "ইনভয়েস (মাসিক)",
  invoice_total: "ইনভয়েস মূল্য (মাসিক ৳)",
};

function pct(u: UsageInfo) {
  if (u.limit == null || u.limit === 0) return 0;
  return Math.min(100, Math.round((u.used / u.limit) * 100));
}

function KpiCard({ k, u }: { k: string; u: UsageInfo }) {
  const p = pct(u);
  const tone = u.limit == null ? "bg-emerald-500"
    : p >= 100 ? "bg-red-500"
    : p >= 80 ? "bg-amber-500"
    : "bg-emerald-500";
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">{labels[k] ?? k}</div>
        {u.exceeded && <Badge variant="destructive">সীমা শেষ</Badge>}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="text-2xl font-bold">{Number(u.used).toLocaleString("bn-BD")}</div>
        <div className="text-sm text-muted-foreground">
          / {u.limit == null ? "∞" : Number(u.limit).toLocaleString("bn-BD")}
        </div>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${tone}`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function Page() {
  const fn = useServerFn(getUsageReport);
  const q = useQuery({ queryKey: ["usage-report"], queryFn: () => fn() });
  const data = q.data;

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">ব্যবহার রিপোর্ট</h1>
          <p className="text-sm text-muted-foreground">
            প্যাকেজ: <span className="font-semibold">{data?.packageName ?? "-"}</span>
          </p>
        </div>
      </div>

      {q.isLoading && <div className="text-muted-foreground">লোড হচ্ছে…</div>}
      {data && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(data.current).map(([k, u]) => (
              <KpiCard key={k} k={k} u={u as any} />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title="মাসিক ইনভয়েস সংখ্যা" data={data.series} dataKey="invoices" limitKey="invoice_limit" color="#10b981" />
            <ChartCard title="মাসিক ইনভয়েস মূল্য (৳)" data={data.series} dataKey="invoice_total" limitKey="invoice_total_limit" color="#3b82f6" />
            <ChartCard title="মাসিক SMS" data={data.series} dataKey="sms" limitKey="sms_limit" color="#f59e0b" />
          </div>
        </>
      )}
    </div>
  );
}

function ChartCard({ title, data, dataKey, limitKey, color }: {
  title: string; data: any[]; dataKey: string; limitKey: string; color: string;
}) {
  const limit = data[0]?.[limitKey] as number | null;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">সীমা: {limit == null ? "∞" : Number(limit).toLocaleString("bn-BD")}</div>
      </div>
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="month" fontSize={11} />
            <YAxis fontSize={11} />
            <Tooltip />
            <Legend />
            <Bar dataKey={dataKey} fill={color} name="ব্যবহৃত" />
            {limit != null && <ReferenceLine y={limit} stroke="#ef4444" strokeDasharray="4 4" label="সীমা" />}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}