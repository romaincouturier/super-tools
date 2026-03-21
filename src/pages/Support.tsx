import { useState, useMemo, useCallback, useRef } from "react";
import { Loader2, LifeBuoy, Bug, Lightbulb, Plus, Search, X, AlertCircle, ClipboardCopy, ImagePlus, Sparkles, BarChart3 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import ModuleLayout from "@/components/ModuleLayout";
import GenericKanbanBoard from "@/components/shared/kanban/GenericKanbanBoard";
import SupportTicketCardComponent from "@/components/support/SupportTicketCard";
import TicketDetail from "@/components/support/TicketDetail";
import { useSupportTickets, useCreateSupportTicket, useUpdateSupportTicket, useMoveSupportTicket, useAnalyzeTicket } from "@/hooks/useSupport";
import {
  SUPPORT_COLUMNS,
  TICKET_PRIORITY_CONFIG,
  type SupportTicket,
  type SupportTicketCard,
  type TicketType,
  type TicketStatus,
} from "@/types/support";
import type { KanbanDropResult, KanbanStatsItem } from "@/types/kanban";
import KanbanStatsDialog from "@/components/shared/kanban/KanbanStatsDialog";

const Support = () => {
  const { toast } = useToast();
  const { data: tickets, isLoading } = useSupportTickets();
  const createTicket = useCreateSupportTicket();
  const updateTicket = useUpdateSupportTicket();
  const moveTicket = useMoveSupportTicket();
  const analyzeTicket = useAnalyzeTicket();

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | TicketType>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTicket, setDetailTicket] = useState<SupportTicket | null>(null);
  const [showStats, setShowStats] = useState(false);

  // New ticket form state — simplified: description + optional image only
  const [newDescription, setNewDescription] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isSubmitting = analyzeTicket.isPending || createTicket.isPending;

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

  const statsItems: KanbanStatsItem[] = useMemo(() => {
    if (!tickets) return [];
    return tickets.map((t) => ({
      id: t.id,
      columnId: t.status,
      createdAt: t.created_at,
      completedAt: t.resolved_at,
    }));
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
    try {
      // Step 1: AI analysis
      const analysis = await analyzeTicket.mutateAsync(newDescription.trim());

      // Step 2: Create ticket with AI-generated fields
      await createTicket.mutateAsync({
        type: analysis.type,
        title: analysis.title,
        description: newDescription.trim(),
        priority: analysis.priority,
        page_url: null,
        ai_analysis: analysis,
        files: newFiles.length > 0 ? newFiles : undefined,
      });
      setCreateOpen(false);
      setNewDescription("");
      setNewFiles([]);
      toast({ title: "Ticket créé", description: `L'IA a classifié votre demande comme ${analysis.type === "bug" ? "un bug" : "une évolution"}.` });
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

  const exportNewTickets = useCallback(async () => {
    if (!tickets) return;
    const newTickets = tickets.filter((t) => t.status === "nouveau");
    if (newTickets.length === 0) {
      toast({ title: "Aucun ticket nouveau", description: "Il n'y a aucun ticket dans la colonne \"Nouveau\"." });
      return;
    }
    const text = newTickets
      .map((t) => {
        const typeLabel = t.type === "bug" ? "BUG" : "ÉVOLUTION";
        const prioLabel = TICKET_PRIORITY_CONFIG[t.priority].label.toUpperCase();
        return `## ${t.ticket_number} — [${typeLabel}] [${prioLabel}]\n${t.title}\n\n${t.description}${t.page_url ? `\n\nPage: ${t.page_url}` : ""}`;
      })
      .join("\n\n---\n\n");
    const header = `# Tickets nouveaux (${newTickets.length})\n\n`;
    try {
      await navigator.clipboard.writeText(header + text);
      toast({ title: "Copié !", description: `${newTickets.length} ticket${newTickets.length > 1 ? "s" : ""} copié${newTickets.length > 1 ? "s" : ""} dans le presse-papier.` });
    } catch {
      toast({ title: "Erreur", description: "Impossible de copier dans le presse-papier.", variant: "destructive" });
    }
  }, [tickets, toast]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      setNewFiles((prev) => [...prev, ...Array.from(files)]);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const renderCard = (card: SupportTicketCard, isDragging?: boolean) => (
    <SupportTicketCardComponent card={card} isDragging={isDragging} />
  );

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
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 pt-6 h-[calc(100vh-80px)] flex flex-col">
        <PageHeader
          icon={LifeBuoy}
          title="Support"
          subtitle="Bugs et demandes d'évolution"
          actions={
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

              {/* Stats */}
              <Button size="sm" variant="outline" onClick={() => setShowStats(true)} title="Statistiques du tableau">
                <BarChart3 className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Statistiques</span>
              </Button>

              {/* Export new tickets */}
              <Button size="sm" variant="outline" onClick={exportNewTickets} title="Copier les tickets nouveaux en texte">
                <ClipboardCopy className="h-4 w-4 mr-1" />
                Export nouveaux
              </Button>

              {/* Create */}
              <Dialog open={createOpen} onOpenChange={(open) => {
                setCreateOpen(open);
                if (!open) { setNewDescription(""); setNewFiles([]); }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4 mr-1" />Nouvelle demande</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Soumettre une demande</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Décrivez votre problème ou votre idée *</Label>
                      <Textarea
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        rows={6}
                        placeholder="Décrivez ce qui ne fonctionne pas, ou l'amélioration que vous souhaitez..."
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Capture d'écran (optionnel)</Label>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <ImagePlus className="h-4 w-4 mr-1" />
                          Ajouter une image
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleFileChange}
                        />
                        {newFiles.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {newFiles.length} fichier{newFiles.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                      {newFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {newFiles.map((f, i) => (
                            <Badge key={i} variant="secondary" className="text-xs gap-1">
                              {f.name.length > 20 ? f.name.slice(0, 20) + "..." : f.name}
                              <button onClick={() => setNewFiles((prev) => prev.filter((_, j) => j !== i))}>
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg bg-muted/50 border border-dashed p-3 text-xs text-muted-foreground flex items-start gap-2">
                      <Sparkles className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
                      <span>L'IA va analyser votre demande pour la classifier automatiquement (bug ou évolution), définir sa priorité et structurer le ticket.</span>
                    </div>
                    <Button onClick={handleCreate} disabled={isSubmitting || !newDescription.trim()} className="w-full">
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          {analyzeTicket.isPending ? "Analyse IA en cours..." : "Création du ticket..."}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-2" />
                          Soumettre la demande
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          }
        />

        {/* Kanban Board */}
        <div className="flex-1 overflow-hidden">
          <GenericKanbanBoard
            columns={SUPPORT_COLUMNS}
            cards={cards}
            loading={isLoading}
            config={{ cardSortable: true }}
            renderCard={renderCard}
            renderColumnHeader={renderColumnHeader}
            onCardMove={handleCardMove}
            onCardClick={(card) => setDetailTicket(card.ticket)}
            columnClassName="min-w-[260px] max-w-[300px]"
          />
        </div>
      </div>

      {/* Detail Sheet */}
      <Sheet open={!!detailTicket} onOpenChange={(open) => !open && setDetailTicket(null)}>
        <SheetContent className="w-full sm:w-[480px] sm:max-w-[480px]">
          {detailTicket && (
            <TicketDetail
              ticket={detailTicket}
              onUpdate={handleUpdateTicket}
            />
          )}
        </SheetContent>
      </Sheet>

      <KanbanStatsDialog
        open={showStats}
        onOpenChange={setShowStats}
        columns={SUPPORT_COLUMNS}
        items={statsItems}
        doneColumnIds={["resolu", "ferme"]}
      />
    </ModuleLayout>
  );
};

export default Support;
