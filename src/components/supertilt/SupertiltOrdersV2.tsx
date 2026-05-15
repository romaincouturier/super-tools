/**
 * SupertiltOrdersV2 — tabs V2 (Bilan, Partenaires) and V3 (Dépenses, Stock)
 * Imported and composed into SupertiltOrders.tsx main page.
 */
import { useState, useEffect } from "react";
import {
  Euro, TrendingUp, Users, Package, Plus, Pencil, Trash2,
  Loader2, Download, Send, ExternalLink, CheckCircle, X,
  AlertTriangle, Copy, Eye, EyeOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  useFinancialSummary,
  usePartnerTokens,
  useCreatePartnerToken,
  useDeletePartnerToken,
  usePartnerPayments,
  useUpsertPartnerPayment,
  useUpdatePaymentStatus,
  useDeletePartnerPayment,
  useGameExpenses,
  useUpsertGameExpense,
  useDeleteGameExpense,
  useGamesFullCatalog,
  useUpsertGameFull,
  useGamesWithStockAlerts,
  useSendRestockEmail,
  useCsvExport,
  EXPENSE_TYPES,
  type GameFull,
  type PartnerAccessToken,
  type PartnerPayment,
  type GameExpense,
} from "@/hooks/useSupertiltOrders";
import {
  useGameAuthors,
  useUpsertGameAuthor,
  useDeleteGameAuthor,
  type GameAuthor,
} from "@/hooks/useDropshipping";

const EUR = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const DATE = (s: string) => new Date(s).toLocaleDateString("fr-FR");

// ── Helpers ──────────────────────────────────────────────────────

function getPortalUrl(token: string) {
  return `${window.location.origin}/partenaire/${token}`;
}

// ════════════════════════════════════════════════════════════════
// V2 — BILAN FINANCIER
// ════════════════════════════════════════════════════════════════

