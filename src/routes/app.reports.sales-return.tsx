import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SalesReturnReport } from "@/lib/report-sections";

export const Route = createFileRoute("/app/reports/sales-return")({
  component: Page,
  head: () => ({ meta: [
    { title: "সেল রিটার্ন — Tally BD" },
    { name: "description", content: "রিফান্ড ও রিটার্ন ইতিহাস" },
    { property: "og:title", content: "সেল রিটার্ন — Tally BD" },
    { property: "og:description", content: "রিফান্ড ও রিটার্ন ইতিহাস" },
  ] }),
});

function Page() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/reports"><ArrowLeft className="mr-1 h-4 w-4" /> রিপোর্ট</Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">সেল রিটার্ন</h1>
          <p className="text-sm text-muted-foreground">রিফান্ড ও রিটার্ন ইতিহাস</p>
        </div>
      </div>
      <SalesReturnReport />
    </div>
  );
}
