import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ShiftReport } from "@/lib/report-sections";

export const Route = createFileRoute("/app/reports/shift")({
  component: Page,
  head: () => ({ meta: [
    { title: "শিফট রিপোর্ট — Tally BD" },
    { name: "description", content: "POS শিফট ও ভ্যারিয়েন্স" },
    { property: "og:title", content: "শিফট রিপোর্ট — Tally BD" },
    { property: "og:description", content: "POS শিফট ও ভ্যারিয়েন্স" },
  ] }),
});

function Page() {
  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm"><Link to="/app/reports"><ArrowLeft className="mr-1 h-4 w-4" /> রিপোর্ট</Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold sm:text-2xl">শিফট রিপোর্ট</h1>
          <p className="text-sm text-muted-foreground">POS শিফট ও ভ্যারিয়েন্স</p>
        </div>
      </div>
      <ShiftReport />
    </div>
  );
}