export function BilanTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [appliedFrom, setAppliedFrom] = useState<string | undefined>();
  const [appliedTo, setAppliedTo] = useState<string | undefined>();
  const { data: summary, isLoading } = useFinancialSummary(undefined, appliedFrom, appliedTo);
  const exportCsv = useCsvExport();

  const apply = () => { setAppliedFrom(from || undefined); setAppliedTo(to || undefined); };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const rows = summary ?? [];
  const totals = rows.reduce(
    (acc, r) => ({
      total_ttc: acc.total_ttc + r.total_ttc,
      total_commission: acc.total_commission + r.total_commission,
      total_expenses: acc.total_expenses + r.total_expenses,
      margin: acc.margin + r.margin,
    }),
    { total_ttc: 0, total_commission: 0, total_expenses: 0, margin: 0 },
  );

  const handleExport = () => {
    exportCsv(
      rows.map((r) => ({
        Jeu: r.title,
        Type: r.game_type,
        Ventes: r.sales_count,
        "CA TTC (€)": r.total_ttc.toFixed(2),
        "Commission (€)": r.total_commission.toFixed(2),
        "Dépenses (€)": r.total_expenses.toFixed(2),
        "Marge estimée (€)": r.margin.toFixed(2),
        "Commissions reversées (€)": r.total_paid.toFixed(2),
        "Restant à reverser (€)": r.commission_remaining.toFixed(2),
      })),
      "bilan-financier.csv",
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Du</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Au</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        <Button size="sm" onClick={apply}>Filtrer</Button>
        {(appliedFrom || appliedTo) && (
          <Button size="sm" variant="ghost" onClick={() => { setFrom(""); setTo(""); setAppliedFrom(undefined); setAppliedTo(undefined); }}>
            Effacer
          </Button>
        )}
        {rows.length > 0 && (
          <Button size="sm" variant="outline" onClick={handleExport} className="ml-auto">
            <Download className="h-4 w-4 mr-1" />CSV
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "CA TTC total", value: EUR(totals.total_ttc), icon: <Euro className="h-5 w-5 text-green-600" /> },
          { label: "Commissions totales", value: EUR(totals.total_commission), icon: <TrendingUp className="h-5 w-5 text-purple-600" /> },
          { label: "Dépenses totales", value: EUR(totals.total_expenses), icon: <Package className="h-5 w-5 text-red-600" /> },
          { label: "Marge estimée", value: EUR(totals.margin), icon: <TrendingUp className="h-5 w-5 text-blue-600" /> },
        ].map(({ label, value, icon }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              {icon}<div><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-game table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jeu</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Ventes</TableHead>
              <TableHead className="text-right">CA TTC</TableHead>
              <TableHead className="text-right">Commission</TableHead>
              <TableHead className="text-right">Dépenses</TableHead>
              <TableHead className="text-right">Marge est.</TableHead>
              <TableHead className="text-right">Reversé</TableHead>
              <TableHead className="text-right">Restant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!rows.length && (
              <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Aucune donnée</TableCell></TableRow>
            )}
            {rows.map((r) => (
              <TableRow key={r.game_id}>
                <TableCell className="font-medium">{r.title}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.game_type}</TableCell>
                <TableCell className="text-right text-sm">{r.sales_count}</TableCell>
                <TableCell className="text-right text-sm">{EUR(r.total_ttc)}</TableCell>
                <TableCell className="text-right text-sm text-purple-700">{EUR(r.total_commission)}</TableCell>
                <TableCell className="text-right text-sm text-red-700">{EUR(r.total_expenses)}</TableCell>
                <TableCell className={`text-right text-sm font-medium ${r.margin >= 0 ? "text-green-700" : "text-red-700"}`}>{EUR(r.margin)}</TableCell>
                <TableCell className="text-right text-sm text-green-700">{EUR(r.total_paid)}</TableCell>
                <TableCell className={`text-right text-sm font-medium ${r.commission_remaining > 0 ? "text-orange-700" : ""}`}>{EUR(r.commission_remaining)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// V2 — PARTENAIRES
// ════════════════════════════════════════════════════════════════

function PaymentDialog({
  payment,
  games,
  onClose,
}: {
  payment: Partial<PartnerPayment> | null;
  games: GameFull[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<PartnerPayment>>(
    payment ?? { status: "declared", declared_by: "admin" }
  );
  const { mutateAsync: upsert, isPending } = useUpsertPartnerPayment();
  const { toast } = useToast();

  const save = async () => {
    if (!form.game_id || !form.amount || !form.payment_date) return;
    try {
      await upsert(form as PartnerPayment & { game_id: string; amount: number; payment_date: string });
      toast({ title: "Encaissement sauvegardé" });
      onClose();
    } catch { toastError(toast, "Erreur lors de la sauvegarde"); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader><DialogTitle>{form.id ? "Modifier l'encaissement" : "Nouvel encaissement"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Jeu *</Label>
            <Select value={form.game_id ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, game_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un jeu" /></SelectTrigger>
              <SelectContent>
                {games.filter((g) => g.is_partner || g.game_type === "partner").map((g) => (
                  <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Montant (€) *</Label>
              <Input type="number" step="0.01" min="0" value={form.amount ?? ""} onChange={(e) => setForm((f) => ({ ...f, amount: parseFloat(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label>Date *</Label>
              <Input type="date" value={form.payment_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Commentaire</Label>
            <Input value={form.comment ?? ""} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} placeholder="Référence virement…" />
          </div>
          <div className="space-y-1">
            <Label>Statut</Label>
            <Select value={form.status ?? "declared"} onValueChange={(v) => setForm((f) => ({ ...f, status: v as PartnerPayment["status"] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="declared">Déclaré</SelectItem>
                <SelectItem value="verified">Vérifié</SelectItem>
                <SelectItem value="rejected">Rejeté</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {form.status === "rejected" && (
            <div className="space-y-1">
              <Label>Notes admin</Label>
              <Input value={form.admin_notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, admin_notes: e.target.value }))} placeholder="Raison du rejet…" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={isPending || !form.game_id || !form.amount || !form.payment_date}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sauvegarder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TokenRow({ token }: { token: PartnerAccessToken }) {
  const [visible, setVisible] = useState(false);
  const { mutateAsync: del } = useDeletePartnerToken();
  const { toast } = useToast();
  const url = getPortalUrl(token.token);

  const copy = () => {
    navigator.clipboard?.writeText(url);
    toast({ title: "Lien copié" });
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{(token.games as any)?.title ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground text-sm">{token.label ?? "—"}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate block">
            {visible ? url : `${url.slice(0, 30)}…`}
          </code>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setVisible((v) => !v)}>
            {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copy}><Copy className="h-3.5 w-3.5" /></Button>
          <a href={url} target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon" className="h-7 w-7"><ExternalLink className="h-3.5 w-3.5" /></Button>
          </a>
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">{token.expires_at ? DATE(token.expires_at) : "Jamais"}</TableCell>
      <TableCell>
        <Button variant="ghost" size="icon" onClick={async () => {
          if (!confirm("Révoquer ce lien ?")) return;
          try { await del(token.id); }
          catch { toastError(toast, "Erreur lors de la révocation"); }
        }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
      </TableCell>
    </TableRow>
  );
}

function NewTokenDialog({ games, onClose }: { games: GameFull[]; onClose: () => void }) {
  const [gameId, setGameId] = useState("");
  const [label, setLabel] = useState("");
  const [expires, setExpires] = useState("");
  const { mutateAsync: create, isPending } = useCreatePartnerToken();
  const { toast } = useToast();

  const save = async () => {
    if (!gameId) return;
    try {
      await create({ game_id: gameId, label: label || undefined, expires_at: expires || null });
      toast({ title: "Lien partenaire créé" });
      onClose();
    } catch { toastError(toast, "Erreur lors de la création"); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-md">
        <DialogHeader><DialogTitle>Créer un lien partenaire</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Jeu *</Label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un jeu" /></SelectTrigger>
              <SelectContent>
                {games.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Label (optionnel)</Label>
            <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="ex: Accès partenaire 2026" />
          </div>
          <div className="space-y-1">
            <Label>Date d'expiration (optionnelle)</Label>
            <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={isPending || !gameId}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PartenairesTab() {
  const { data: tokens, isLoading: loadingTokens } = usePartnerTokens();
  const { data: payments, isLoading: loadingPayments } = usePartnerPayments();
  const { data: games } = useGamesFullCatalog();
  const { mutateAsync: updateStatus } = useUpdatePaymentStatus();
  const { mutateAsync: delPayment } = useDeletePartnerPayment();
  const [showNewToken, setShowNewToken] = useState(false);
  const [editPayment, setEditPayment] = useState<Partial<PartnerPayment> | null | undefined>(undefined);
  const exportCsv = useCsvExport();
  const { toast } = useToast();

  const partnerGames = (games ?? []).filter((g) => g.is_partner || g.game_type === "partner");

  const handleExportPayments = () => {
    exportCsv(
      (payments ?? []).map((p) => ({
        Jeu: (p.games as any)?.title ?? p.game_id,
        Date: p.payment_date,
        "Montant (€)": p.amount.toFixed(2),
        Commentaire: p.comment ?? "",
        Statut: p.status,
        "Déclaré par": p.declared_by,
        "Notes admin": p.admin_notes ?? "",
      })),
      "encaissements-partenaires.csv",
    );
  };

  const statusVariant: Record<string, "outline" | "default" | "destructive"> = {
    declared: "outline",
    verified: "default",
    rejected: "destructive",
  };

  return (
    <div className="space-y-6">
      {/* Partner links */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Liens d'accès partenaires</CardTitle>
            <Button size="sm" onClick={() => setShowNewToken(true)}>
              <Plus className="h-4 w-4 mr-1" />Créer un lien
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingTokens ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jeu</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead>Lien</TableHead>
                    <TableHead>Expire le</TableHead>
                    <TableHead className="w-8" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!(tokens ?? []).length && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Aucun lien créé</TableCell></TableRow>
                  )}
                  {(tokens ?? []).map((t) => <TokenRow key={t.id} token={t} />)}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payments */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Encaissements</CardTitle>
            <div className="flex gap-2">
              {(payments ?? []).length > 0 && (
                <Button size="sm" variant="outline" onClick={handleExportPayments}>
                  <Download className="h-4 w-4 mr-1" />CSV
                </Button>
              )}
              <Button size="sm" onClick={() => setEditPayment({})}>
                <Plus className="h-4 w-4 mr-1" />Ajouter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPayments ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jeu</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                    <TableHead>Commentaire</TableHead>
                    <TableHead>Par</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="w-24" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!(payments ?? []).length && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Aucun encaissement</TableCell></TableRow>
                  )}
                  {(payments ?? []).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-sm font-medium">{(p.games as any)?.title ?? "—"}</TableCell>
                      <TableCell className="text-sm">{DATE(p.payment_date)}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{EUR(p.amount)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{p.comment ?? "—"}</TableCell>
                      <TableCell className="text-xs">{p.declared_by === "partner" ? "Partenaire" : "Admin"}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant[p.status] ?? "outline"} className="text-xs">
                          {p.status === "declared" ? "Déclaré" : p.status === "verified" ? "Vérifié" : "Rejeté"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {p.status === "declared" && (
                            <>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-green-700" title="Vérifier" onClick={async () => {
                                try { await updateStatus({ id: p.id, status: "verified" }); toast({ title: "Vérifié" }); }
                                catch { toastError(toast, "Erreur"); }
                              }}><CheckCircle className="h-3.5 w-3.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-700" title="Rejeter" onClick={async () => {
                                const note = window.prompt("Raison du rejet :");
                                if (note === null) return;
                                try { await updateStatus({ id: p.id, status: "rejected", admin_notes: note }); toast({ title: "Rejeté" }); }
                                catch { toastError(toast, "Erreur"); }
                              }}><X className="h-3.5 w-3.5" /></Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditPayment(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={async () => {
                            if (!confirm("Supprimer cet encaissement ?")) return;
                            try { await delPayment(p.id); }
                            catch { toastError(toast, "Erreur"); }
                          }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {showNewToken && <NewTokenDialog games={partnerGames.length ? partnerGames : (games ?? [])} onClose={() => setShowNewToken(false)} />}
      {editPayment !== undefined && <PaymentDialog payment={editPayment} games={partnerGames.length ? partnerGames : (games ?? [])} onClose={() => setEditPayment(undefined)} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// V3 — DÉPENSES
// ════════════════════════════════════════════════════════════════

function ExpenseDialog({ expense, games, onClose }: { expense: Partial<GameExpense> | null; games: GameFull[]; onClose: () => void }) {
  const [form, setForm] = useState<Partial<GameExpense>>(
    expense ?? { expense_type: "autre", vat_rate: 0.20, quantity: 1 }
  );
  const { mutateAsync: upsert, isPending } = useUpsertGameExpense();
  const { toast } = useToast();
  const set = (k: keyof GameExpense, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-compute amount_ttc from amount_ht + vat
  const computeTtc = (ht: number, vat: number) => Math.round(ht * (1 + vat) * 100) / 100;

  const save = async () => {
    if (!form.game_id || !form.expense_date || !form.expense_type) return;
    try {
      await upsert(form as GameExpense & { game_id: string; expense_date: string; expense_type: string });
      toast({ title: "Dépense sauvegardée" });
      onClose();
    } catch { toastError(toast, "Erreur lors de la sauvegarde"); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form.id ? "Modifier la dépense" : "Nouvelle dépense"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Jeu *</Label>
              <Select value={form.game_id ?? ""} onValueChange={(v) => set("game_id", v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  {games.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Date *</Label>
              <Input type="date" value={form.expense_date ?? ""} onChange={(e) => set("expense_date", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Type de dépense *</Label>
              <Select value={form.expense_type ?? "autre"} onValueChange={(v) => set("expense_type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="Détail de l'achat" />
            </div>
            <div className="space-y-1">
              <Label>Fournisseur</Label>
              <Input value={form.supplier ?? ""} onChange={(e) => set("supplier", e.target.value)} placeholder="Nom du fournisseur" />
            </div>
            <div className="space-y-1">
              <Label>URL fournisseur</Label>
              <Input value={form.supplier_url ?? ""} onChange={(e) => set("supplier_url", e.target.value)} placeholder="https://…" />
            </div>
            <div className="space-y-1">
              <Label>Acheté par</Label>
              <Input value={form.purchased_by ?? ""} onChange={(e) => set("purchased_by", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Quantité</Label>
              <Input type="number" min="0" step="1" value={form.quantity ?? 1} onChange={(e) => set("quantity", parseFloat(e.target.value) || 1)} />
            </div>
            <div className="space-y-1">
              <Label>Montant HT (€)</Label>
              <Input type="number" step="0.01" min="0" value={form.amount_ht ?? ""}
                onChange={(e) => {
                  const ht = parseFloat(e.target.value) || 0;
                  set("amount_ht", ht);
                  if (ht) set("amount_ttc", computeTtc(ht, form.vat_rate ?? 0.20));
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Taux TVA</Label>
              <Select value={String(form.vat_rate ?? 0.20)} onValueChange={(v) => {
                const vat = parseFloat(v);
                set("vat_rate", vat);
                if (form.amount_ht) set("amount_ttc", computeTtc(form.amount_ht, vat));
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0% (exonéré)</SelectItem>
                  <SelectItem value="0.055">5,5%</SelectItem>
                  <SelectItem value="0.10">10%</SelectItem>
                  <SelectItem value="0.20">20%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Montant TTC (€)</Label>
              <Input type="number" step="0.01" min="0" value={form.amount_ttc ?? ""}
                onChange={(e) => set("amount_ttc", parseFloat(e.target.value) || null)}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Commentaire</Label>
            <Textarea value={form.comment ?? ""} onChange={(e) => set("comment", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={isPending || !form.game_id || !form.expense_date}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sauvegarder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DepensesTab() {
  const { data: expenses, isLoading } = useGameExpenses();
  const { data: games } = useGamesFullCatalog();
  const { mutateAsync: del } = useDeleteGameExpense();
  const [editing, setEditing] = useState<Partial<GameExpense> | null | undefined>(undefined);
  const [filterGame, setFilterGame] = useState("");
  const exportCsv = useCsvExport();
  const { toast } = useToast();

  const filtered = (expenses ?? []).filter((e) => !filterGame || e.game_id === filterGame);
  const totalTtc = filtered.reduce((s, e) => s + (e.amount_ttc ?? 0), 0);
  const totalHt = filtered.reduce((s, e) => s + (e.amount_ht ?? 0), 0);

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterGame || "__all__"} onValueChange={(v) => setFilterGame(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Tous les jeux" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Tous les jeux</SelectItem>
            {(games ?? []).map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => exportCsv(
          filtered.map((e) => ({
            Jeu: (e.games as any)?.title ?? e.game_id,
            Date: e.expense_date,
            Type: e.expense_type,
            Description: e.description ?? "",
            Fournisseur: e.supplier ?? "",
            "URL": e.supplier_url ?? "",
            "Acheté par": e.purchased_by ?? "",
            "Montant HT (€)": (e.amount_ht ?? 0).toFixed(2),
            "TVA (%)": Math.round((e.vat_rate ?? 0) * 100),
            "Montant TTC (€)": (e.amount_ttc ?? 0).toFixed(2),
            Quantité: e.quantity,
            Commentaire: e.comment ?? "",
          })),
          "depenses.csv",
        )}>
          <Download className="h-4 w-4 mr-1" />CSV
        </Button>
        <Button size="sm" onClick={() => setEditing({})} className="ml-auto">
          <Plus className="h-4 w-4 mr-1" />Ajouter une dépense
        </Button>
      </div>

      {filtered.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card><CardContent className="p-4"><p className="text-xl font-bold">{EUR(totalTtc)}</p><p className="text-xs text-muted-foreground">Total TTC</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xl font-bold">{EUR(totalHt)}</p><p className="text-xs text-muted-foreground">Total HT</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xl font-bold">{filtered.length}</p><p className="text-xs text-muted-foreground">Lignes</p></CardContent></Card>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Jeu</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Fournisseur</TableHead>
              <TableHead className="text-right">Montant TTC</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!filtered.length && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune dépense enregistrée</TableCell></TableRow>
            )}
            {filtered.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-sm">{DATE(e.expense_date)}</TableCell>
                <TableCell className="text-sm font-medium">{(e.games as any)?.title ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{e.expense_type}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.description ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {e.supplier_url
                    ? <a href={e.supplier_url} target="_blank" rel="noopener noreferrer" className="underline">{e.supplier ?? e.supplier_url}</a>
                    : e.supplier ?? "—"}
                </TableCell>
                <TableCell className="text-right text-sm font-medium">{e.amount_ttc ? EUR(e.amount_ttc) : "—"}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(e)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={async () => {
                      if (!confirm("Supprimer cette dépense ?")) return;
                      try { await del(e.id); }
                      catch { toastError(toast, "Erreur"); }
                    }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {editing !== undefined && <ExpenseDialog expense={editing} games={games ?? []} onClose={() => setEditing(undefined)} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// V3 — STOCK & RÉAPPROVISIONNEMENT
// ════════════════════════════════════════════════════════════════

function StockEditDialog({ game, onClose }: { game: GameFull; onClose: () => void }) {
  const [form, setForm] = useState<Partial<GameFull>>(game);
  const { mutateAsync: upsert, isPending } = useUpsertGameFull();
  const { toast } = useToast();

  const set = (k: keyof GameFull, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    try {
      await upsert(form as GameFull & { title: string });
      toast({ title: "Stock mis à jour" });
      onClose();
    } catch { toastError(toast, "Erreur"); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Stock — {game.title}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Stock actuel</Label>
              <Input type="number" min="0" value={form.current_stock ?? ""} onChange={(e) => set("current_stock", e.target.value ? parseInt(e.target.value) : null)} />
            </div>
            <div className="space-y-1">
              <Label>Stock minimum</Label>
              <Input type="number" min="0" value={form.min_stock ?? ""} onChange={(e) => set("min_stock", e.target.value ? parseInt(e.target.value) : null)} />
            </div>
            <div className="space-y-1">
              <Label>Seuil réappro</Label>
              <Input type="number" min="0" value={form.restock_threshold ?? ""} onChange={(e) => set("restock_threshold", e.target.value ? parseInt(e.target.value) : null)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Éléments à commander</Label>
            <Textarea value={form.restock_items ?? ""} onChange={(e) => set("restock_items", e.target.value)} rows={3} placeholder="Liste des éléments nécessaires pour le réapprovisionnement…" />
          </div>
          <div className="space-y-1">
            <Label>Fournisseurs / URLs</Label>
            <Textarea value={form.restock_supplier_urls ?? ""} onChange={(e) => set("restock_supplier_urls", e.target.value)} rows={3} placeholder="URL 1 — https://…&#10;URL 2 — https://…" />
          </div>
          <div className="space-y-1">
            <Label>Email de contact réappro</Label>
            <Input value={form.restock_contact_email ?? ""} onChange={(e) => set("restock_contact_email", e.target.value)} placeholder="auteur@exemple.fr (laissez vide pour utiliser l'auteur du jeu)" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sauvegarder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RestockPreviewDialog({ gameId, onClose }: { gameId: string; onClose: () => void }) {
  const { mutateAsync: send } = useSendRestockEmail();
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    send({ game_id: gameId, preview: true })
      .then((d) => setPreview({ subject: d.subject ?? "", html: d.html ?? "" }))
      .catch(() => setPreview(null))
      .finally(() => setLoading(false));
  }, [gameId]);

  const doSend = async () => {
    setSending(true);
    try {
      await send({ game_id: gameId, preview: false });
      toast({ title: "Email de réapprovisionnement envoyé" });
      onClose();
    } catch (e: unknown) {
      toastError(toast, e instanceof Error ? e.message : "Erreur");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Aperçu email réapprovisionnement</DialogTitle></DialogHeader>
        {loading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}
        {!loading && preview && (
          <div className="space-y-3">
            <div className="p-3 bg-muted rounded">
              <p className="text-xs text-muted-foreground">Objet</p>
              <p className="font-medium text-sm">{preview.subject}</p>
            </div>
            <div className="border rounded p-3 text-sm prose max-w-none" dangerouslySetInnerHTML={{ __html: preview.html }} />
          </div>
        )}
        {!loading && !preview && (
          <p className="text-sm text-muted-foreground py-4 text-center">Impossible de générer l'aperçu. Vérifiez la configuration du jeu et le template.</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          {preview && (
            <Button onClick={doSend} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
              Envoyer
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StockRow({ game }: { game: GameFull }) {
  const [showEdit, setShowEdit] = useState(false);
  const [showRestock, setShowRestock] = useState(false);
  const isAlert = game.current_stock != null && game.min_stock != null && game.current_stock <= game.min_stock;

  return (
    <TableRow className={isAlert ? "bg-red-50/50" : ""}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          {isAlert && <AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />}
          {game.title}
        </div>
      </TableCell>
      <TableCell className={`text-right font-medium ${isAlert ? "text-red-700" : ""}`}>
        {game.current_stock ?? "—"}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">{game.min_stock ?? "—"}</TableCell>
      <TableCell className="text-right text-muted-foreground">{game.restock_threshold ?? "—"}</TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{game.restock_items ?? "—"}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowEdit(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1" />Modifier
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-blue-700" onClick={() => setShowRestock(true)}>
            <Send className="h-3.5 w-3.5 mr-1" />Email réappro
          </Button>
        </div>
        {showEdit && <StockEditDialog game={game} onClose={() => setShowEdit(false)} />}
        {showRestock && <RestockPreviewDialog gameId={game.id} onClose={() => setShowRestock(false)} />}
      </TableCell>
    </TableRow>
  );
}

export function StockTab() {
  const { data: games, isLoading: loadingGames } = useGamesFullCatalog();
  const { data: alerts } = useGamesWithStockAlerts();

  const gamesWithStock = (games ?? []).filter((g) => g.current_stock != null || g.min_stock != null);
  const gamesWithoutStock = (games ?? []).filter((g) => g.current_stock == null && g.min_stock == null);

  if (loadingGames) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {(alerts ?? []).length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="font-semibold text-red-800">{alerts!.length} jeu(x) en dessous du stock minimum</p>
          </div>
          <ul className="text-sm text-red-700 list-disc pl-5">
            {alerts!.map((g) => (
              <li key={g.id}>{g.title} — stock actuel : {g.current_stock}, minimum : {g.min_stock}</li>
            ))}
          </ul>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Stocks suivis</CardTitle></CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jeu</TableHead>
                  <TableHead className="text-right">Stock actuel</TableHead>
                  <TableHead className="text-right">Minimum</TableHead>
                  <TableHead className="text-right">Seuil réappro</TableHead>
                  <TableHead>Éléments</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!gamesWithStock.length && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Aucun jeu avec suivi de stock — configurez-les depuis le catalogue</TableCell></TableRow>
                )}
                {gamesWithStock.map((g) => <StockRow key={g.id} game={g} />)}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {gamesWithoutStock.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base text-muted-foreground">Jeux sans suivi de stock ({gamesWithoutStock.length})</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-3">Ouvrez la fiche jeu dans le catalogue pour configurer le stock.</p>
            <div className="flex flex-wrap gap-2">
              {gamesWithoutStock.map((g) => (
                <Badge key={g.id} variant="outline" className="text-xs">{g.title}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
