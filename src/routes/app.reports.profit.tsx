import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProfitReport } from "@/lib/report-sections";

export const Route = createFileRoute("/app/reports/profit")({
  component: Page,
  head: () => ({ meta: [
    { title: "লাভ রিপোর্ট — Tally BD" },
    { name: "description", content: "গ্রস প্রফিট ও মার্জিন" },
    { property: "og:title", content: "লাভ রিপোর্ট — Tally BD" },
    { property: "og:description", content: "গ্রস প্রফিট ও মার্জিন" },
  ] }),
});

function Page() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/reports"><ArrowLeft className="mr-1 h-4 w-4" /> রিপোর্ট</Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">লাভ রিপোর্ট</h1>
          <p className="text-sm text-muted-foreground">গ্রস প্রফিট ও মার্জিন</p>
        </div>
      </div>
      <ProfitReport />
    </div>
  );
}
