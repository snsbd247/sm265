import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InstallmentReport } from "@/lib/report-sections";

export const Route = createFileRoute("/app/reports/installment")({
  component: Page,
  head: () => ({ meta: [
    { title: "কিস্তি বকেয়া — Tally BD" },
    { name: "description", content: "ওভারডিউসহ শিডিউল" },
    { property: "og:title", content: "কিস্তি বকেয়া — Tally BD" },
    { property: "og:description", content: "ওভারডিউসহ শিডিউল" },
  ] }),
});

function Page() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/reports"><ArrowLeft className="mr-1 h-4 w-4" /> রিপোর্ট</Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">কিস্তি বকেয়া</h1>
          <p className="text-sm text-muted-foreground">ওভারডিউসহ শিডিউল</p>
        </div>
      </div>
      <InstallmentReport />
    </div>
  );
}
