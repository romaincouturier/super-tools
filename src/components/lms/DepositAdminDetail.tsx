import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Eye, EyeOff, Trash2, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useConfirm } from "@/hooks/useConfirm";
import {
  useAdminUpdateDeposit,
  useAdminDepositComments,
  useAdminDepositFeedback,
  useAdminCommentStatus,
  useCreateDepositFeedback,
  useUpdateDepositFeedback,
  useDeleteDepositFeedback,
} from "@/hooks/useLmsWorkDeposit";
import {
  PEDAGOGICAL_STATUS_LABELS,
  type AdminDepositRow,
  type DepositPedagogicalStatus,
  type DepositPublicationStatus,
} from "@/types/lms-work-deposit";
import { formatFileSize } from "@/lib/file-utils";

interface Props {
  deposit: AdminDepositRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STATUS_OPTIONS: DepositPedagogicalStatus[] = [
  "submitted",
  "seen",
  "feedback_received",
  "needs_completion",
  "validated",
];

export default function DepositAdminDetail({ deposit, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const updateDeposit = useAdminUpdateDeposit();
  const { data: comments = [] } = useAdminDepositComments(deposit?.id);
  const { data: feedback = [] } = useAdminDepositFeedback(deposit?.id);
  const moderateComment = useAdminCommentStatus(deposit?.id || "");
  const createFeedback = useCreateDepositFeedback(deposit?.id || "");
  const updateFeedback = useUpdateDepositFeedback(deposit?.id || "");
  const deleteFeedback = useDeleteDepositFeedback(deposit?.id || "");

  const [feedbackDraft, setFeedbackDraft] = useState("");
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);
  const [editFeedbackDraft, setEditFeedbackDraft] = useState("");

  if (!deposit) return null;

  const handleStatusChange = async (status: DepositPedagogicalStatus) => {
    try {
      await updateDeposit.mutateAsync({ id: deposit.id, updates: { pedagogical_status: status } });
      toast({ title: "Statut mis à jour" });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur");
    }
  };

  const handlePublicationToggle = async () => {
    const next: DepositPublicationStatus = deposit.publication_status === "published" ? "hidden" : "published";
    try {
      await updateDeposit.mutateAsync({ id: deposit.id, updates: { publication_status: next } });
      toast({ title: next === "hidden" ? "Travail masqué" : "Travail réaffiché" });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur");
    }
  };

  const handlePublishFeedback = async () => {
    if (!feedbackDraft.trim()) return;
    try {
      await createFeedback.mutateAsync(feedbackDraft.trim());
      setFeedbackDraft("");
      toast({ title: "Retour publié — l'apprenant est notifié par email." });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur");
    }
  };

  const handleEditFeedback = async (id: string) => {
    try {
      await updateFeedback.mutateAsync({ id, content: editFeedbackDraft.trim() });
      setEditingFeedbackId(null);
      setEditFeedbackDraft("");
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur");
    }
  };

  const handleDeleteFeedback = async (id: string) => {
    const ok = await confirm({
      title: "Supprimer ce retour ?",
      description: "Cette action est définitive.",
      confirmText: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteFeedback.mutateAsync(id);
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">
            {deposit.lesson_title || "Leçon"} — {deposit.learner_email}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Context */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Formation</dt>
              <dd className="font-medium break-words">{deposit.course_title || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Module</dt>
              <dd className="font-medium break-words">{deposit.module_title || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Visibilité</dt>
              <dd className="font-medium">{deposit.visibility === "shared" ? "Partagé" : "Privé"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Date</dt>
              <dd className="font-medium">{new Date(deposit.created_at).toLocaleString("fr-FR")}</dd>
            </div>
          </dl>

          {/* File preview */}
          {deposit.file_url && (
            <div className="rounded-md border bg-muted/30 overflow-hidden">
              {deposit.file_mime?.startsWith("image/") ? (
                <img src={deposit.file_url} alt={deposit.file_name || ""} className="w-full max-h-[420px] object-contain" />
              ) : deposit.file_mime?.startsWith("video/") ? (
                <video src={deposit.file_url} controls className="w-full max-h-[420px]" />
              ) : (
                <a
                  href={deposit.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 text-sm font-medium hover:bg-muted"
                >
                  {deposit.file_name || "Fichier"}
                  {deposit.file_size != null ? ` (${formatFileSize(deposit.file_size)})` : ""}
                </a>
              )}
            </div>
          )}

          {deposit.comment && (
            <div>
              <Label className="text-xs">Commentaire de l'apprenant</Label>
              <p className="text-sm italic text-muted-foreground break-words">« {deposit.comment} »</p>
            </div>
          )}

          {/* Status + publication */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Statut pédagogique</Label>
              <Select
                value={deposit.pedagogical_status}
                onValueChange={(v) => handleStatusChange(v as DepositPedagogicalStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{PEDAGOGICAL_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Modération</Label>
              <Button
                variant="outline"
                onClick={handlePublicationToggle}
                disabled={updateDeposit.isPending}
                className="w-full"
              >
                {deposit.publication_status === "published" ? (
                  <><EyeOff className="h-4 w-4 mr-2" /> Masquer le travail</>
                ) : (
                  <><Eye className="h-4 w-4 mr-2" /> Réafficher le travail</>
                )}
              </Button>
            </div>
          </div>

          {/* Feedback */}
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary shrink-0" /> Retours SuperTilt
            </h3>
            {feedback.length === 0 && <p className="text-xs text-muted-foreground italic">Aucun retour publié.</p>}
            <ul className="space-y-2">
              {feedback.map((f) => (
                <li key={f.id} className="rounded-md border p-3 space-y-2 bg-card">
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(f.created_at).toLocaleDateString("fr-FR")}
                    {f.email_sent ? " · email envoyé" : ""}
                  </p>
                  {editingFeedbackId === f.id ? (
                    <>
                      <Textarea value={editFeedbackDraft} onChange={(e) => setEditFeedbackDraft(e.target.value)} rows={3} />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleEditFeedback(f.id)} disabled={updateFeedback.isPending}>
                          {updateFeedback.isPending ? <Spinner className="mr-2" /> : null} Enregistrer
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingFeedbackId(null)}>
                          Annuler
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="text-sm whitespace-pre-wrap break-words">{f.content}</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingFeedbackId(f.id);
                            setEditFeedbackDraft(f.content);
                          }}
                          className="h-8 text-xs"
                        >
                          Modifier
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteFeedback(f.id)}
                          className="h-8 text-xs text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>

            <div className="space-y-2">
              <Textarea
                value={feedbackDraft}
                onChange={(e) => setFeedbackDraft(e.target.value)}
                rows={3}
                placeholder="Publier un retour à l'apprenant…"
              />
              <div className="flex justify-end">
                <Button onClick={handlePublishFeedback} disabled={!feedbackDraft.trim() || createFeedback.isPending}>
                  {createFeedback.isPending ? <Spinner className="mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                  Publier le retour
                </Button>
              </div>
            </div>
          </div>

          {/* Comments moderation */}
          <div className="border-t pt-4 space-y-3">
            <h3 className="font-semibold text-sm">Commentaires apprenants ({comments.length})</h3>
            {comments.length === 0 && <p className="text-xs text-muted-foreground italic">Aucun commentaire.</p>}
            <ul className="space-y-2">
              {comments.map((c) => (
                <li
                  key={c.id}
                  className={`rounded-md border p-3 space-y-1 ${c.status !== "published" ? "opacity-60 bg-muted/30" : "bg-card"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground break-all">{c.author_email}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {new Date(c.created_at).toLocaleDateString("fr-FR")}
                      {c.status !== "published" ? ` · ${c.status}` : ""}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {c.status !== "hidden" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moderateComment.mutate({ id: c.id, status: "hidden" })}
                        className="h-8 text-xs"
                      >
                        <EyeOff className="h-3.5 w-3.5 mr-1" /> Masquer
                      </Button>
                    )}
                    {c.status === "hidden" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moderateComment.mutate({ id: c.id, status: "published" })}
                        className="h-8 text-xs"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" /> Réafficher
                      </Button>
                    )}
                    {c.status !== "deleted" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moderateComment.mutate({ id: c.id, status: "deleted" })}
                        className="h-8 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Supprimer
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ConfirmDialog />
      </SheetContent>
    </Sheet>
  );
}
