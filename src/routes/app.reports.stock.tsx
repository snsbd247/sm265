import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StockReport } from "@/lib/report-sections";

export const Route = createFileRoute("/app/reports/stock")({
  component: Page,
  head: () => ({ meta: [
    { title: "স্টক ভ্যালুয়েশন — Tally BD" },
    { name: "description", content: "ক্রয়/বিক্রয় মূল্যে স্টক" },
    { property: "og:title", content: "স্টক ভ্যালুয়েশন — Tally BD" },
    { property: "og:description", content: "ক্রয়/বিক্রয় মূল্যে স্টক" },
  ] }),
});

function Page() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/reports"><ArrowLeft className="mr-1 h-4 w-4" /> রিপোর্ট</Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">স্টক ভ্যালুয়েশন</h1>
          <p className="text-sm text-muted-foreground">ক্রয়/বিক্রয় মূল্যে স্টক</p>
        </div>
      </div>
      <StockReport />
    </div>
  );
}
