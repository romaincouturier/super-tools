import { useState } from "react";
import DOMPurify from "dompurify";
import { Mail, Send, Eye, ChevronDown, ChevronUp, X, Pencil, Clock, CalendarDays } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useMissionEmailDrafts, type MissionEmailDraft } from "@/hooks/useMissionEmailDrafts";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface Props {
  /** If provided, shows only drafts for that mission. Otherwise shows all. */
  missionId?: string;
  /** If provided, shows the mission title on each card (for the global view). */
  showMissionLabel?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "En attente", variant: "outline" },
  approved: { label: "Approuvé", variant: "default" },
  scheduled: { label: "Programmé", variant: "default" },
  sent: { label: "Envoyé", variant: "secondary" },
  rejected: { label: "Rejeté", variant: "destructive" },
};

const TYPE_LABELS: Record<string, string> = {
  google_review: "Avis Google",
  video_testimonial: "Témoignage vidéo",
};

/**
 * Renders a list of mission email drafts with approve/reject/edit/schedule/send
 * actions. The comms manager uses this to validate drafts before they go out.
 */
export default function EmailDraftsList({ missionId, showMissionLabel = false }: Props) {
  const { drafts, isLoading, approveAndSend, rejectDraft, updateDraftContent, scheduleDraft } =
    useMissionEmailDrafts(missionId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner className="text-muted-foreground" />
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Aucun brouillon d'email.
      </p>
    );
  }

  const actionableDrafts = drafts.filter((d) => d.status === "pending" || d.status === "scheduled");
  const otherDrafts = drafts.filter((d) => d.status !== "pending" && d.status !== "scheduled");

  return (
    <div className="space-y-3">
      {actionableDrafts.length > 0 && (
        <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
          <Mail className="h-4 w-4" />
          {actionableDrafts.length} email{actionableDrafts.length > 1 ? "s" : ""} en attente
        </div>
      )}
      {actionableDrafts.map((draft) => (
        <DraftCard
          key={draft.id}
          draft={draft}
          showMissionLabel={showMissionLabel}
          onApproveAndSend={(id) => approveAndSend.mutate(id)}
          onReject={(id) => rejectDraft.mutate(id)}
          onUpdateContent={(id, subject, html) => updateDraftContent.mutate({ draftId: id, subject, html_content: html })}
          onSchedule={(id, date) => scheduleDraft.mutate({ draftId: id, scheduledFor: date })}
          isMutating={approveAndSend.isPending || rejectDraft.isPending || updateDraftContent.isPending || scheduleDraft.isPending}
        />
      ))}
      {otherDrafts.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground pt-2">Historique</p>
          {otherDrafts.map((draft) => (
            <DraftCard key={draft.id} draft={draft} showMissionLabel={showMissionLabel} isMutating={false} />
          ))}
        </>
      )}
    </div>
  );
}

