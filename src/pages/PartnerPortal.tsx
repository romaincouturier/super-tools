import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { todayAsISO } from "@/lib/dateFormatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Euro, TrendingUp, ShoppingCart, CreditCard, AlertTriangle } from "lucide-react";

const EUR = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const DATE = (s: string) => new Date(s).toLocaleDateString("fr-FR");

interface PortalData {
  game: {
    id: string;
    title: string;
    game_type: string;
    partner_name: string | null;
    commission_type: string | null;
    commission_rate: number | null;
    commission_fixed: number | null;
  };
  token_label: string | null;
  summary: {
    total_sales: number;
    total_ttc: number;
    total_commission: number;
    total_paid: number;
    remaining: number;
  };
  sales: Array<{
    id: string;
    quantity: number;
    line_total: number;
    commission_amount: number;
    created_at: string;
    woocommerce_orders: { order_number: string | null; date_created: string; customer_first_name?: string; customer_last_name?: string } | null;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    payment_date: string;
    comment: string | null;
    status: "declared" | "verified" | "rejected";
    declared_by: string;
  }>;
}

const PORTAL_FN = `${(supabase as any).functionsUrl ?? ""}/supertilt-partner-portal`;

function getPortalUrl(token: string, from?: string, to?: string) {
  // Use Supabase function URL from env
  const base = import.meta.env.VITE_SUPABASE_URL
    ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/supertilt-partner-portal`
    : PORTAL_FN;
  const params = new URLSearchParams({ token });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return `${base}?${params}`;
}

export default function PartnerPortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Payment declaration form
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(todayAsISO());
  const [payComment, setPayComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  const load = async (f?: string, t?: string) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(getPortalUrl(token, f, t));
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Erreur"); return; }
      setData(json as PortalData);
    } catch {
      setError("Impossible de charger les données. Vérifiez votre connexion.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [token]);

  const applyFilter = () => load(from || undefined, to || undefined);

  const submitPayment = async () => {
    if (!token || !payAmount || !payDate) return;
    setSubmitting(true);
    try {
      const base = import.meta.env.VITE_SUPABASE_URL
        ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/supertilt-partner-portal`
        : PORTAL_FN;
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          payment: { amount: parseFloat(payAmount), payment_date: payDate, comment: payComment || null },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur");
      setPaySuccess(true);
      setShowPaymentForm(false);
      setPayAmount("");
      setPayComment("");
      load(from || undefined, to || undefined);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Erreur lors de la déclaration");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <p className="font-semibold">Accès impossible</p>
            <p className="text-muted-foreground text-sm">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { game, summary, sales, payments } = data;
  const commissionLabel = game.commission_type === "percentage" && game.commission_rate != null
    ? `${Math.round(game.commission_rate * 100)}%`
    : game.commission_type === "fixed" && game.commission_fixed != null
    ? EUR(game.commission_fixed)
    : "Voir contrat";

  const statusLabel: Record<string, string> = {
    declared: "Déclaré",
    verified: "Vérifié",
    rejected: "Rejeté",
  };
  const statusVariant: Record<string, "outline" | "default" | "destructive"> = {
    declared: "outline",
    verified: "default",
    rejected: "destructive",
  };

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">{game.title}</h1>
          {(game.partner_name || data.token_label) && (
            <p className="text-muted-foreground">
              {game.partner_name ? `Partenaire : ${game.partner_name}` : ""}
              {data.token_label ? ` — ${data.token_label}` : ""}
            </p>
          )}
          <p className="text-sm text-muted-foreground">Commission : {commissionLabel}</p>
        </div>

        {/* Period filter */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Du</Label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Au</Label>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
              </div>
              <Button size="sm" onClick={applyFilter}>Filtrer</Button>
              {(from || to) && (
                <Button size="sm" variant="ghost" onClick={() => { setFrom(""); setTo(""); load(); }}>
                  Effacer
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Ventes", value: summary.total_sales, icon: <ShoppingCart className="h-5 w-5 text-blue-600" /> },
            { label: "CA TTC", value: EUR(summary.total_ttc), icon: <Euro className="h-5 w-5 text-green-600" /> },
            { label: "Commission totale", value: EUR(summary.total_commission), icon: <TrendingUp className="h-5 w-5 text-purple-600" /> },
            { label: "Restant à reverser", value: EUR(summary.remaining), icon: <CreditCard className="h-5 w-5 text-orange-600" /> },
          ].map(({ label, value, icon }) => (
            <Card key={label}>
              <CardContent className="p-4 flex items-center gap-3">
                {icon}
                <div>
                  <p className="text-xl font-bold">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Sales */}
        <Card>
          <CardHeader><CardTitle className="text-base">Historique des ventes</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Commande</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">CA TTC</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!sales.length && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Aucune vente sur cette période</TableCell></TableRow>
                  )}
                  {sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{s.woocommerce_orders?.date_created ? DATE(s.woocommerce_orders.date_created) : DATE(s.created_at)}</TableCell>
                      <TableCell className="text-sm font-mono">{s.woocommerce_orders?.order_number ?? "—"}</TableCell>
                      <TableCell className="text-right text-sm">{s.quantity}</TableCell>
                      <TableCell className="text-right text-sm">{EUR(s.line_total ?? 0)}</TableCell>
                      <TableCell className="text-right text-sm font-medium text-purple-700">{EUR(s.commission_amount ?? 0)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Payments */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Encaissements</CardTitle>
              <Button size="sm" onClick={() => setShowPaymentForm((v) => !v)}>
                {showPaymentForm ? "Annuler" : "Déclarer un encaissement"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {paySuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded text-green-800 text-sm">
                Encaissement déclaré — il sera vérifié par SuperTilt.
              </div>
            )}
            {showPaymentForm && (
              <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
                <p className="text-sm font-medium">Déclarer un encaissement</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Montant (€) *</Label>
                    <Input type="number" step="0.01" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Date *</Label>
                    <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs">Commentaire (optionnel)</Label>
                    <Input value={payComment} onChange={(e) => setPayComment(e.target.value)} placeholder="Référence virement, note…" />
                  </div>
                </div>
                <Button size="sm" onClick={submitPayment} disabled={submitting || !payAmount || !payDate}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Envoyer la déclaration
                </Button>
              </div>
            )}

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Commentaire</TableHead>
                    <TableHead>Déclaré par</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!payments.length && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Aucun encaissement enregistré</TableCell></TableRow>
                  )}
                  {payments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm">{DATE(p.payment_date)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{EUR(p.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.comment ?? "—"}</TableCell>
                      <TableCell className="text-sm">{p.declared_by === "partner" ? "Partenaire" : "SuperTilt"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[p.status] ?? "outline"} className="text-xs">
                          {statusLabel[p.status] ?? p.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="text-muted-foreground">Commission totale</span>
              <span className="font-medium">{EUR(summary.total_commission)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Encaissements vérifiés</span>
              <span className="font-medium text-green-700">− {EUR(summary.total_paid)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t pt-2">
              <span>Restant à reverser</span>
              <span className={summary.remaining > 0 ? "text-orange-700" : "text-green-700"}>{EUR(summary.remaining)}</span>
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground pb-8">
          Page sécurisée SuperTilt — données mises à jour en temps réel
        </p>
      </div>
    </div>
  );
}
