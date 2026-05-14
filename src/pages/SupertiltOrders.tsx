import { useState } from "react";
import {
  LayoutGrid, Package, ShoppingCart, Settings, Mail, AlertTriangle,
  CheckCircle, Clock, Truck, RefreshCw, Ban, Loader2, Plus,
  Pencil, Trash2, Send, Eye, FileText, Search, Download,
  Euro, Users, BarChart3,
} from "lucide-react";
import { BilanTab, PartenairesTab, DepensesTab, StockTab } from "@/components/supertilt/SupertiltOrdersV2";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  KANBAN_COLUMNS,
  useAllOrderItems,
  useUpdateOrderItemStatus,
  useValidateOrderItem,
  useSendOrderEmail,
  useGamesFullCatalog,
  useUpsertGameFull,
  useDeleteGameFull,
  useAuthorsFullList,
  useUpsertAuthorFull,
  useEmailTemplates,
  useUpsertEmailTemplate,
  useEmailLog,
  useSupertiltSettings,
  useUpsertSupertiltSetting,
  useOrderKpis,
  useCsvExport,
  type GameFull,
  type GameAuthorFull,
  type OrderItem,
  type EmailTemplate,
  type KanbanStatus,
  type GameType,
} from "@/hooks/useSupertiltOrders";

// ── Helpers ────────────────────────────────────────────────────────

const EUR = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const DATE = (s: string) => new Date(s).toLocaleDateString("fr-FR");

const GAME_TYPE_LABELS: Record<GameType, string> = {
  supertilt: "SuperTilt",
  dropshipping: "Dropshipping",
  location: "Location",
  partner: "Partenaire",
};

const GAME_TYPE_COLORS: Record<GameType, string> = {
  supertilt: "bg-blue-100 text-blue-800",
  dropshipping: "bg-purple-100 text-purple-800",
  location: "bg-orange-100 text-orange-800",
  partner: "bg-green-100 text-green-800",
};

const KANBAN_ICONS: Record<KanbanStatus, React.ReactNode> = {
  to_validate: <AlertTriangle className="h-3.5 w-3.5 text-yellow-600" />,
  received: <Clock className="h-3.5 w-3.5 text-blue-600" />,
  to_ship: <Truck className="h-3.5 w-3.5 text-indigo-600" />,
  dropshipping: <RefreshCw className="h-3.5 w-3.5 text-purple-600" />,
  location_pending: <FileText className="h-3.5 w-3.5 text-orange-600" />,
  processed: <CheckCircle className="h-3.5 w-3.5 text-green-600" />,
  blocked: <Ban className="h-3.5 w-3.5 text-red-600" />,
};

// ── KPI Dashboard ──────────────────────────────────────────────────

