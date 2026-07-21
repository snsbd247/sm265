import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductSalesReport } from "@/lib/report-sections";

export const Route = createFileRoute("/app/reports/product-sales")({
  component: Page,
  head: () => ({ meta: [
    { title: "প্রোডাক্ট বিক্রয় — Tally BD" },
    { name: "description", content: "প্রতিটি পণ্যের বিক্রয় ও লাভ" },
    { property: "og:title", content: "প্রোডাক্ট বিক্রয় — Tally BD" },
    { property: "og:description", content: "প্রতিটি পণ্যের বিক্রয় ও লাভ" },
  ] }),
});

function Page() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/reports"><ArrowLeft className="mr-1 h-4 w-4" /> রিপোর্ট</Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">প্রোডাক্ট বিক্রয়</h1>
          <p className="text-sm text-muted-foreground">প্রতিটি পণ্যের বিক্রয় ও লাভ</p>
        </div>
      </div>
      <ProductSalesReport />
    </div>
  );
}
