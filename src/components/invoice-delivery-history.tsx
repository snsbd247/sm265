import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listInvoiceDeliveries, listCustomerDeliveries } from "@/lib/invoice-delivery.functions";
import { Badge } from "@/components/ui/badge";
import { Mail, MessageSquare } from "lucide-react";

type Row = {
  id: string;
  channel: "sms" | "email";
  recipient: string;
  status: "pending" | "sent" | "failed";
  response?: string | null;
  created_at: string;
  sale?: { invoice_no?: string | null } | null;
};

function StatusBadge({ s }: { s: Row["status"] }) {
  return (
    <Badge variant={s === "sent" ? "default" : s === "failed" ? "destructive" : "secondary"} className="capitalize">
      {s}
    </Badge>
  );
}

function List({ rows, showInvoice }: { rows: Row[]; showInvoice?: boolean }) {
  if (rows.length === 0) {
    return <div className="rounded-md border bg-muted/30 p-3 text-center text-xs text-muted-foreground">কোন হিস্ট্রি নেই</div>;
  }
  return (
    <div className="divide-y rounded-md border bg-card">
      {rows.map((r) => (
        <div key={r.id} className="flex items-start gap-3 p-2.5 text-xs">
          <div className="mt-0.5">
            {r.channel === "email"
              ? <Mail className="h-4 w-4 text-sky-600" />
              : <MessageSquare className="h-4 w-4 text-emerald-600" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono">{r.recipient}</span>
              <StatusBadge s={r.status} />
              {showInvoice && r.sale?.invoice_no && (
                <span className="text-[10px] text-muted-foreground">#{r.sale.invoice_no}</span>
              )}
            </div>
            {r.response && (
              <div className="mt-0.5 truncate text-[10px] text-muted-foreground" title={r.response}>
                {r.response}
              </div>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground whitespace-nowrap">
            {new Date(r.created_at).toLocaleString("bn-BD")}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SaleDeliveryHistory({ saleId }: { saleId: string }) {
  const fn = useServerFn(listInvoiceDeliveries);
  const q = useQuery<Row[]>({
    queryKey: ["invoice-deliveries", saleId],
    queryFn: () => fn({ data: { sale_id: saleId } }) as any,
    refetchInterval: 30_000,
  });
  if (q.isLoading) return <div className="text-xs text-muted-foreground">লোড হচ্ছে...</div>;
  return <List rows={q.data ?? []} />;
}

export function CustomerDeliveryHistory({ customerId }: { customerId: string }) {
  const fn = useServerFn(listCustomerDeliveries);
  const q = useQuery<Row[]>({
    queryKey: ["customer-deliveries", customerId],
    queryFn: () => fn({ data: { customer_id: customerId, limit: 100 } }) as any,
  });
  if (q.isLoading) return <div className="text-xs text-muted-foreground">লোড হচ্ছে...</div>;
  return <List rows={q.data ?? []} showInvoice />;
}