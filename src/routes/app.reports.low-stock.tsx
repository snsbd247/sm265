import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LowStockReport } from "@/lib/report-sections";

export const Route = createFileRoute("/app/reports/low-stock")({
  component: Page,
  head: () => ({ meta: [
    { title: "লো/আউট স্টক — Tally BD" },
    { name: "description", content: "রি-অর্ডার প্রয়োজন" },
    { property: "og:title", content: "লো/আউট স্টক — Tally BD" },
    { property: "og:description", content: "রি-অর্ডার প্রয়োজন" },
  ] }),
});

function Page() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/reports"><ArrowLeft className="mr-1 h-4 w-4" /> রিপোর্ট</Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">লো/আউট স্টক</h1>
          <p className="text-sm text-muted-foreground">রি-অর্ডার প্রয়োজন</p>
        </div>
      </div>
      <LowStockReport />
    </div>
  );
}
