import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CashBook } from "@/lib/report-sections";

export const Route = createFileRoute("/app/reports/cash-book")({
  component: Page,
  head: () => ({ meta: [
    { title: "ক্যাশ বই (নগদ) — Tally BD" },
    { name: "description", content: "নগদ আসা ও যাওয়া" },
    { property: "og:title", content: "ক্যাশ বই (নগদ) — Tally BD" },
    { property: "og:description", content: "নগদ আসা ও যাওয়া" },
  ] }),
});

function Page() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/reports"><ArrowLeft className="mr-1 h-4 w-4" /> রিপোর্ট</Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">ক্যাশ বই (নগদ)</h1>
          <p className="text-sm text-muted-foreground">নগদ আসা ও যাওয়া</p>
        </div>
      </div>
      <CashBook method="cash" title="ক্যাশ বই (নগদ)" />
    </div>
  );
}
