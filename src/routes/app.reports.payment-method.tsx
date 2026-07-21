import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PaymentMethodReport } from "@/lib/report-sections";

export const Route = createFileRoute("/app/reports/payment-method")({
  component: Page,
  head: () => ({ meta: [
    { title: "পেমেন্ট মেথড — Tally BD" },
    { name: "description", content: "মেথড ভিত্তিক ইন/আউট" },
    { property: "og:title", content: "পেমেন্ট মেথড — Tally BD" },
    { property: "og:description", content: "মেথড ভিত্তিক ইন/আউট" },
  ] }),
});

function Page() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/reports"><ArrowLeft className="mr-1 h-4 w-4" /> রিপোর্ট</Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">পেমেন্ট মেথড</h1>
          <p className="text-sm text-muted-foreground">মেথড ভিত্তিক ইন/আউট</p>
        </div>
      </div>
      <PaymentMethodReport />
    </div>
  );
}
