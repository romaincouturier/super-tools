import { useState, useEffect, useCallback } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Pencil, Send, MessageSquare } from "lucide-react";
import type { Improvement, ImprovementNote, ImprovementStatus } from "@/hooks/useImprovements";
import { STATUS_CONFIG, CATEGORY_CONFIG, KANBAN_COLUMNS } from "@/hooks/useImprovements";

interface ImprovementDetailDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  improvement: Improvement | null;
  onStatusChange: (id: string, status: ImprovementStatus) => void;
  onEdit: (improvement: Improvement) => void;
  fetchNotes: (improvementId: string) => Promise<ImprovementNote[]>;
  addNote: (improvementId: string, content: string, userId?: string) => Promise<void>;
  userId?: string;
}

export default function ImprovementDetailDrawer({
  open,
  onOpenChange,
  improvement,
  onStatusChange,
  onEdit,
  fetchNotes,
  addNote,
  userId,
}: ImprovementDetailDrawerProps) {
  const [notes, setNotes] = useState<ImprovementNote[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const loadNotes = useCallback(async () => {
    if (!improvement) return;
    setLoadingNotes(true);
    const data = await fetchNotes(improvement.id);
    setNotes(data);
    setLoadingNotes(false);
  }, [improvement, fetchNotes]);

  useEffect(() => {
    if (open && improvement) loadNotes();
  }, [open, improvement, loadNotes]);

  const handleAddNote = async () => {
    if (!improvement || !newNote.trim()) return;
    setSavingNote(true);
    await addNote(improvement.id, newNote, userId);
    setNewNote("");
    await loadNotes();
    setSavingNote(false);
  };

  if (!improvement) return null;

  const status = improvement.status as ImprovementStatus;
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const cat = CATEGORY_CONFIG[improvement.category] || { label: improvement.category, variant: "outline" as const };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            {improvement.title}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={cat.variant}>{cat.label}</Badge>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
              {cfg.label}
            </span>
            {improvement.priority && (
              <Badge variant={improvement.priority === "haute" ? "destructive" : "outline"}>
                Priorité {improvement.priority}
              </Badge>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { onOpenChange(false); onEdit(improvement); }}>
              <Pencil className="h-4 w-4 mr-1" />
              Modifier
            </Button>
            <Select
              value={status}
              onValueChange={(v) => onStatusChange(improvement.id, v as ImprovementStatus)}
            >
              <SelectTrigger className="w-[160px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KANBAN_COLUMNS.map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Formation : </span>
              {improvement.trainings?.training_name || "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Responsable : </span>
              {improvement.responsible || "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Échéance : </span>
              {improvement.deadline ? new Date(improvement.deadline).toLocaleDateString("fr-FR") : "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Source : </span>
              {improvement.source_type || "—"}
            </div>
            <div>
              <span className="text-muted-foreground">Créée le : </span>
              {new Date(improvement.created_at).toLocaleDateString("fr-FR")}
            </div>
            {improvement.completed_at && (
              <div>
                <span className="text-muted-foreground">Terminée le : </span>
                {new Date(improvement.completed_at).toLocaleDateString("fr-FR")}
              </div>
            )}
          </div>

          <Separator />

          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold mb-1">Description</h3>
            <p className="text-sm whitespace-pre-wrap">{improvement.description}</p>
          </div>

          {improvement.source_description && (
            <div>
              <h3 className="text-sm font-semibold mb-1">Description de la source</h3>
              <p className="text-sm italic text-muted-foreground">{improvement.source_description}</p>
            </div>
          )}

          <Separator />

          {/* Notes / Historique */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4" />
              Notes de suivi ({notes.length})
            </h3>

            {/* Add note */}
            <div className="flex gap-2 mb-4">
              <VoiceTextarea
                value={newNote}
                onValueChange={setNewNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Ajouter une note de suivi..."
                rows={2}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={handleAddNote}
                disabled={savingNote || !newNote.trim()}
                className="self-end"
              >
                {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>

            {/* Notes list */}
            {loadingNotes ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : notes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Aucune note de suivi</p>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <div key={note.id} className="border rounded-lg p-3 bg-muted/30">
                    <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                    <div className="text-xs text-muted-foreground mt-2">
                      {new Date(note.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
