import { useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ExternalLink, AlertCircle, TrendingUp, TrendingDown, Wallet, Clock, CheckCircle2 } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import {
  useCustomerInvoices,
  useSupplierInvoices,
  useBankAccounts,
  usePennylaneMe,
  type PennylaneInvoice,
} from "@/hooks/usePennylane";

const Loader = ({ rows = 4 }: { rows?: number }) => (
  <div className="flex flex-col gap-2 py-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-10 w-full rounded-md bg-muted/50 animate-pulse" />
    ))}
  </div>
);

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

function toNumber(v: string | number | undefined): number {
  if (v === undefined || v === null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
}

function formatDate(s: string | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("fr-FR");
  } catch {
    return s;
  }
}

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

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  tone = "default",
}: {
  title: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "text-foreground";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
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

function InvoicesTable({ invoices, kind, loading }: { invoices: PennylaneInvoice[]; kind: "customer" | "supplier"; loading: boolean }) {
  if (loading) {
    return <Loader rows={5} />;
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

export default function Finances() {
  const customerQ = useCustomerInvoices({ limit: 100 });
  const supplierQ = useSupplierInvoices({ limit: 100 });
  const banksQ = useBankAccounts();
  const meQ = usePennylaneMe();

  const customers = customerQ.data?.items ?? [];
  const suppliers = supplierQ.data?.items ?? [];
  const banks = banksQ.data?.items ?? [];
  const isEmptyPennylane = !customerQ.isLoading && !supplierQ.isLoading && !banksQ.isLoading &&
    customers.length === 0 && suppliers.length === 0 && banks.length === 0;
  const companyName = meQ.data?.company?.name;
  const isSandbox = companyName?.toLowerCase().includes("sandbox");

  const error = customerQ.error || supplierQ.error || banksQ.error || meQ.error;
  const tokenMissing = error?.message?.toLowerCase().includes("pennylane non configuré") ||
    error?.message?.toLowerCase().includes("token api pennylane");

  const kpis = useMemo(() => {
    const revenuePaid = customers
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + toNumber(i.amount), 0);
    const revenueOpen = customers
      .filter((i) => i.status !== "paid" && i.status !== "cancelled" && i.status !== "draft")
      .reduce((s, i) => s + toNumber(i.remaining_amount ?? i.amount), 0);
    const revenueLate = customers
      .filter((i) => i.status === "late")
      .reduce((s, i) => s + toNumber(i.remaining_amount ?? i.amount), 0);
    const expenses = suppliers.reduce((s, i) => s + toNumber(i.amount), 0);
    const cash = banks.reduce((s, b) => s + toNumber(b.balance), 0);
    return { revenuePaid, revenueOpen, revenueLate, expenses, cash };
  }, [customers, suppliers, banks]);

  return (
    <ModuleLayout>
      <div className="container mx-auto p-6 space-y-6">
        <PageHeader
          icon={Wallet}
          title="Finances"
          subtitle="Vue consolidée Pennylane : revenus, dépenses, trésorerie."
        />

        {tokenMissing && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Token Pennylane manquant</AlertTitle>
            <AlertDescription>
              Renseigne ton token API Pennylane dans <a href="/parametres" className="underline font-medium">Paramètres → Intégrations → Pennylane</a>.
            </AlertDescription>
          </Alert>
        )}

        {error && !tokenMissing && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erreur Pennylane</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {!error && isEmptyPennylane && companyName && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Aucune donnée renvoyée par Pennylane</AlertTitle>
            <AlertDescription>
              Le token est connecté à « {companyName} »{isSandbox ? " (environnement Sandbox)" : ""}, mais Pennylane renvoie 0 facture et 0 compte bancaire. Utilise un token du compte de production si tu veux afficher les données réelles.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard title="Trésorerie" value={EUR.format(kpis.cash)} icon={Wallet} hint={`${banks.length} compte(s)`} />
          <KpiCard title="CA encaissé" value={EUR.format(kpis.revenuePaid)} icon={CheckCircle2} tone="positive" />
          <KpiCard title="CA en attente" value={EUR.format(kpis.revenueOpen)} icon={Clock} hint="Factures non payées" />
          <KpiCard title="CA en retard" value={EUR.format(kpis.revenueLate)} icon={TrendingDown} tone="negative" />
          <KpiCard title="Dépenses" value={EUR.format(kpis.expenses)} icon={TrendingUp} tone="negative" hint="Factures fournisseurs" />
        </div>

        <Tabs defaultValue="customers" className="w-full">
          <TabsList>
            <TabsTrigger value="customers">Factures clients</TabsTrigger>
            <TabsTrigger value="suppliers">Factures fournisseurs</TabsTrigger>
            <TabsTrigger value="banks">Trésorerie</TabsTrigger>
          </TabsList>

          <TabsContent value="customers" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Factures clients</CardTitle>
                <CardDescription>Les 100 dernières factures émises (Pennylane).</CardDescription>
              </CardHeader>
              <CardContent>
                <InvoicesTable invoices={customers} kind="customer" loading={customerQ.isLoading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="suppliers" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Factures fournisseurs</CardTitle>
                <CardDescription>Les 100 dernières factures d'achat.</CardDescription>
              </CardHeader>
              <CardContent>
                <InvoicesTable invoices={suppliers} kind="supplier" loading={supplierQ.isLoading} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="banks" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Comptes bancaires</CardTitle>
                <CardDescription>Soldes des comptes synchronisés dans Pennylane.</CardDescription>
              </CardHeader>
              <CardContent>
                {banksQ.isLoading ? (
                  <Loader rows={3} />
                ) : banks.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">Aucun compte bancaire trouvé.</p>
                ) : (
                  <div className="space-y-2">
                    {banks.map((b) => (
                      <div key={String(b.id)} className="flex items-center justify-between p-3 rounded-md border">
                        <div>
                          <div className="font-medium">{b.name || b.bank_name || "Compte"}</div>
                          {b.iban && <div className="text-xs text-muted-foreground font-mono">{b.iban}</div>}
                          {b.last_sync_at && (
                            <div className="text-xs text-muted-foreground">Dernière synchro : {formatDate(b.last_sync_at)}</div>
                          )}
                        </div>
                        <div className="text-lg font-semibold tabular-nums">{EUR.format(toNumber(b.balance))}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ModuleLayout>
  );
}
