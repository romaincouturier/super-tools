import { useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle, TrendingUp, TrendingDown, Wallet, Clock, CheckCircle2 } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import KpiCard from "@/components/finance/KpiCard";
import InvoicesTable, { EUR, InvoicesLoader, toNumber, formatDate } from "@/components/finance/InvoicesTable";
import BreakEvenSimulator from "@/components/finance/BreakEvenSimulator";
import {
  useCustomerInvoices,
  useSupplierInvoices,
  useBankAccounts,
  usePennylaneMe,
} from "@/hooks/usePennylane";

function ComingSoon({ label }: { label: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
        <CardDescription>À venir.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">Cette section sera implémentée prochainement.</p>
      </CardContent>
    </Card>
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

        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="cashflow">Trésorerie prévisionnelle</TabsTrigger>
            <TabsTrigger value="breakeven">Point mort</TabsTrigger>
            <TabsTrigger value="report">Rapport mensuel</TabsTrigger>
            <TabsTrigger value="accounting">Comptabilité</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <ComingSoon label="Dashboard financier" />
          </TabsContent>

          <TabsContent value="cashflow" className="mt-4">
            <ComingSoon label="Trésorerie prévisionnelle" />
          </TabsContent>

          <TabsContent value="breakeven" className="mt-4">
            <BreakEvenSimulator />
          </TabsContent>

          <TabsContent value="report" className="mt-4">
            <ComingSoon label="Rapport de pilotage mensuel" />
          </TabsContent>

          <TabsContent value="accounting" className="mt-4 space-y-4">
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
                      <InvoicesLoader rows={3} />
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
          </TabsContent>
        </Tabs>
      </div>
    </ModuleLayout>
  );
}
