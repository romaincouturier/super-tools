import { useState } from "react";
import { MessageSquareQuote, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import {
  FEEDBACK_ROLE_LABELS,
  FEEDBACK_SOURCE_LABELS,
  useDeleteTrainingFeedback,
  useSaveTrainingFeedback,
  useTrainingFeedbacks,
} from "@/hooks/useTrainingFeedbacks";
import { todayAsISO } from "@/lib/dateFormatters";
import { demoBlur, maskName } from "@/lib/demoMask";
import { toastError } from "@/lib/toastError";

export interface FeedbackParticipantOption {
  id: string;
  name: string;
}

interface Props {
  trainingId: string;
  /** Fixe le participant (fiche participant) : la liste est filtrée et l'ajout lui est rattaché. */
  participant?: FeedbackParticipantOption;
  /** Participants proposés à l'ajout depuis la fiche formation. */
  participants?: FeedbackParticipantOption[];
}

const NONE = "__none__";
const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR");

const TrainingFeedbacksPanel = ({ trainingId, participant, participants = [] }: Props) => {
  const { toast } = useToast();
  const { isDemoMode } = useDemoMode();
  const { confirm, ConfirmDialog } = useConfirm();
  const { data: feedbacks = [], isLoading } = useTrainingFeedbacks(trainingId, participant?.id);
  const save = useSaveTrainingFeedback();
  const remove = useDeleteTrainingFeedback();

  const [open, setOpen] = useState(false);
  const [participantId, setParticipantId] = useState(participant?.id ?? NONE);
  const [authorRole, setAuthorRole] = useState("participant");
  const [authorName, setAuthorName] = useState("");
  const [source, setSource] = useState("email");
  const [receivedAt, setReceivedAt] = useState(todayAsISO());
  const [content, setContent] = useState("");
  const [consent, setConsent] = useState(false);

  const openDialog = () => {
    setParticipantId(participant?.id ?? NONE);
    setAuthorRole("participant");
    setAuthorName("");
    setSource("email");
    setReceivedAt(todayAsISO());
    setContent("");
    setConsent(false);
    setOpen(true);
  };

  const pickedParticipant = participant ?? participants.find((p) => p.id === participantId);

  const handleSave = async () => {
    try {
      await save.mutateAsync({
        training_id: trainingId,
        participant_id: pickedParticipant?.id ?? null,
        author_role: pickedParticipant ? "participant" : authorRole,
        author_name: pickedParticipant?.name ?? (authorName.trim() || null),
        source,
        received_at: receivedAt,
        content: content.trim(),
        consent_publication: consent,
      });
      setOpen(false);
      toast({ title: "Retour enregistré" });
    } catch (e) {
      toastError(toast, e);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: "Supprimer ce retour ?", description: "Cette action est irréversible.", confirmText: "Supprimer", variant: "destructive" });
    if (!ok) return;
    try {
      await remove.mutateAsync(id);
    } catch (e) {
      toastError(toast, e);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Retours reçus par email, téléphone ou à l'oral, hors questionnaires.</p>
        <Button size="sm" variant="outline" onClick={openDialog}>
          <Plus className="h-4 w-4 mr-1" /> Ajouter
        </Button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : feedbacks.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Aucun retour enregistré.</p>
      ) : (
        <ul className="space-y-2">
          {feedbacks.map((f) => (
            <li key={f.id} className="rounded-md border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <MessageSquareQuote className="h-3.5 w-3.5 text-muted-foreground" />
                {!participant && <span className="font-medium">{isDemoMode ? maskName(f.author_name) : f.author_name || "Auteur inconnu"}</span>}
                <Badge variant="outline">{FEEDBACK_ROLE_LABELS[f.author_role] ?? f.author_role}</Badge>
                <Badge variant="secondary">{FEEDBACK_SOURCE_LABELS[f.source] ?? f.source}</Badge>
                <span className="text-muted-foreground">{fmt(f.received_at)}</span>
                {f.consent_publication && <Badge>Accord de citation</Badge>}
                <Button size="icon" variant="ghost" className="h-6 w-6 ml-auto" onClick={() => handleDelete(f.id)} aria-label="Supprimer">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-sm whitespace-pre-wrap" style={demoBlur(isDemoMode)}>{f.content}</p>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Ajouter un retour</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!participant && (
              <div className="space-y-1.5">
                <Label>Participant</Label>
                <Select value={participantId} onValueChange={setParticipantId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Pas un participant (commanditaire, autre)</SelectItem>
                    {participants.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{isDemoMode ? maskName(p.name) : p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {!pickedParticipant && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Auteur</Label>
                  <Input value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder="Nom" />
                </div>
                <div className="space-y-1.5">
                  <Label>Rôle</Label>
                  <Select value={authorRole} onValueChange={setAuthorRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="commanditaire">Commanditaire</SelectItem>
                      <SelectItem value="autre">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={source} onValueChange={setSource}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FEEDBACK_SOURCE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Reçu le</Label>
                <Input type="date" value={receivedAt} onChange={(e) => setReceivedAt(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Retour</Label>
              <VoiceTextarea rows={6} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Coller le texte du mail ou résumer l'échange" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} />
              La personne accepte d'être citée (témoignage)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSave} disabled={!content.trim() || !receivedAt || save.isPending}>
              {save.isPending && <Spinner className="mr-2" />} Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog />
    </div>
  );
};

export default TrainingFeedbacksPanel;
