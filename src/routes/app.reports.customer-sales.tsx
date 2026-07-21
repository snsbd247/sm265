import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerSalesReport } from "@/lib/report-sections";

export const Route = createFileRoute("/app/reports/customer-sales")({
  component: Page,
  head: () => ({ meta: [
    { title: "কাস্টমার বিক্রয় — Tally BD" },
    { name: "description", content: "কাস্টমার ভিত্তিক বিক্রয়" },
    { property: "og:title", content: "কাস্টমার বিক্রয় — Tally BD" },
    { property: "og:description", content: "কাস্টমার ভিত্তিক বিক্রয়" },
  ] }),
});

function Page() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/reports"><ArrowLeft className="mr-1 h-4 w-4" /> রিপোর্ট</Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">কাস্টমার বিক্রয়</h1>
          <p className="text-sm text-muted-foreground">কাস্টমার ভিত্তিক বিক্রয়</p>
        </div>
      </div>
      <CustomerSalesReport />
    </div>
  );
}
