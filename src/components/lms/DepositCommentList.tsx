import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { MessageSquare, Pencil, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useConfirm } from "@/hooks/useConfirm";
import {
  useDepositComments,
  useCreateDepositComment,
  useUpdateDepositComment,
  useDeleteDepositComment,
} from "@/hooks/useLmsWorkDeposit";
import type { DepositComment } from "@/types/lms-work-deposit";

interface Props {
  depositId: string;
  learnerEmail: string;
  /** Whether the current user is allowed to post a new comment. */
  canPost: boolean;
}

const REMINDER =
  "Partagez un retour utile et bienveillant : ce que vous comprenez, ce qui vous parle, ou une question que le travail vous inspire.";

export default function DepositCommentList({ depositId, learnerEmail, canPost }: Props) {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const { data: comments = [], isLoading } = useDepositComments(depositId, learnerEmail);
  const createComment = useCreateDepositComment(depositId, learnerEmail);
  const updateComment = useUpdateDepositComment(depositId, learnerEmail);
  const deleteComment = useDeleteDepositComment(depositId, learnerEmail);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const handleSubmit = async () => {
    if (!draft.trim()) return;
    try {
      await createComment.mutateAsync(draft.trim());
      setDraft("");
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'envoi");
    }
  };

  const startEdit = (c: DepositComment) => {
    setEditingId(c.id);
    setEditDraft(c.content);
  };

  const handleUpdate = async () => {
    if (!editingId) return;
    try {
      await updateComment.mutateAsync({ id: editingId, content: editDraft.trim() });
      setEditingId(null);
      setEditDraft("");
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur");
    }
  };

  const handleDelete = async (c: DepositComment) => {
    const ok = await confirm({
      title: "Supprimer ce commentaire ?",
      description: "Cette action est définitive.",
      confirmText: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteComment.mutateAsync(c.id);
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur");
    }
  };

  const visible = comments.filter((c) => c.status === "published");

  return (
    <div className="border-t pt-4 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="font-medium">
          Commentaires{visible.length > 0 ? ` (${visible.length})` : ""}
        </span>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Chargement…</p>}

      {visible.length === 0 && !isLoading && (
        <p className="text-xs text-muted-foreground italic">Aucun commentaire pour le moment.</p>
      )}

      <ul className="space-y-2">
        {visible.map((c) => {
          const isMine = c.author_email === learnerEmail;
          const isEditing = editingId === c.id;
          return (
            <li key={c.id} className="rounded-md border bg-card p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-muted-foreground break-all">{c.author_email}</p>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(c.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                </span>
              </div>
              {isEditing ? (
                <div className="space-y-2 mt-1">
                  <Textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={3} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleUpdate} disabled={updateComment.isPending}>
                      {updateComment.isPending ? <Spinner className="mr-2" /> : null}
                      Enregistrer
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-sm mt-1 whitespace-pre-wrap break-words">{c.content}</p>
              )}
              {isMine && !isEditing && (
                <div className="flex gap-1 mt-2">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(c)} className="h-7 text-xs">
                    <Pencil className="h-3 w-3 mr-1" /> Modifier
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(c)}
                    className="h-7 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Supprimer
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {canPost && (
        <div className="space-y-2">
          <p className="text-[11px] text-muted-foreground italic break-words">{REMINDER}</p>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            placeholder="Écrivez votre commentaire…"
          />
          <div className="flex justify-end gap-2">
            {draft && (
              <Button size="sm" variant="ghost" onClick={() => setDraft("")}>
                <X className="h-3.5 w-3.5 mr-1" /> Annuler
              </Button>
            )}
            <Button size="sm" onClick={handleSubmit} disabled={!draft.trim() || createComment.isPending}>
              {createComment.isPending ? <Spinner className="mr-2" /> : null}
              Publier
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog />
    </div>
  );
}
