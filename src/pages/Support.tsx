import { useState, useMemo } from "react";
import { Loader2, LifeBuoy, Bug, Lightbulb, Plus, Search, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import ModuleLayout from "@/components/ModuleLayout";
import GenericKanbanBoard from "@/components/shared/kanban/GenericKanbanBoard";
import { useSupportTickets, useCreateSupportTicket, useUpdateSupportTicket, useMoveSupportTicket } from "@/hooks/useSupport";
import {
  SUPPORT_COLUMNS,
  TICKET_TYPE_CONFIG,
  TICKET_PRIORITY_CONFIG,
  type SupportTicket,
  type SupportTicketCard,
  type TicketType,
  type TicketPriority,
  type TicketStatus,
} from "@/types/support";
import type { KanbanDropResult } from "@/types/kanban";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const Support = () => {
  const { toast } = useToast();
  const { data: tickets, isLoading } = useSupportTickets();
  const createTicket = useCreateSupportTicket();
  const updateTicket = useUpdateSupportTicket();
  const moveTicket = useMoveSupportTicket();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | TicketType>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<SupportTicket | null>(null);

  // New ticket form state
  const [newType, setNewType] = useState<TicketType>("bug");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<TicketPriority>("medium");

  // Build cards for Kanban
  const cards: SupportTicketCard[] = useMemo(() => {
    if (!tickets) return [];
    return tickets
      .filter((t) => {
        if (filterType !== "all" && t.type !== filterType) return false;
        if (search) {
          const q = search.toLowerCase();
          return (
            t.title.toLowerCase().includes(q) ||
            t.ticket_number.toLowerCase().includes(q) ||
            t.description.toLowerCase().includes(q) ||
            (t.submitted_by_email && t.submitted_by_email.toLowerCase().includes(q))
          );
        }
        return true;
      })
      .map((t) => ({
        id: t.id,
        columnId: t.status,
        position: t.position,
        ticket: t,
      }));
  }, [tickets, search, filterType]);

  // Stats
  const stats = useMemo(() => {
    if (!tickets) return { total: 0, bugs: 0, evolutions: 0, open: 0 };
    return {
      total: tickets.length,
      bugs: tickets.filter((t) => t.type === "bug").length,
      evolutions: tickets.filter((t) => t.type === "evolution").length,
      open: tickets.filter((t) => t.status !== "ferme" && t.status !== "resolu").length,
    };
  }, [tickets]);

  const handleCardMove = async (result: KanbanDropResult<SupportTicketCard>) => {
    try {
      await moveTicket.mutateAsync({
        id: result.card.id,
        status: result.targetColumnId as TicketStatus,
        position: result.newPosition,
      });
    } catch {
      toast({ title: "Erreur", description: "Impossible de déplacer le ticket.", variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    if (!newDescription.trim()) return;
    const autoTitle = newDescription.trim().split(/[.\n]/)[0].slice(0, 80).trim() || "Ticket sans titre";
    try {
      await createTicket.mutateAsync({
        type: newType,
        title: autoTitle,
        description: newDescription.trim(),
        priority: newPriority,
        page_url: null,
      });
      setCreateOpen(false);
      setNewDescription("");
      setNewPriority("medium");
      setNewType("bug");
      toast({ title: "Ticket créé", description: "Le ticket a été ajouté au Kanban." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de créer le ticket.", variant: "destructive" });
    }
  };

  const handleUpdateTicket = async (id: string, updates: Partial<SupportTicket>) => {
    try {
      const result = await updateTicket.mutateAsync({ id, updates });
      setDetailTicket(result as unknown as SupportTicket);
    } catch {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le ticket.", variant: "destructive" });
    }
  };

  const renderCard = (card: SupportTicketCard) => {
    const t = card.ticket;
    const typeConf = TICKET_TYPE_CONFIG[t.type];
    const prioConf = TICKET_PRIORITY_CONFIG[t.priority];

    return (
      <div
        className="bg-background border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer space-y-2"
        onClick={() => setDetailTicket(t)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" style={{ borderColor: typeConf.color, color: typeConf.color }} className="text-[10px] px-1.5 py-0">
              {t.type === "bug" ? <Bug className="h-2.5 w-2.5 mr-0.5" /> : <Lightbulb className="h-2.5 w-2.5 mr-0.5" />}
              {typeConf.label}
            </Badge>
            <Badge variant="outline" style={{ borderColor: prioConf.color, color: prioConf.color }} className="text-[10px] px-1.5 py-0">
              {prioConf.label}
            </Badge>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">{t.ticket_number}</span>
        </div>
        <p className="text-sm font-medium leading-tight line-clamp-2">{t.title}</p>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{t.submitted_by_email?.split("@")[0] || "—"}</span>
          <span>{formatDistanceToNow(new Date(t.created_at), { addSuffix: true, locale: fr })}</span>
        </div>
      </div>
    );
  };

  const renderColumnHeader = (column: typeof SUPPORT_COLUMNS[0], columnCards: SupportTicketCard[]) => (
    <div className="flex items-center justify-between px-2 py-1">
      <div className="flex items-center gap-2">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: column.color }} />
        <span className="font-semibold text-sm">{column.name}</span>
        <Badge variant="secondary" className="text-xs h-5 px-1.5">{columnCards.length}</Badge>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <ModuleLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout>
      <main className="max-w-[1600px] mx-auto p-4 sm:p-6 h-[calc(100vh-80px)] flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 hidden sm:block">
                <LifeBuoy className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Support</h1>
                <p className="text-muted-foreground text-xs sm:text-sm hidden sm:block">Bugs et demandes d'évolution</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Stats */}
            <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground mr-2">
              <span className="flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" />{stats.open} ouvert{stats.open > 1 ? "s" : ""}</span>
              <span className="flex items-center gap-1"><Bug className="h-3.5 w-3.5 text-red-500" />{stats.bugs}</span>
              <span className="flex items-center gap-1"><Lightbulb className="h-3.5 w-3.5 text-violet-500" />{stats.evolutions}</span>
            </div>

            {/* Search */}
            <div className="relative w-56">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2.5 top-2.5">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              )}
            </div>

            {/* Filter */}
            <Select value={filterType} onValueChange={(v) => setFilterType(v as typeof filterType)}>
              <SelectTrigger className="w-32 text-sm">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="bug">Bugs</SelectItem>
                <SelectItem value="evolution">Évolutions</SelectItem>
              </SelectContent>
            </Select>

            {/* Create */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nouveau ticket</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer un ticket</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Type</Label>
                    <RadioGroup value={newType} onValueChange={(v) => setNewType(v as TicketType)} className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="bug" id="new-bug" />
                        <Label htmlFor="new-bug" className="font-normal cursor-pointer flex items-center gap-1"><Bug className="h-4 w-4 text-red-500" />Bug</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="evolution" id="new-evo" />
                        <Label htmlFor="new-evo" className="font-normal cursor-pointer flex items-center gap-1"><Lightbulb className="h-4 w-4 text-violet-500" />Évolution</Label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label>Description *</Label>
                    <Textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} rows={6} placeholder="Décrivez le bug ou l'évolution souhaitée..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Priorité</Label>
                    <Select value={newPriority} onValueChange={(v) => setNewPriority(v as TicketPriority)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Basse</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="high">Haute</SelectItem>
                        <SelectItem value="critical">Critique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreate} disabled={createTicket.isPending || !newDescription.trim()} className="w-full">
                    {createTicket.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Créer le ticket
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex-1 overflow-hidden">
          <GenericKanbanBoard
            columns={SUPPORT_COLUMNS}
            cards={cards}
            loading={isLoading}
            renderCard={renderCard}
            renderColumnHeader={renderColumnHeader}
            onCardMove={handleCardMove}
            onCardClick={(card) => setDetailTicket(card.ticket)}
            columnClassName="min-w-[260px] max-w-[300px]"
          />
        </div>
      </main>

      {/* Detail Sheet */}
      <Sheet open={!!detailTicket} onOpenChange={(open) => !open && setDetailTicket(null)}>
        <SheetContent className="w-[480px] sm:max-w-[480px]">
          {detailTicket && (
            <TicketDetail
              ticket={detailTicket}
              onUpdate={handleUpdateTicket}
            />
          )}
        </SheetContent>
      </Sheet>
    </ModuleLayout>
  );
};

function TicketDetail({ ticket, onUpdate }: { ticket: SupportTicket; onUpdate: (id: string, updates: Partial<SupportTicket>) => void }) {
  const typeConf = TICKET_TYPE_CONFIG[ticket.type];
  const prioConf = TICKET_PRIORITY_CONFIG[ticket.priority];
  const [resolutionNotes, setResolutionNotes] = useState(ticket.resolution_notes || "");

  return (
    <ScrollArea className="h-full">
      <SheetHeader className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" style={{ borderColor: typeConf.color, color: typeConf.color }}>
            {ticket.type === "bug" ? <Bug className="h-3 w-3 mr-1" /> : <Lightbulb className="h-3 w-3 mr-1" />}
            {typeConf.label}
          </Badge>
          <span className="text-sm font-mono text-muted-foreground">{ticket.ticket_number}</span>
        </div>
        <SheetTitle className="text-left">{ticket.title}</SheetTitle>
      </SheetHeader>

      <div className="space-y-6 pr-2">
        {/* Description */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
          </CardContent>
        </Card>

        {/* Metadata */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Statut</Label>
            <Select value={ticket.status} onValueChange={(v) => onUpdate(ticket.id, { status: v as TicketStatus })}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUPPORT_COLUMNS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Priorité</Label>
            <Select value={ticket.priority} onValueChange={(v) => onUpdate(ticket.id, { priority: v as TicketPriority })}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Basse</SelectItem>
                <SelectItem value="medium">Moyenne</SelectItem>
                <SelectItem value="high">Haute</SelectItem>
                <SelectItem value="critical">Critique</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Info */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Soumis par</span>
            <span>{ticket.submitted_by_email || "—"}</span>
          </div>
          {ticket.page_url && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Page</span>
              <span className="font-mono text-xs">{ticket.page_url}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Créé</span>
            <span>{formatDistanceToNow(new Date(ticket.created_at), { addSuffix: true, locale: fr })}</span>
          </div>
          {ticket.resolved_at && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Résolu</span>
              <span>{formatDistanceToNow(new Date(ticket.resolved_at), { addSuffix: true, locale: fr })}</span>
            </div>
          )}
        </div>

        {/* Resolution notes */}
        <div className="space-y-2">
          <Label className="text-sm">Notes de résolution</Label>
          <Textarea
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            placeholder="Explication de la résolution, lien vers le fix..."
            rows={3}
            className="text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => onUpdate(ticket.id, { resolution_notes: resolutionNotes })}
            disabled={resolutionNotes === (ticket.resolution_notes || "")}
          >
            Sauvegarder les notes
          </Button>
        </div>
      </div>
    </ScrollArea>
  );
}

export default Support;