function DraftCard({
  draft,
  showMissionLabel,
  onApproveAndSend,
  onReject,
  onUpdateContent,
  onSchedule,
  isMutating,
}: {
  draft: MissionEmailDraft;
  showMissionLabel: boolean;
  onApproveAndSend?: (id: string) => void;
  onReject?: (id: string) => void;
  onUpdateContent?: (id: string, subject: string, html: string) => void;
  onSchedule?: (id: string, date: string) => void;
  isMutating: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editSubject, setEditSubject] = useState(draft.subject);
  const [editHtml, setEditHtml] = useState(draft.html_content);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>();
  const [scheduleTime, setScheduleTime] = useState("09:00");

  const statusConf = STATUS_CONFIG[draft.status] || STATUS_CONFIG.pending;
  const isActionable = draft.status === "pending" || draft.status === "scheduled";

  const handleSaveEdit = () => {
    if (onUpdateContent) onUpdateContent(draft.id, editSubject, editHtml);
    setEditing(false);
  };

  const handleSchedule = () => {
    if (!scheduleDate || !onSchedule) return;
    const [hours, minutes] = scheduleTime.split(":").map(Number);
    const scheduledFor = new Date(scheduleDate);
    scheduledFor.setHours(hours, minutes, 0, 0);
    onSchedule(draft.id, scheduledFor.toISOString());
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant={statusConf.variant} className="text-[10px]">{statusConf.label}</Badge>
                <Badge variant="outline" className="text-[10px]">
                  {TYPE_LABELS[draft.email_type] || draft.email_type}
                </Badge>
                {draft.scheduled_for && (
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {format(new Date(draft.scheduled_for), "d MMM à HH:mm", { locale: fr })}
                  </Badge>
                )}
              </div>
              <p className="text-sm font-medium mt-1 truncate">{draft.subject}</p>
              <p className="text-xs text-muted-foreground">
                → {draft.contact_name ? `${draft.contact_name} (${draft.contact_email})` : draft.contact_email}
                {showMissionLabel && (draft as MissionEmailDraft & { mission_id: string }).mission_id && (
                  <span className="ml-2">
                    · Mission <code className="text-[10px]">{draft.mission_id.slice(0, 8)}</code>
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={() => setExpanded(!expanded)}
              className="p-1 rounded hover:bg-muted text-muted-foreground shrink-0"
              aria-label={expanded ? "Réduire" : "Développer"}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </div>

          {expanded && !editing && (
            <div
              className="text-xs border rounded p-3 bg-muted/20 max-h-48 overflow-y-auto prose prose-xs"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(draft.html_content) }}
            />
          )}

          {editing && (
            <div className="space-y-2 border rounded p-3 bg-muted/10">
              <div>
                <Label className="text-xs">Objet</Label>
                <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} className="text-sm" />
              </div>
              <div>
                <Label className="text-xs">Contenu HTML</Label>
                <Textarea value={editHtml} onChange={(e) => setEditHtml(e.target.value)} rows={10} className="text-xs font-mono" />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveEdit} disabled={isMutating} className="gap-1 text-xs">
                  Enregistrer
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="text-xs">
                  Annuler
                </Button>
              </div>
            </div>
          )}

          {isActionable && onApproveAndSend && onReject && (
            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => setPreviewOpen(true)} className="gap-1 text-xs">
                <Eye className="h-3 w-3" /> Prévisualiser
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditSubject(draft.subject);
                  setEditHtml(draft.html_content);
                  setEditing(true);
                  setExpanded(true);
                }}
                className="gap-1 text-xs"
              >
                <Pencil className="h-3 w-3" /> Modifier
              </Button>
              <div className="flex-1" />

              <Popover>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1 text-xs" disabled={isMutating}>
                    <CalendarDays className="h-3 w-3" /> Programmer
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3 space-y-3" align="end">
                  <Calendar mode="single" selected={scheduleDate} onSelect={setScheduleDate} locale={fr} />
                  <div className="flex items-center gap-2">
                    <Label className="text-xs shrink-0">Heure</Label>
                    <Input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="text-sm h-8 w-28" />
                  </div>
                  <Button size="sm" onClick={handleSchedule} disabled={!scheduleDate || isMutating} className="w-full gap-1 text-xs">
                    <Clock className="h-3 w-3" /> Programmer l'envoi
                  </Button>
                </PopoverContent>
              </Popover>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="gap-1 text-xs text-destructive hover:text-destructive" disabled={isMutating}>
                    <X className="h-3 w-3" /> Rejeter
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Rejeter ce brouillon ?</AlertDialogTitle>
                    <AlertDialogDescription>
                      L'email ne sera pas envoyé à {draft.contact_name || draft.contact_email}.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onReject(draft.id)} className="bg-destructive text-destructive-foreground">
                      Rejeter
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button size="sm" onClick={() => onApproveAndSend(draft.id)} disabled={isMutating} className="gap-1 text-xs">
                {isMutating ? <Spinner className="h-3 w-3" /> : <Send className="h-3 w-3" />}
                Envoyer maintenant
              </Button>
            </div>
          )}

          {draft.status === "sent" && draft.sent_at && (
            <p className="text-[10px] text-muted-foreground">
              Envoyé le {format(new Date(draft.sent_at), "d MMMM à HH:mm", { locale: fr })}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="w-full sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base">Prévisualisation</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Destinataire</p>
              <p className="text-sm">{draft.contact_name ? `${draft.contact_name} <${draft.contact_email}>` : draft.contact_email}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Objet</p>
              <p className="text-sm font-medium">{draft.subject}</p>
            </div>
            <div className="border rounded p-4 bg-white">
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(draft.html_content) }} />
            </div>
            {isActionable && onApproveAndSend && (
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fermer</Button>
                <Button
                  onClick={() => { onApproveAndSend(draft.id); setPreviewOpen(false); }}
                  disabled={isMutating}
                  className="gap-1"
                >
                  {isMutating ? <Spinner /> : <Send className="h-4 w-4" />}
                  Envoyer maintenant
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
