import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CashBook } from "@/lib/report-sections";

export const Route = createFileRoute("/app/reports/bkash-book")({
  component: Page,
  head: () => ({ meta: [
    { title: "bKash বই — Tally BD" },
    { name: "description", content: "bKash আসা ও যাওয়া" },
    { property: "og:title", content: "bKash বই — Tally BD" },
    { property: "og:description", content: "bKash আসা ও যাওয়া" },
  ] }),
});

function Page() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/reports"><ArrowLeft className="mr-1 h-4 w-4" /> রিপোর্ট</Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">bKash বই</h1>
          <p className="text-sm text-muted-foreground">bKash আসা ও যাওয়া</p>
        </div>
      </div>
      <CashBook method="bkash" title="bKash বই" />
    </div>
  );
}
