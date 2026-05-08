import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { PennylaneInvoice } from "@/hooks/usePennylane";

export const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function toNumber(v: string | number | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

export function formatDate(s: string | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("fr-FR");
  } catch {
    return s;
  }
}

export const InvoicesLoader = ({ rows = 4 }: { rows?: number }) => (
  <div className="flex flex-col gap-2 py-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-10 w-full rounded-md bg-muted/50 animate-pulse" />
    ))}
  </div>
);

function StatusBadge({ status }: { status?: string }) {
  if (!status) return null;
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    paid: { label: "Payée", variant: "default" },
    upcoming: { label: "À venir", variant: "secondary" },
    late: { label: "En retard", variant: "destructive" },
    draft: { label: "Brouillon", variant: "outline" },
    cancelled: { label: "Annulée", variant: "outline" },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function InvoiceRow({ inv, kind }: { inv: PennylaneInvoice; kind: "customer" | "supplier" }) {
  const amount = toNumber(inv.amount ?? inv.currency_amount);
  const remaining = toNumber(inv.remaining_amount);
  const counterpartName = kind === "customer" ? inv.customer?.name : inv.supplier?.name;
  const link = inv.public_url || inv.pdf_url;
  return (
    <tr className="border-b last:border-b-0 hover:bg-muted/30">
      <td className="py-2 px-3 text-sm font-mono">{inv.invoice_number || "—"}</td>
      <td className="py-2 px-3 text-sm">{counterpartName || inv.label || "—"}</td>
      <td className="py-2 px-3 text-sm text-muted-foreground">{formatDate(inv.date)}</td>
      <td className="py-2 px-3 text-sm text-right tabular-nums">{EUR.format(amount)}</td>
      <td className="py-2 px-3 text-sm text-right tabular-nums text-muted-foreground">
        {remaining > 0 ? EUR.format(remaining) : "—"}
      </td>
      <td className="py-2 px-3"><StatusBadge status={inv.status} /></td>
      <td className="py-2 px-3 text-right">
        {link ? (
          <a href={link} target="_blank" rel="noreferrer" className="inline-flex items-center text-primary hover:underline">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </td>
    </tr>
  );
}

interface InvoicesTableProps {
  invoices: PennylaneInvoice[];
  kind: "customer" | "supplier";
  loading: boolean;
}

export default function InvoicesTable({ invoices, kind, loading }: InvoicesTableProps) {
  if (loading) {
    return <InvoicesLoader rows={5} />;
  }
  if (!invoices.length) {
    return <p className="text-sm text-muted-foreground py-8 text-center">Aucune facture trouvée.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="py-2 px-3 font-medium">N°</th>
            <th className="py-2 px-3 font-medium">{kind === "customer" ? "Client" : "Fournisseur"}</th>
            <th className="py-2 px-3 font-medium">Date</th>
            <th className="py-2 px-3 font-medium text-right">Montant TTC</th>
            <th className="py-2 px-3 font-medium text-right">Restant dû</th>
            <th className="py-2 px-3 font-medium">Statut</th>
            <th className="py-2 px-3"></th>
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => <InvoiceRow key={String(inv.id)} inv={inv} kind={kind} />)}
        </tbody>
      </table>
    </div>
  );
}