function Dashboard() {
  const { data: kpis, isLoading } = useOrderKpis();
  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const stats = [
    { label: "Lignes totales", value: kpis?.count ?? 0, icon: <ShoppingCart className="h-5 w-5 text-blue-600" /> },
    { label: "À valider", value: kpis?.toValidate ?? 0, icon: <AlertTriangle className="h-5 w-5 text-yellow-600" /> },
    { label: "Traitées", value: kpis?.processed ?? 0, icon: <CheckCircle className="h-5 w-5 text-green-600" /> },
    { label: "Bloquées", value: kpis?.blocked ?? 0, icon: <Ban className="h-5 w-5 text-red-600" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              {icon}
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {kpis?.byStatus && (
        <Card>
          <CardHeader><CardTitle className="text-base">Répartition par colonne kanban</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {KANBAN_COLUMNS.map(({ key, label }) => {
                const count = kpis.byStatus[key] ?? 0;
                const pct = kpis.count ? Math.round((count / kpis.count) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    {KANBAN_ICONS[key]}
                    <span className="text-sm w-48 truncate">{label}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Order Item Card ───────────────────────────────────────────────

function ItemDetailDialog({ item, onClose }: { item: OrderItem; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Commande #{(item.woocommerce_orders as any)?.order_number ?? item.wc_order_id} — {item.product_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-muted-foreground">Produit WC</span><p className="font-medium">{item.product_name} (ID #{item.wc_product_id})</p></div>
            <div><span className="text-muted-foreground">Quantité</span><p className="font-medium">{item.quantity}</p></div>
            <div><span className="text-muted-foreground">Jeu identifié</span><p className="font-medium">{(item.games as any)?.title ?? "—"}</p></div>
            <div><span className="text-muted-foreground">Type</span><p className="font-medium">{item.game_type ? GAME_TYPE_LABELS[item.game_type] : "—"}</p></div>
            <div><span className="text-muted-foreground">Total ligne</span><p className="font-medium">{item.line_total ? EUR(item.line_total) : "—"}</p></div>
            <div><span className="text-muted-foreground">Email envoyé</span><p className="font-medium">{item.email_sent_at ? DATE(item.email_sent_at) : "Non"}</p></div>
          </div>
          {item.block_reason && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800">
              <strong>Blocage :</strong> {item.block_reason}
            </div>
          )}
          {item.notes && (
            <div><span className="text-muted-foreground">Notes</span><p>{item.notes}</p></div>
          )}
          <details>
            <summary className="cursor-pointer text-muted-foreground font-medium">Trame WooCommerce brute</summary>
            <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-64">
              {JSON.stringify(item.raw_line_item ?? {}, null, 2)}
            </pre>
          </details>
          {item.woocommerce_orders && (
            <details>
              <summary className="cursor-pointer text-muted-foreground font-medium">Commande WooCommerce complète</summary>
              <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-auto max-h-64">
                {JSON.stringify((item.woocommerce_orders as any).raw_order ?? {}, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ValidateItemDialog({
  item,
  games,
  onClose,
}: {
  item: OrderItem;
  games: GameFull[];
  onClose: () => void;
}) {
  const [gameId, setGameId] = useState(item.game_id ?? "");
  const { mutateAsync: validate, isPending } = useValidateOrderItem();
  const { toast } = useToast();

  const save = async () => {
    if (!gameId) return;
    try {
      await validate({ id: item.id, game_id: gameId });
      toast({ title: "Ligne validée" });
      onClose();
    } catch {
      toastError(toast, "Erreur lors de la validation");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Valider la ligne de commande</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Produit WooCommerce : <strong>{item.product_name}</strong> (ID #{item.wc_product_id})
          </p>
          <div className="space-y-1">
            <Label>Rattacher à un jeu du catalogue</Label>
            <Select value={gameId} onValueChange={setGameId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un jeu" /></SelectTrigger>
              <SelectContent>
                {games.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {g.title} — {GAME_TYPE_LABELS[g.game_type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={isPending || !gameId}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Valider"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NoteDialog({ item, onClose }: { item: OrderItem; onClose: () => void }) {
  const [notes, setNotes] = useState(item.notes ?? "");
  const { mutateAsync: update, isPending } = useUpdateOrderItemStatus();
  const { toast } = useToast();

  const save = async () => {
    try {
      await update({ id: item.id, notes });
      toast({ title: "Note sauvegardée" });
      onClose();
    } catch {
      toastError(toast, "Erreur");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Note interne</DialogTitle></DialogHeader>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Ajoutez une note…" />
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

function KanbanCard({ item, games }: { item: OrderItem; games: GameFull[] }) {
  const [showDetail, setShowDetail] = useState(false);
  const [showValidate, setShowValidate] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const { mutateAsync: updateStatus, isPending: updatingStatus } = useUpdateOrderItemStatus();
  const { mutateAsync: sendEmail, isPending: sendingEmail } = useSendOrderEmail();
  const { toast } = useToast();

  const order = item.woocommerce_orders as any;
  const customerName = order
    ? [order.customer_first_name, order.customer_last_name].filter(Boolean).join(" ") || order.customer_email
    : `Commande #${item.wc_order_id}`;

  const handleMarkProcessed = async () => {
    try {
      await updateStatus({ id: item.id, kanban_status: "processed" });
      toast({ title: "Marqué comme traité" });
    } catch { toastError(toast, "Erreur"); }
  };

  const handleMarkBlocked = async () => {
    const reason = window.prompt("Raison du blocage :");
    if (reason === null) return;
    try {
      await updateStatus({ id: item.id, kanban_status: "blocked", block_reason: reason || "Bloqué manuellement" });
      toast({ title: "Ligne bloquée" });
    } catch { toastError(toast, "Erreur"); }
  };

  const handleSendEmail = async () => {
    try {
      await sendEmail(item.id);
      toast({ title: "Email envoyé" });
    } catch (e: any) { toastError(toast, e?.message || "Erreur envoi email"); }
  };

  return (
    <div className="bg-background border rounded-lg p-3 space-y-2 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{item.product_name ?? `Produit #${item.wc_product_id}`}</p>
          <p className="text-xs text-muted-foreground">Cmd #{order?.order_number ?? item.wc_order_id}</p>
        </div>
        {item.game_type && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${GAME_TYPE_COLORS[item.game_type]}`}>
            {GAME_TYPE_LABELS[item.game_type]}
          </span>
        )}
      </div>

      <div className="text-xs text-muted-foreground space-y-0.5">
        <p>{customerName}</p>
        {order?.date_created && <p>{DATE(order.date_created)}</p>}
        <p>Qté : {item.quantity}{item.line_total ? ` — ${EUR(item.line_total)}` : ""}</p>
        {(item.games as any)?.title && <p>Jeu : {(item.games as any).title}</p>}
      </div>

      {item.block_reason && (
        <p className="text-xs text-red-700 bg-red-50 p-1.5 rounded border border-red-200">{item.block_reason}</p>
      )}

      {item.notes && (
        <p className="text-xs text-muted-foreground italic border-l-2 pl-2">{item.notes}</p>
      )}

      <div className="flex flex-wrap gap-1 pt-1">
        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setShowDetail(true)}>
          <Eye className="h-3 w-3 mr-1" />Voir
        </Button>
        {item.kanban_status === "to_validate" && (
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-green-700" onClick={() => setShowValidate(true)}>
            <CheckCircle className="h-3 w-3 mr-1" />Valider
          </Button>
        )}
        {item.kanban_status !== "processed" && item.kanban_status !== "blocked" && item.game_id && (
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-blue-700" onClick={handleSendEmail} disabled={sendingEmail}>
            {sendingEmail ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
            Email
          </Button>
        )}
        {item.kanban_status !== "processed" && item.kanban_status !== "blocked" && (
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={handleMarkProcessed} disabled={updatingStatus}>
            <CheckCircle className="h-3 w-3 mr-1" />Traité
          </Button>
        )}
        <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setShowNote(true)}>
          <FileText className="h-3 w-3 mr-1" />Note
        </Button>
        {item.kanban_status !== "blocked" && (
          <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-red-700" onClick={handleMarkBlocked}>
            <Ban className="h-3 w-3 mr-1" />Bloquer
          </Button>
        )}
      </div>

      {showDetail && <ItemDetailDialog item={item} onClose={() => setShowDetail(false)} />}
      {showValidate && <ValidateItemDialog item={item} games={games} onClose={() => setShowValidate(false)} />}
      {showNote && <NoteDialog item={item} onClose={() => setShowNote(false)} />}
    </div>
  );
}

// ── Kanban ─────────────────────────────────────────────────────────

function Kanban() {
  const { data: items, isLoading } = useAllOrderItems();
  const { data: games } = useGamesFullCatalog();
  const [search, setSearch] = useState("");

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const filter = search.toLowerCase();
  const filtered = (items ?? []).filter((i) => {
    if (!filter) return true;
    const order = i.woocommerce_orders as any;
    return (
      i.product_name?.toLowerCase().includes(filter) ||
      (i.games as any)?.title?.toLowerCase().includes(filter) ||
      String(i.wc_order_id).includes(filter) ||
      order?.customer_email?.toLowerCase().includes(filter) ||
      [order?.customer_first_name, order?.customer_last_name].join(" ").toLowerCase().includes(filter)
    );
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 items-start">
        {KANBAN_COLUMNS.map(({ key, label }) => {
          const colItems = filtered.filter((i) => i.kanban_status === key);
          return (
            <div key={key} className="bg-muted/40 rounded-lg p-3 space-y-2 min-h-[100px]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {KANBAN_ICONS[key]}
                  <span className="text-sm font-semibold">{label}</span>
                </div>
                <Badge variant="secondary" className="text-xs">{colItems.length}</Badge>
              </div>
              {colItems.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">Vide</p>
              )}
              {colItems.map((item) => (
                <KanbanCard key={item.id} item={item} games={games ?? []} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Game Form Dialog ───────────────────────────────────────────────

function GameDialog({
  game,
  authors,
  onClose,
}: {
  game: Partial<GameFull> | null;
  authors: GameAuthorFull[];
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<GameFull>>(
    game ?? { game_type: "dropshipping", status: "active", is_partner: false, include_stripe_fees: false }
  );
  const { mutateAsync: upsert, isPending } = useUpsertGameFull();
  const { toast } = useToast();

  const set = (k: keyof GameFull, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.title) return;
    try {
      await upsert(form as GameFull & { title: string });
      toast({ title: "Jeu sauvegardé" });
      onClose();
    } catch { toastError(toast, "Erreur lors de la sauvegarde"); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form.id ? "Modifier le jeu" : "Nouveau jeu"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {/* Infos générales */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Informations générales</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label>Titre *</Label>
                <Input value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="Nom du jeu" />
              </div>
              <div className="space-y-1">
                <Label>Type de jeu</Label>
                <Select value={form.game_type ?? "dropshipping"} onValueChange={(v) => set("game_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supertilt">Jeu SuperTilt</SelectItem>
                    <SelectItem value="dropshipping">Dropshipping</SelectItem>
                    <SelectItem value="location">Location</SelectItem>
                    <SelectItem value="partner">Partenaire / co-créé</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Statut</Label>
                <Select value={form.status ?? "active"} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Actif</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                    <SelectItem value="to_check">À vérifier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>ID produit WooCommerce</Label>
                <Input type="number" value={form.woocommerce_product_id ?? ""} onChange={(e) => set("woocommerce_product_id", e.target.value ? parseInt(e.target.value) : null)} placeholder="Ex: 1234" />
              </div>
              <div className="space-y-1">
                <Label>URL produit WooCommerce</Label>
                <Input value={form.woocommerce_product_url ?? ""} onChange={(e) => set("woocommerce_product_url", e.target.value)} placeholder="https://…" />
              </div>
            </div>
          </div>

          {/* Auteur */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Auteur / Fournisseur</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Auteur</Label>
                <Select value={form.author_id ?? ""} onValueChange={(v) => set("author_id", v || null)}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucun</SelectItem>
                    {authors.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Email secondaire (copie)</Label>
                <Input value={form.secondary_author_email ?? ""} onChange={(e) => set("secondary_author_email", e.target.value)} placeholder="cc@exemple.fr" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Message personnalisé</Label>
                <Textarea value={form.custom_message ?? ""} onChange={(e) => set("custom_message", e.target.value)} rows={2} placeholder="Message inclus dans les emails automatiques" />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Instructions de traitement</Label>
                <Textarea value={form.processing_instructions ?? ""} onChange={(e) => set("processing_instructions", e.target.value)} rows={2} placeholder="Notes internes sur le traitement de ce jeu" />
              </div>
            </div>
          </div>

          {/* Partenariat */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Partenariat</h3>
            <div className="flex items-center gap-3">
              <Switch checked={form.is_partner ?? false} onCheckedChange={(v) => set("is_partner", v)} />
              <Label>Jeu en partenariat</Label>
            </div>
            {form.is_partner && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Nom du partenaire</Label>
                  <Input value={form.partner_name ?? ""} onChange={(e) => set("partner_name", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Email du partenaire</Label>
                  <Input value={form.partner_email ?? ""} onChange={(e) => set("partner_email", e.target.value)} />
                </div>
              </div>
            )}
          </div>

          {/* Commission */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Commission</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Type de commission</Label>
                <Select value={form.commission_type ?? "percentage"} onValueChange={(v) => set("commission_type", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Pourcentage</SelectItem>
                    <SelectItem value="fixed">Montant fixe</SelectItem>
                    <SelectItem value="formula">Formule personnalisée</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.commission_type === "percentage" && (
                <div className="space-y-1">
                  <Label>Taux (%)</Label>
                  <Input type="number" min="0" max="100" step="0.5"
                    value={form.commission_rate != null ? Math.round(form.commission_rate * 1000) / 10 : ""}
                    onChange={(e) => set("commission_rate", e.target.value ? parseFloat(e.target.value) / 100 : null)}
                  />
                </div>
              )}
              {form.commission_type === "fixed" && (
                <div className="space-y-1">
                  <Label>Montant fixe (€)</Label>
                  <Input type="number" min="0" step="0.01"
                    value={form.commission_fixed ?? ""}
                    onChange={(e) => set("commission_fixed", e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </div>
              )}
              {form.commission_type === "formula" && (
                <div className="col-span-2 space-y-1">
                  <Label>Formule</Label>
                  <Input value={form.commission_formula ?? ""} onChange={(e) => set("commission_formula", e.target.value)} placeholder="ex: total * 0.15 - 2" />
                </div>
              )}
              <div className="col-span-2 flex items-center gap-3">
                <Switch checked={form.include_stripe_fees ?? false} onCheckedChange={(v) => set("include_stripe_fees", v)} />
                <Label>Déduire les frais Stripe avant calcul</Label>
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={isPending || !form.title}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sauvegarder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Catalog ────────────────────────────────────────────────────────

function Catalog() {
  const { data: games, isLoading } = useGamesFullCatalog();
  const { data: authors } = useAuthorsFullList();
  const { mutateAsync: del } = useDeleteGameFull();
  const [editing, setEditing] = useState<Partial<GameFull> | null | undefined>(undefined);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const filtered = (games ?? []).filter((g) =>
    !search || g.title.toLowerCase().includes(search.toLowerCase())
  );

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher un jeu…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button size="sm" onClick={() => setEditing({})}>
          <Plus className="h-4 w-4 mr-1" />Ajouter un jeu
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Jeu</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Auteur</TableHead>
              <TableHead>ID WC</TableHead>
              <TableHead>Commission</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!filtered.length && (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucun jeu</TableCell></TableRow>
            )}
            {filtered.map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">{g.title}</TableCell>
                <TableCell>
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${GAME_TYPE_COLORS[g.game_type]}`}>
                    {GAME_TYPE_LABELS[g.game_type]}
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{(g.game_authors as any)?.name ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{g.woocommerce_product_id ?? "—"}</TableCell>
                <TableCell className="text-sm">
                  {g.commission_type === "percentage" && g.commission_rate != null
                    ? `${Math.round(g.commission_rate * 100)}%`
                    : g.commission_type === "fixed" && g.commission_fixed != null
                    ? EUR(g.commission_fixed)
                    : g.commission_type === "formula"
                    ? "Formule"
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={g.status === "active" ? "default" : g.status === "to_check" ? "outline" : "secondary"} className="text-xs">
                    {g.status === "active" ? "Actif" : g.status === "to_check" ? "À vérifier" : "Inactif"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={async () => {
                      if (!confirm("Supprimer ce jeu ?")) return;
                      try { await del(g.id); }
                      catch { toastError(toast, "Erreur lors de la suppression"); }
                    }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {editing !== undefined && <GameDialog game={editing} authors={authors ?? []} onClose={() => setEditing(undefined)} />}
    </>
  );
}

// ── Sales list ─────────────────────────────────────────────────────

function Sales() {
  const { data: items, isLoading } = useAllOrderItems();
  const [search, setSearch] = useState("");
  const exportCsv = useCsvExport();

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const processed = (items ?? []).filter((i) => i.kanban_status === "processed" || i.email_sent_at);
  const filtered = processed.filter((i) => {
    if (!search) return true;
    const order = i.woocommerce_orders as any;
    return (
      i.product_name?.toLowerCase().includes(search.toLowerCase()) ||
      (i.games as any)?.title?.toLowerCase().includes(search.toLowerCase()) ||
      order?.customer_email?.toLowerCase().includes(search.toLowerCase()) ||
      String(i.wc_order_id).includes(search)
    );
  });

  const handleExport = () => exportCsv(
    filtered.map((i) => {
      const order = i.woocommerce_orders as any;
      return {
        Date: order?.date_created ? DATE(order.date_created) : "",
        "Commande #": order?.order_number ?? i.wc_order_id,
        Jeu: (i.games as any)?.title ?? i.product_name ?? "",
        Client: [order?.customer_first_name, order?.customer_last_name].filter(Boolean).join(" ") || order?.customer_email || "",
        "Email client": order?.customer_email ?? "",
        Quantité: i.quantity,
        "Total TTC (€)": (i.line_total ?? 0).toFixed(2),
        "Commission (€)": (i.commission_amount ?? 0).toFixed(2),
        Type: i.game_type ?? "",
        "Email envoyé le": i.email_sent_at ? DATE(i.email_sent_at) : "",
        "Email envoyé à": i.email_sent_to ?? "",
      };
    }),
    "ventes-supertilt.csv",
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {filtered.length > 0 && (
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-1" />CSV
          </Button>
        )}
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Cmd #</TableHead>
              <TableHead>Jeu</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Qté</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Email</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!filtered.length && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Aucune vente traitée</TableCell></TableRow>
            )}
            {filtered.map((i) => {
              const order = i.woocommerce_orders as any;
              return (
                <TableRow key={i.id}>
                  <TableCell className="text-sm">{order?.date_created ? DATE(order.date_created) : "—"}</TableCell>
                  <TableCell className="text-sm font-mono">{order?.order_number ?? i.wc_order_id}</TableCell>
                  <TableCell className="text-sm font-medium">{(i.games as any)?.title ?? i.product_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[order?.customer_first_name, order?.customer_last_name].filter(Boolean).join(" ") || order?.customer_email || "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">{i.quantity}</TableCell>
                  <TableCell className="text-right text-sm">{i.line_total ? EUR(i.line_total) : "—"}</TableCell>
                  <TableCell>
                    {i.game_type && (
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${GAME_TYPE_COLORS[i.game_type]}`}>
                        {GAME_TYPE_LABELS[i.game_type]}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {i.email_sent_at ? DATE(i.email_sent_at) : "Non"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ── Email log ──────────────────────────────────────────────────────

function EmailLogTab() {
  const { data: logs, isLoading } = useEmailLog();

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Cmd #</TableHead>
            <TableHead>Jeu / Produit</TableHead>
            <TableHead>Template</TableHead>
            <TableHead>Destinataire(s)</TableHead>
            <TableHead>Statut</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {!(logs ?? []).length && (
            <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Aucun email envoyé</TableCell></TableRow>
          )}
          {(logs ?? []).map((l) => (
            <TableRow key={l.id}>
              <TableCell className="text-sm">{DATE(l.sent_at)}</TableCell>
              <TableCell className="text-sm font-mono">{l.wc_order_id ?? "—"}</TableCell>
              <TableCell className="text-sm">{(l.order_items as any)?.games?.title ?? (l.order_items as any)?.product_name ?? "—"}</TableCell>
              <TableCell><Badge variant="outline" className="text-xs">{l.template_key ?? "—"}</Badge></TableCell>
              <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{l.sent_to?.join(", ") ?? "—"}</TableCell>
              <TableCell>
                <Badge variant={l.status === "sent" ? "default" : "destructive"} className="text-xs">
                  {l.status === "sent" ? "Envoyé" : "Échec"}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ── Email Templates ────────────────────────────────────────────────

function TemplateEditor({ tpl, onClose }: { tpl: Partial<EmailTemplate>; onClose: () => void }) {
  const [form, setForm] = useState<Partial<EmailTemplate>>(tpl);
  const { mutateAsync: upsert, isPending } = useUpsertEmailTemplate();
  const { toast } = useToast();

  const save = async () => {
    if (!form.template_key || !form.subject) return;
    try {
      await upsert(form as EmailTemplate & { template_key: string });
      toast({ title: "Template sauvegardé" });
      onClose();
    } catch { toastError(toast, "Erreur lors de la sauvegarde"); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form.id ? "Modifier le template" : "Nouveau template"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Clé (unique)</Label>
              <Input value={form.template_key ?? ""} onChange={(e) => setForm((f) => ({ ...f, template_key: e.target.value }))} placeholder="ex: dropshipping" disabled={!!form.id} />
            </div>
            <div className="space-y-1">
              <Label>Nom affiché</Label>
              <Input value={form.name ?? ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Sujet</Label>
            <Input value={form.subject ?? ""} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Objet de l'email — supports {{variables}}" />
          </div>
          <div className="space-y-1">
            <Label>Corps (HTML)</Label>
            <Textarea value={form.body ?? ""} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} rows={12} placeholder="Corps HTML de l'email…" className="font-mono text-xs" />
          </div>
          <p className="text-xs text-muted-foreground">
            Variables disponibles : {'{{nom_jeu}}'} {'{{quantite}}'} {'{{nom_client}}'} {'{{email_client}}'} {'{{adresse_livraison}}'} {'{{numero_commande}}'} {'{{montant_ttc}}'} {'{{commission}}'} {'{{date_commande}}'} {'{{message_personnalise_jeu}}'}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={isPending || !form.template_key || !form.subject}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Sauvegarder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Settings ───────────────────────────────────────────────────────

function SettingsTab() {
  const { data: settings, isLoading } = useSupertiltSettings();
  const { data: templates } = useEmailTemplates();
  const { mutateAsync: saveSetting } = useUpsertSupertiltSetting();
  const [editingTpl, setEditingTpl] = useState<Partial<EmailTemplate> | undefined>(undefined);
  const [localSettings, setLocalSettings] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const get = (k: string): string => {
    if (localSettings[k] !== undefined) return localSettings[k];
    const v = settings?.[k];
    if (v === null || v === undefined) return "";
    return typeof v === "string" ? v.replace(/^"|"$/g, "") : String(v);
  };

  const setLocal = (k: string, v: string) => setLocalSettings((s) => ({ ...s, [k]: v }));

  const saveAll = async () => {
    try {
      await Promise.all(
        Object.entries(localSettings).map(([k, v]) => saveSetting({ key: k, value: JSON.stringify(v) }))
      );
      setLocalSettings({});
      toast({ title: "Paramètres sauvegardés" });
    } catch { toastError(toast, "Erreur lors de la sauvegarde"); }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const hasChanges = Object.keys(localSettings).length > 0;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* WooCommerce */}
      <Card>
        <CardHeader><CardTitle className="text-base">WooCommerce</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Statuts à traiter</Label>
            <Input value={get("wc_statuses_to_process")} onChange={(e) => setLocal("wc_statuses_to_process", e.target.value)} placeholder='["completed","processing"]' />
            <p className="text-xs text-muted-foreground">JSON array des statuts WooCommerce acceptés</p>
          </div>
          <div className="space-y-1">
            <Label>Secret webhook WooCommerce</Label>
            <Input type="password" value={get("wc_webhook_secret")} onChange={(e) => setLocal("wc_webhook_secret", e.target.value)} placeholder="Laissez vide pour désactiver la vérification" />
          </div>
          <div className="space-y-1">
            <Label>URL du webhook à configurer dans WooCommerce</Label>
            <code className="text-xs bg-muted p-2 rounded block break-all select-all">
              {window.location.origin.replace("localhost:8080", "votre-projet.supabase.co")}/functions/v1/supertilt-webhook
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Emails */}
      <Card>
        <CardHeader><CardTitle className="text-base">Emails</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Email interne SuperTilt (notifications)</Label>
            <Input value={get("internal_email")} onChange={(e) => setLocal("internal_email", e.target.value)} placeholder="contact@supertilt.fr" />
          </div>
          <div className="space-y-1">
            <Label>Adresse d'expédition (From)</Label>
            <Input value={get("default_sender")} onChange={(e) => setLocal("default_sender", e.target.value)} placeholder="noreply@supertilt.fr" />
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={get("auto_send_emails") === "true"}
              onCheckedChange={(v) => setLocal("auto_send_emails", String(v))}
            />
            <div>
              <Label>Envoi automatique des emails</Label>
              <p className="text-xs text-muted-foreground">Si désactivé, les emails nécessitent une validation manuelle</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Finances */}
      <Card>
        <CardHeader><CardTitle className="text-base">Finances</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Taux TVA par défaut</Label>
              <Input type="number" step="0.01" value={get("vat_rate")} onChange={(e) => setLocal("vat_rate", e.target.value)} placeholder="0.20" />
            </div>
            <div className="space-y-1">
              <Label>Taux frais Stripe (%)</Label>
              <Input type="number" step="0.001" value={get("stripe_fee_rate")} onChange={(e) => setLocal("stripe_fee_rate", e.target.value)} placeholder="0.014" />
            </div>
            <div className="space-y-1">
              <Label>Frais Stripe fixes (€)</Label>
              <Input type="number" step="0.01" value={get("stripe_fee_fixed")} onChange={(e) => setLocal("stripe_fee_fixed", e.target.value)} placeholder="0.25" />
            </div>
          </div>
        </CardContent>
      </Card>

      {hasChanges && (
        <Button onClick={saveAll}><CheckCircle className="h-4 w-4 mr-2" />Sauvegarder les paramètres</Button>
      )}

      {/* Templates */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Templates d'emails</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setEditingTpl({})}>
              <Plus className="h-4 w-4 mr-1" />Nouveau
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {(templates ?? []).map((t) => (
              <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{t.template_key}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditingTpl(t)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {editingTpl !== undefined && (
        <TemplateEditor tpl={editingTpl} onClose={() => setEditingTpl(undefined)} />
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────

export default function SupertiltOrders() {
  const { data: kpis } = useOrderKpis();
  const toValidateCount = kpis?.toValidate ?? 0;
  const blockedCount = kpis?.blocked ?? 0;

  return (
    <ModuleLayout>
      <PageHeader title="Commandes Jeux SuperTilt" />
      {(toValidateCount > 0 || blockedCount > 0) && (
        <div className="mb-4 flex gap-3 flex-wrap">
          {toValidateCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <strong>{toValidateCount}</strong> commande(s) à valider
            </div>
          )}
          {blockedCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
              <Ban className="h-4 w-4" />
              <strong>{blockedCount}</strong> commande(s) bloquée(s)
            </div>
          )}
        </div>
      )}
      <Tabs defaultValue="kanban">
        <TabsList className="mb-6 flex-wrap h-auto gap-0.5">
          <TabsTrigger value="dashboard"><LayoutGrid className="h-4 w-4 mr-1.5" />Dashboard</TabsTrigger>
          <TabsTrigger value="kanban" className="relative">
            <LayoutGrid className="h-4 w-4 mr-1.5" />Kanban
            {toValidateCount > 0 && (
              <span className="ml-1.5 bg-yellow-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">{toValidateCount}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="catalog"><Package className="h-4 w-4 mr-1.5" />Catalogue</TabsTrigger>
          <TabsTrigger value="sales"><ShoppingCart className="h-4 w-4 mr-1.5" />Ventes</TabsTrigger>
          <TabsTrigger value="bilan"><Euro className="h-4 w-4 mr-1.5" />Bilan</TabsTrigger>
          <TabsTrigger value="partenaires"><Users className="h-4 w-4 mr-1.5" />Partenaires</TabsTrigger>
          <TabsTrigger value="depenses"><BarChart3 className="h-4 w-4 mr-1.5" />Dépenses</TabsTrigger>
          <TabsTrigger value="stock"><Package className="h-4 w-4 mr-1.5" />Stock</TabsTrigger>
          <TabsTrigger value="emails"><Mail className="h-4 w-4 mr-1.5" />Emails</TabsTrigger>
          <TabsTrigger value="settings"><Settings className="h-4 w-4 mr-1.5" />Paramètres</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><Dashboard /></TabsContent>
        <TabsContent value="kanban"><Kanban /></TabsContent>
        <TabsContent value="catalog"><Catalog /></TabsContent>
        <TabsContent value="sales"><Sales /></TabsContent>
        <TabsContent value="bilan"><BilanTab /></TabsContent>
        <TabsContent value="partenaires"><PartenairesTab /></TabsContent>
        <TabsContent value="depenses"><DepensesTab /></TabsContent>
        <TabsContent value="stock"><StockTab /></TabsContent>
        <TabsContent value="emails"><EmailLogTab /></TabsContent>
        <TabsContent value="settings"><SettingsTab /></TabsContent>
      </Tabs>
    </ModuleLayout>
  );
}
