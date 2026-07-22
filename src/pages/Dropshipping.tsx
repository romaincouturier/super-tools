import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ShoppingCart, TrendingUp, Euro, Package, Users, Plus, Pencil, Trash2, FileText, ExternalLink } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { todayAsISO } from "@/lib/dateFormatters";
import GameDevisTab from "@/components/dropshipping/GameDevisTab";
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
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useConfirm } from "@/hooks/useConfirm";
import {
  useGameAuthors, useUpsertGameAuthor, useDeleteGameAuthor,
  useGames, useUpsertGame, useDeleteGame,
  useGameSales, useGameSalesKpis, useMarkSalesPaid, useDeleteGameSale,
  type GameAuthor, type Game, type GameSale,
} from "@/hooks/useDropshipping";

const EUR = (v: number) => v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const DATE = (s: string) => new Date(s).toLocaleDateString("fr-FR");

// ── Dashboard ──────────────────────────────────────────────────────

function Dashboard() {
  const { data: kpis, isLoading } = useGameSalesKpis();
  const [detail, setDetail] = useState<{ gameId: string | null; title: string } | null>(null);

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="md" /></div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Chiffre d'affaires", value: EUR(kpis?.totalRevenue ?? 0), icon: <Euro className="h-5 w-5 text-green-600" /> },
          { label: "Royalties dues", value: EUR(kpis?.totalRoyalties ?? 0), icon: <TrendingUp className="h-5 w-5 text-blue-600" /> },
          { label: "Ventes totales", value: kpis?.totalSales ?? 0, icon: <ShoppingCart className="h-5 w-5 text-purple-600" /> },
          { label: "Jeux top 5", value: kpis?.topGames?.length ?? 0, icon: <Package className="h-5 w-5 text-orange-600" /> },
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

      {kpis?.topGames?.length ? (
        <Card>
          <CardHeader><CardTitle className="text-base">Top jeux par CA</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Jeu</TableHead>
                  <TableHead className="text-right">Ventes</TableHead>
                  <TableHead className="text-right">CA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kpis.topGames.map((g, i) => (
                  <TableRow
                    key={g.title}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setDetail({ gameId: g.gameId, title: g.title })}
                  >
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{g.title}</TableCell>
                    <TableCell className="text-right">{g.sales}</TableCell>
                    <TableCell className="text-right">{EUR(g.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}

      {detail && (
        <GameSalesDetailDialog
          gameId={detail.gameId}
          title={detail.title}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function GameSalesDetailDialog({
  gameId,
  title,
  onClose,
}: {
  gameId: string | null;
  title: string;
  onClose: () => void;
}) {
  const { data: allSales, isLoading } = useGameSales();
  const sales = (allSales ?? []).filter((s) => (s.game_id ?? null) === gameId);

  const totalRevenue = sales.reduce((acc, s) => acc + s.total_amount, 0);
  const totalRoyalties = sales.reduce((acc, s) => acc + s.royalty_amount, 0);

  const exportCsv = () => {
    const header = ["Date", "Commande WC", "Client", "Email", "Quantité", "Prix unitaire", "Total", "Royalty", "Statut"];
    const escape = (v: string | number | null | undefined) => {
      const s = v == null ? "" : String(v);
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = [
      header.join(";"),
      ...sales.map((s) => [
        new Date(s.sale_date).toISOString().slice(0, 10),
        s.woocommerce_order_id,
        s.customer_name ?? "",
        s.customer_email ?? "",
        s.quantity,
        s.unit_price.toFixed(2).replace(".", ","),
        s.total_amount.toFixed(2).replace(".", ","),
        s.royalty_amount.toFixed(2).replace(".", ","),
        s.status === "paid" ? "Payé" : "En attente",
      ].map(escape).join(";")),
    ];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ventes_${title.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_${todayAsISO()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 pr-6">
            <span className="truncate">{title}</span>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!sales.length}>
              <FileText className="h-4 w-4 mr-1.5" />Export CSV
            </Button>
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size="md" /></div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Ventes</p>
                <p className="text-lg font-semibold">{sales.length}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">CA</p>
                <p className="text-lg font-semibold">{EUR(totalRevenue)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Royalties</p>
                <p className="text-lg font-semibold text-blue-700">{EUR(totalRoyalties)}</p>
              </div>
            </div>
            <div className="overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Commande</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Qté</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Royalty</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Aucune vente</TableCell></TableRow>
                  )}
                  {sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-sm">{DATE(s.sale_date)}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">#{s.woocommerce_order_id}</TableCell>
                      <TableCell className="text-sm">
                        <div>{s.customer_name ?? "—"}</div>
                        {s.customer_email && <div className="text-xs text-muted-foreground">{s.customer_email}</div>}
                      </TableCell>
                      <TableCell className="text-right text-sm">{s.quantity}</TableCell>
                      <TableCell className="text-right text-sm">{EUR(s.total_amount)}</TableCell>
                      <TableCell className="text-right text-sm text-blue-700">{EUR(s.royalty_amount)}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === "paid" ? "default" : "outline"} className="text-xs">
                          {s.status === "paid" ? "Payé" : "En attente"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Sales Table ────────────────────────────────────────────────────

function SalesTable() {
  const { data: sales, isLoading } = useGameSales();
  const { mutateAsync: markPaid, isPending } = useMarkSalesPaid();
  const { mutateAsync: deleteSale } = useDeleteGameSale();
  const [selected, setSelected] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const toggleSelect = (id: string) => setSelected((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);

  const handleMarkPaid = async () => {
    try {
      await markPaid(selected);
      setSelected([]);
      toast({ title: `${selected.length} vente(s) marquée(s) comme payée(s)` });
    } catch (err) {
      toastError(toast, "Une erreur est survenue", { cause: err });
    }
  };

  const handleDelete = async (sale: GameSale) => {
    const label = (sale.games as any)?.title ?? sale.customer_name ?? sale.customer_email ?? "cette commande";
    const ok = await confirm({
      title: "Supprimer cette commande ?",
      description: `La vente « ${label} » (${EUR(sale.total_amount)}) sera définitivement supprimée. Cette action est irréversible.`,
      confirmText: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    setDeletingId(sale.id);
    try {
      await deleteSale(sale.id);
      setSelected((s) => s.filter((x) => x !== sale.id));
      toast({ title: "Commande supprimée" });
    } catch (err) {
      toastError(toast, "Une erreur est survenue", { cause: err });
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  if (!sales?.length) return <div className="text-center py-12 text-muted-foreground">Aucune vente importée</div>;

  const pendingSelected = selected.filter((id) => sales.find((s) => s.id === id)?.status === "pending");

  return (
    <div className="space-y-3">
      {pendingSelected.length > 0 && (
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleMarkPaid} disabled={isPending}>
            {isPending ? <Spinner className="mr-1" /> : null}
            Marquer {pendingSelected.length} comme payée(s)
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected([])}>Désélectionner</Button>
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Date</TableHead>
              <TableHead>Jeu</TableHead>
              <TableHead>Client</TableHead>
              <TableHead className="text-right">Qté</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Royalty</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(sales as GameSale[]).map((s) => (
              <TableRow key={s.id} className={selected.includes(s.id) ? "bg-muted/50" : ""}>
                <TableCell>
                  <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)} className="cursor-pointer" />
                </TableCell>
                <TableCell className="text-sm">{DATE(s.sale_date)}</TableCell>
                <TableCell className="text-sm font-medium">{(s.games as any)?.title ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{s.customer_name ?? s.customer_email ?? "—"}</TableCell>
                <TableCell className="text-right text-sm">{s.quantity}</TableCell>
                <TableCell className="text-right text-sm">{EUR(s.total_amount)}</TableCell>
                <TableCell className="text-right text-sm text-blue-700">{EUR(s.royalty_amount)}</TableCell>
                <TableCell>
                  <Badge variant={s.status === "paid" ? "default" : "outline"} className="text-xs">
                    {s.status === "paid" ? "Payé" : "En attente"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    title="Supprimer la commande"
                    disabled={deletingId === s.id}
                    onClick={() => handleDelete(s)}
                  >
                    {deletingId === s.id ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ConfirmDialog />
    </div>
  );
}

// ── Authors Table ──────────────────────────────────────────────────

function AuthorDialog({ author, onClose }: { author: Partial<GameAuthor> | null; onClose: () => void }) {
  const [form, setForm] = useState<Partial<GameAuthor>>(author ?? {});
  const { mutateAsync: upsert, isPending } = useUpsertGameAuthor();
  const { toast } = useToast();

  if (!author && author !== null) return null; // only open when author is set

  const save = async () => {
    if (!form.name) return;
    try {
      await upsert(form as GameAuthor & { name: string });
      toast({ title: "Auteur sauvegardé" });
      onClose();
    } catch (err) {
      toastError(toast, "Une erreur est survenue", { cause: err });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{form.id ? "Modifier l'auteur" : "Nouvel auteur"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {[
            { label: "Nom *", key: "name", placeholder: "Prénom Nom" },
            { label: "Email", key: "email", placeholder: "email@exemple.fr" },
            { label: "Téléphone", key: "phone", placeholder: "+33 6 …" },
            { label: "Entreprise", key: "company", placeholder: "Nom de l'entreprise" },
          ].map(({ label, key, placeholder }) => (
            <div key={key} className="space-y-1">
              <Label>{label}</Label>
              <Input value={(form as any)[key] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} placeholder={placeholder} />
            </div>
          ))}
          <div className="space-y-1">
            <Label>Taux de royalty (%)</Label>
            <Input type="number" min="0" max="100" step="0.5"
              value={Math.round(((form.royalty_rate ?? 0.1) * 100) * 10) / 10}
              onChange={(e) => setForm((f) => ({ ...f, royalty_rate: parseFloat(e.target.value) / 100 }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Notes</Label>
            <Textarea value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={isPending || !form.name}>
            {isPending ? <Spinner /> : "Sauvegarder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuthorsTable() {
  const { data: authors, isLoading } = useGameAuthors();
  const { mutateAsync: del } = useDeleteGameAuthor();
  const [editing, setEditing] = useState<Partial<GameAuthor> | null | undefined>(undefined);
  const { toast } = useToast();

  const handleDelete = async (id: string) => {
    try { await del(id); toast({ title: "Auteur supprimé" }); }
    catch { toastError(toast, "Une erreur est survenue"); }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="md" /></div>;

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4 mr-1" />Ajouter un auteur</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nom</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Entreprise</TableHead>
              <TableHead className="text-right">Royalty</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!authors?.length && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun auteur</TableCell></TableRow>
            )}
            {(authors ?? []).map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{a.email ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{a.company ?? "—"}</TableCell>
                <TableCell className="text-right">{Math.round(a.royalty_rate * 100)}%</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {editing !== undefined && <AuthorDialog author={editing} onClose={() => setEditing(undefined)} />}
    </>
  );
}

// ── Games Table ────────────────────────────────────────────────────

function GameDialog({ game, authors, onClose }: { game: Partial<Game> | null; authors: GameAuthor[]; onClose: () => void }) {
  const [form, setForm] = useState<Partial<Game>>(game ?? { status: "active" });
  const { mutateAsync: upsert, isPending } = useUpsertGame();
  const { toast } = useToast();

  const save = async () => {
    if (!form.title) return;
    try {
      await upsert(form as Game & { title: string });
      toast({ title: "Jeu sauvegardé" });
      onClose();
    } catch (err) {
      toastError(toast, "Une erreur est survenue", { cause: err });
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">

        <DialogHeader><DialogTitle>{form.id ? "Modifier le jeu" : "Nouveau jeu"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Titre *</Label>
            <Input value={form.title ?? ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Nom du jeu" />
          </div>
          <div className="space-y-1">
            <Label>Auteur</Label>
            <Select value={form.author_id ?? ""} onValueChange={(v) => setForm((f) => ({ ...f, author_id: v || null }))}>
              <SelectTrigger><SelectValue placeholder="Sélectionner un auteur" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucun</SelectItem>
                {authors.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>ID produit WooCommerce</Label>
            <Input type="number" value={form.woocommerce_product_id ?? ""} onChange={(e) => setForm((f) => ({ ...f, woocommerce_product_id: e.target.value ? parseInt(e.target.value) : null }))} placeholder="Ex: 1234" />
          </div>
          <div className="space-y-1">
            <Label>URL du Bilan (partagée avec le co-auteur/co-autrice)</Label>
            <Input
              type="url"
              value={(form as any).bilan_url ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, bilan_url: e.target.value || null } as any))}
              placeholder="https://…"
            />
          </div>
          <div className="space-y-1">
            <Label>Statut</Label>
            <Select value={form.status ?? "active"} onValueChange={(v) => setForm((f) => ({ ...f, status: v as "active" | "inactive" }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Actif</SelectItem>
                <SelectItem value="inactive">Inactif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={isPending || !form.title}>
            {isPending ? <Spinner /> : "Sauvegarder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GamesTable() {
  const { data: games, isLoading } = useGames();
  const { data: authors } = useGameAuthors();
  const { mutateAsync: del } = useDeleteGame();
  const [editing, setEditing] = useState<Partial<Game> | null | undefined>(undefined);
  const { toast } = useToast();

  if (isLoading) return <div className="flex justify-center py-12"><Spinner size="md" /></div>;

  return (
    <>
      <div className="flex justify-end mb-3">
        <Button size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4 mr-1" />Ajouter un jeu</Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Auteur</TableHead>
              <TableHead>ID WC</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {!games?.length && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Aucun jeu — ajoutez le premier !</TableCell></TableRow>
            )}
            {(games ?? []).map((g) => (
              <TableRow key={g.id}>
                <TableCell className="font-medium">{g.title}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{(g.game_authors as any)?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{g.woocommerce_product_id ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={g.status === "active" ? "default" : "secondary"}>{g.status === "active" ? "Actif" : "Inactif"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {(g as any).bilan_url && (
                      <Button
                        variant="ghost"
                        size="icon"
                        asChild
                        title="Ouvrir le bilan partagé"
                      >
                        <a href={(g as any).bilan_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => setEditing(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" onClick={async () => { try { await del(g.id); } catch (err) { toastError(toast, "Une erreur est survenue", { cause: err }); } }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
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

// ── Main page ──────────────────────────────────────────────────────

export default function Dropshipping() {
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "dashboard";
  return (
    <ModuleLayout>
      <div className="max-w-[1600px] mx-auto p-4 sm:p-6 space-y-0">
      <PageHeader title="Dropshipping" />
      <Tabs defaultValue={initialTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="dashboard"><TrendingUp className="h-4 w-4 mr-1.5" />Dashboard</TabsTrigger>
          <TabsTrigger value="sales"><ShoppingCart className="h-4 w-4 mr-1.5" />Ventes</TabsTrigger>
          <TabsTrigger value="games"><Package className="h-4 w-4 mr-1.5" />Jeux</TabsTrigger>
          <TabsTrigger value="authors"><Users className="h-4 w-4 mr-1.5" />Auteurs</TabsTrigger>
          <TabsTrigger value="devis"><FileText className="h-4 w-4 mr-1.5" />Devis</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard"><Dashboard /></TabsContent>
        <TabsContent value="sales"><SalesTable /></TabsContent>
        <TabsContent value="games"><GamesTable /></TabsContent>
        <TabsContent value="authors"><AuthorsTable /></TabsContent>
        <TabsContent value="devis"><GameDevisTab /></TabsContent>
      </Tabs>
      </div>
    </ModuleLayout>
  );
}
