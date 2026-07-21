import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StockMovementReport } from "@/lib/report-sections";

export const Route = createFileRoute("/app/reports/stock-movement")({
  component: Page,
  head: () => ({ meta: [
    { title: "স্টক মুভমেন্ট — Tally BD" },
    { name: "description", content: "ইন/আউট হিস্টরি" },
    { property: "og:title", content: "স্টক মুভমেন্ট — Tally BD" },
    { property: "og:description", content: "ইন/আউট হিস্টরি" },
  ] }),
});

function Page() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/reports"><ArrowLeft className="mr-1 h-4 w-4" /> রিপোর্ট</Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">স্টক মুভমেন্ট</h1>
          <p className="text-sm text-muted-foreground">ইন/আউট হিস্টরি</p>
        </div>
      </div>
      <StockMovementReport />
    </div>
  );
}
