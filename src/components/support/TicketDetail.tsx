import { useState } from "react";
import { Bug, Lightbulb } from "lucide-react";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SUPPORT_COLUMNS,
  TICKET_TYPE_CONFIG,
  type SupportTicket,
  type TicketType,
  type TicketPriority,
  type TicketStatus,
} from "@/types/support";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import AiAnalysisSection from "./AiAnalysisSection";

interface Props {
  ticket: SupportTicket;
  onUpdate: (id: string, updates: Partial<SupportTicket>) => void;
}

export default function TicketDetail({ ticket, onUpdate }: Props) {
  const typeConf = TICKET_TYPE_CONFIG[ticket.type];
  const [resolutionNotes, setResolutionNotes] = useState(ticket.resolution_notes || "");
  const [title, setTitle] = useState(ticket.title);
  const [type, setType] = useState<TicketType>(ticket.type);
  const [assignedTo, setAssignedTo] = useState(ticket.assigned_to || "");
  const [pageUrl, setPageUrl] = useState(ticket.page_url || "");

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
        <div className="grid grid-cols-3 gap-3">
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

        {/* Assigné à */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Assigné à</Label>
          <Input
            value={assignedTo}
            onChange={(e) => setAssignedTo(e.target.value)}
            onBlur={() => { if (assignedTo !== (ticket.assigned_to || "")) onUpdate(ticket.id, { assigned_to: assignedTo || null }); }}
            placeholder="Email ou nom de la personne"
            className="text-sm"
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
        {ticket.ai_analysis && <AiAnalysisSection analysis={ticket.ai_analysis} />}

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
