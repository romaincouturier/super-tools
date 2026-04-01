import { useState, useCallback } from "react";
import { Bug, Lightbulb, Loader2, Sparkles, Copy, Check, Bot } from "lucide-react";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  SUPPORT_COLUMNS,
  TICKET_TYPE_CONFIG,
  TICKET_PRIORITY_CONFIG,
  type SupportTicket,
  type TicketType,
  type TicketPriority,
  type TicketStatus,
  type TicketAiAnalysis,
  type BugAnalysis,
  type EvolutionAnalysis,
} from "@/types/support";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import AiAnalysisSection from "./AiAnalysisSection";
import AssignedUserSelector from "@/components/formations/AssignedUserSelector";
import { analyzeTicket } from "@/services/support";

interface Props {
  ticket: SupportTicket;
  onUpdate: (id: string, updates: Partial<SupportTicket>) => void;
}

export default function TicketDetail({ ticket, onUpdate }: Props) {
  const navigate = useNavigate();
  const typeConf = TICKET_TYPE_CONFIG[ticket.type];
  const [resolutionNotes, setResolutionNotes] = useState(ticket.resolution_notes || "");
  const [title, setTitle] = useState(ticket.title);
  const [type, setType] = useState<TicketType>(ticket.type);
  const [pageUrl, setPageUrl] = useState(ticket.page_url || "");
  const [reanalyzing, setReanalyzing] = useState(false);

  // AI analysis handlers
  const handleUpdateAnalysis = (analysis: TicketAiAnalysis) => {
    onUpdate(ticket.id, { ai_analysis: analysis });
  };

  const handleDeleteAnalysis = () => {
    onUpdate(ticket.id, { ai_analysis: null });
  };

  const handleReanalyze = async () => {
    setReanalyzing(true);
    try {
      const analysis = await analyzeTicket(ticket.description);
      onUpdate(ticket.id, { ai_analysis: analysis });
      toast.success("Analyse IA mise à jour");
    } catch {
      toast.error("Erreur lors de l'analyse IA");
    } finally {
      setReanalyzing(false);
    }
  };

  const [copied, setCopied] = useState(false);

  const handleCopyAll = useCallback(() => {
    const priorityLabel = TICKET_PRIORITY_CONFIG[ticket.priority].label;
    const statusLabel = SUPPORT_COLUMNS.find((c) => c.id === ticket.status)?.name || ticket.status;
    const lines: string[] = [
      `# ${ticket.ticket_number} — ${ticket.title}`,
      "",
      `- **Type** : ${ticket.type === "bug" ? "Bug" : "Évolution"}`,
      `- **Priorité** : ${priorityLabel}`,
      `- **Statut** : ${statusLabel}`,
      ticket.page_url ? `- **Page** : ${ticket.page_url}` : "",
      ticket.assigned_to ? `- **Assigné à** : ${ticket.assigned_to}` : "",
      ticket.submitted_by_email ? `- **Soumis par** : ${ticket.submitted_by_email}` : "",
      "",
      "## Description",
      ticket.description,
    ];

    if (ticket.ai_analysis) {
      const a = ticket.ai_analysis;
      lines.push("", "## Analyse IA");
      if (a.type === "bug") {
        const bug = a as BugAnalysis;
        lines.push(`### Constat\n${bug.constat}`, `### Reproduction\n${bug.reproduction}`, `### Situation désirée\n${bug.situation_desiree}`, `### Procédure de test\n${bug.procedure_test}`);
      } else {
        const evo = a as EvolutionAnalysis;
        lines.push(`### User stories\n${evo.user_stories}`, `### Critères d'acceptation\n${evo.criteres_acceptation}`, `### Impact produit\n${evo.impact_produit}`);
      }
    }

    if (ticket.resolution_notes) {
      lines.push("", "## Notes de résolution", ticket.resolution_notes);
    }

    navigator.clipboard.writeText(lines.filter((l) => l !== undefined).join("\n"));
    setCopied(true);
    toast.success("Ticket copié dans le presse-papier");
    setTimeout(() => setCopied(false), 2000);
  }, [ticket]);

  return (
    <ScrollArea className="h-full">
      <SheetHeader className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline" style={{ borderColor: typeConf.color, color: typeConf.color }}>
            {ticket.type === "bug" ? <Bug className="h-3 w-3 mr-1" /> : <Lightbulb className="h-3 w-3 mr-1" />}
            {typeConf.label}
          </Badge>
          <span className="text-sm font-mono text-muted-foreground">{ticket.ticket_number}</span>
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1.5 text-xs"
              onClick={() => navigate(`/agent?q=${encodeURIComponent(`Analyse le ticket support "${ticket.title}" (${ticket.ticket_number}) : description, statut, et propose une solution ou prochaine action.`)}`)}
              title="Demander à l'agent"
            >
              <Bot className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 gap-1.5 text-xs" onClick={handleCopyAll}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copié" : "Tout copier"}
            </Button>
          </div>
        </div>
        <SheetTitle className="text-left sr-only">{ticket.title}</SheetTitle>
      </SheetHeader>

      <div className="space-y-6 pr-2">
        {/* Titre — éditable */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Titre</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => { if (title !== ticket.title && title.trim()) onUpdate(ticket.id, { title }); }}
            className="text-sm font-medium"
          />
        </div>

        {/* Type + Priorité + Statut */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <Select value={type} onValueChange={(v) => { const t = v as TicketType; setType(t); onUpdate(ticket.id, { type: t }); }}>
              <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bug">Bug</SelectItem>
                <SelectItem value="evolution">Évolution</SelectItem>
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
        </div>

        {/* Assigné à — sélecteur d'équipe */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Assigné à</Label>
          <AssignedUserSelector
            value={ticket.assigned_to}
            onChange={(userId) => onUpdate(ticket.id, { assigned_to: userId })}
          />
        </div>

        {/* Page URL — éditable */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Page concernée</Label>
          <Input
            value={pageUrl}
            onChange={(e) => setPageUrl(e.target.value)}
            onBlur={() => { if (pageUrl !== (ticket.page_url || "")) onUpdate(ticket.id, { page_url: pageUrl || null }); }}
            placeholder="/chemin/de/la/page"
            className="text-sm font-mono"
          />
        </div>

        {/* Screenshot */}
        {ticket.screenshot_url && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Capture d'écran</Label>
            <a href={ticket.screenshot_url} target="_blank" rel="noopener noreferrer">
              <img src={ticket.screenshot_url} alt="Capture" className="rounded-md border max-h-48 object-contain" />
            </a>
          </div>
        )}

        {/* Description originale — lecture seule */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Description originale</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
          </CardContent>
        </Card>

        {/* AI Analysis */}
        {ticket.ai_analysis ? (
          <AiAnalysisSection
            analysis={ticket.ai_analysis}
            onUpdate={handleUpdateAnalysis}
            onDelete={handleDeleteAnalysis}
            onReanalyze={handleReanalyze}
            reanalyzing={reanalyzing}
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleReanalyze}
            disabled={reanalyzing}
          >
            {reanalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Lancer l'analyse IA
          </Button>
        )}

        {/* Info read-only */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Soumis par</span>
            <span>{ticket.submitted_by_email || "—"}</span>
          </div>
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

        {/* Resolution notes with voice dictation */}
        <div className="space-y-2">
          <Label className="text-sm">Notes de résolution</Label>
          <VoiceTextarea
            value={resolutionNotes}
            onValueChange={setResolutionNotes}
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
