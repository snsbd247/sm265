import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PayableReport } from "@/lib/report-sections";

export const Route = createFileRoute("/app/reports/payable")({
  component: Page,
  head: () => ({ meta: [
    { title: "সাপ্লায়ার বাকি — Tally BD" },
    { name: "description", content: "পেয়েবল ব্যালেন্স" },
    { property: "og:title", content: "সাপ্লায়ার বাকি — Tally BD" },
    { property: "og:description", content: "পেয়েবল ব্যালেন্স" },
  ] }),
});

function Page() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/reports"><ArrowLeft className="mr-1 h-4 w-4" /> রিপোর্ট</Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">সাপ্লায়ার বাকি</h1>
          <p className="text-sm text-muted-foreground">পেয়েবল ব্যালেন্স</p>
        </div>
      </div>
      <PayableReport />
    </div>
  );
}
