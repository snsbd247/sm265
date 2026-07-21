import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SalesReport } from "@/lib/report-sections";

export const Route = createFileRoute("/app/reports/sales")({
  component: Page,
  head: () => ({ meta: [
    { title: "বিক্রয় রিপোর্ট — Tally BD" },
    { name: "description", content: "দৈনিক/মাসিক বিক্রয় সারাংশ" },
    { property: "og:title", content: "বিক্রয় রিপোর্ট — Tally BD" },
    { property: "og:description", content: "দৈনিক/মাসিক বিক্রয় সারাংশ" },
  ] }),
});

function Page() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/reports"><ArrowLeft className="mr-1 h-4 w-4" /> রিপোর্ট</Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">বিক্রয় রিপোর্ট</h1>
          <p className="text-sm text-muted-foreground">দৈনিক/মাসিক বিক্রয় সারাংশ</p>
        </div>
      </div>
      <SalesReport />
    </div>
  );
}
