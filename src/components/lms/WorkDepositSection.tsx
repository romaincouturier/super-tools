import DOMPurify from "dompurify";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Upload,
  FileText,
  Lock,
  Globe2,
  CheckCircle2,
  Pencil,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { formatFileSize } from "@/lib/file-utils";
import { maskEmail } from "@/lib/demoMask";
import { useLearnerProfile } from "@/hooks/useLearnerProfile";
import {
  useMyDeposits,
  useVisibleDeposits,
  useCreateDeposit,
  useUpdateDeposit,
  useDeleteDeposit,
  uploadDepositFile,
} from "@/hooks/useLmsWorkDeposit";
import DepositCommentList from "@/components/lms/DepositCommentList";
import DepositFeedbackList from "@/components/lms/DepositFeedbackList";
import {
  withDepositDefaults,
  isFileFormatAllowed,
  PEDAGOGICAL_STATUS_LABELS,
  VISIBILITY_LABELS,
  FORMAT_LABELS,
  FORMAT_MIME_ACCEPT,
  type WorkDeposit,
  type WorkDepositConfig,
  type UpdateWorkDepositInput,
} from "@/types/lms-work-deposit";
import DepositFilePreview from "@/components/lms/DepositFilePreview";

const MAX_DEPOSIT_FILES = 10;
const SHOW_PEERS_STORAGE_KEY = "lms_show_peer_deposits";

/** Label shown for a deposit author — never the raw e-mail address. */
function depositAuthorLabel(d: { author_display_name: string | null; learner_email: string }): string {
  return d.author_display_name?.trim() || maskEmail(d.learner_email);
}

interface Props {
  lessonId: string;
  courseId: string;
  moduleId: string | null;
  learnerEmail: string;
  rawConfig: WorkDepositConfig;
  /** Lesson title so the SuperTilt feedback email can reference it later. */
  lessonTitle: string;
}

export default function WorkDepositSection({
  lessonId,
  courseId,
  moduleId,
  learnerEmail,
  rawConfig,
  lessonTitle: _lessonTitle,
}: Props) {
  const config = withDepositDefaults(rawConfig);
  const { toast } = useToast();
  const { data: myProfile } = useLearnerProfile(learnerEmail);
  const myDisplayName =
    [myProfile?.first_name, myProfile?.last_name].filter(Boolean).join(" ").trim() || null;
  const { data: myDeposits = [], isLoading } = useMyDeposits(lessonId, learnerEmail);
  const createDeposit = useCreateDeposit(lessonId, learnerEmail);
  const updateDeposit = useUpdateDeposit(lessonId, learnerEmail);
  const deleteDeposit = useDeleteDeposit(lessonId, learnerEmail);

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="h-3.5 w-3.5" /> Chargement…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {myDeposits.map((deposit) => (
        <div key={deposit.id} className="space-y-4">
          <DepositSummary
            deposit={deposit}
            config={config}
            saving={updateDeposit.isPending}
            deleting={deleteDeposit.isPending}
            onUpdate={async (updates) => {
              await updateDeposit.mutateAsync({ id: deposit.id, updates });
            }}
            onReplaceFile={async (file) => {
              const upload = await uploadDepositFile(file, lessonId, learnerEmail);
              await updateDeposit.mutateAsync({
                id: deposit.id,
                updates: {
                  file_url: upload.url,
                  file_name: upload.name,
                  file_size: upload.size,
                  file_mime: upload.mime,
                },
              });
              toast({ title: "Fichier remplacé." });
            }}
            onDelete={async () => {
              if (!window.confirm("Supprimer définitivement ce dépôt ? Cette action est irréversible.")) return;
              try {
                await deleteDeposit.mutateAsync(deposit.id);
                toast({ title: "Dépôt supprimé." });
              } catch (err) {
                toastError(toast, err instanceof Error ? err : "Erreur de suppression");
              }
            }}
            onError={(err) => toastError(toast, err instanceof Error ? err : "Erreur")}
          />

          {config.feedback_enabled && (
            <DepositFeedbackList depositId={deposit.id} learnerEmail={learnerEmail} />
          )}

          {config.comments_enabled && deposit.visibility === "shared" && (
            <div className="rounded-lg border bg-card p-4 sm:p-5">
              <DepositCommentList depositId={deposit.id} learnerEmail={learnerEmail} canPost={true} />
            </div>
          )}
        </div>
      ))}

      <DepositForm
        config={config}
        hasExisting={myDeposits.length > 0}
        submitting={createDeposit.isPending}
        onSubmit={async ({ files, comment }) => {
          for (const file of files) {
            const upload = await uploadDepositFile(file, lessonId, learnerEmail);
            await createDeposit.mutateAsync({
              lesson_id: lessonId,
              course_id: courseId,
              module_id: moduleId,
              learner_email: learnerEmail,
              author_display_name: myDisplayName,
              file_url: upload.url,
              file_name: upload.name,
              file_size: upload.size,
              file_mime: upload.mime,
              comment: comment.trim() || null,
              visibility: "shared",
            });
          }
          toast({
            title: files.length > 1
              ? `${files.length} travaux ont bien été déposés.`
              : "Votre travail a bien été déposé.",
          });
        }}
        onError={(err) => toastError(toast, err instanceof Error ? err : "Erreur d'envoi")}
      />

      <PeerDepositsSection
        lessonId={lessonId}
        learnerEmail={learnerEmail}
        commentsEnabled={config.comments_enabled}
      />
    </div>
  );
}

// ── Peer deposits (other learners, shared) ────────────────────────

function PeerDepositsSection({
  lessonId,
  learnerEmail,
  commentsEnabled,
}: {
  lessonId: string;
  learnerEmail: string;
  commentsEnabled: boolean;
}) {
  const { data: deposits = [] } = useVisibleDeposits(lessonId, learnerEmail);
  const peers = deposits.filter((d) => d.learner_email !== learnerEmail);

  // Masqués par défaut pour la lisibilité ; le choix est conservé entre leçons / reconnexions.
  const [showPeers, setShowPeers] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SHOW_PEERS_STORAGE_KEY) === "1";
  });

  const toggle = () => {
    setShowPeers((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SHOW_PEERS_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  if (peers.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          Travaux partagés par d'autres apprenants ({peers.length})
        </h3>
        <Button variant="ghost" size="sm" onClick={toggle} className="text-xs shrink-0">
          {showPeers ? "Masquer" : "Afficher"}
        </Button>
      </div>
      {showPeers && (
        <ul className="space-y-3">
          {peers.map((d) => (
            <li key={d.id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground break-all">{depositAuthorLabel(d)}</span>
                <span className="text-muted-foreground shrink-0">
                  {new Date(d.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
              <DepositPreview deposit={d} />
              {d.comment && (
                <p className="text-sm italic text-muted-foreground break-words">« {d.comment} »</p>
              )}
              {commentsEnabled && (
                <DepositCommentList depositId={d.id} learnerEmail={learnerEmail} canPost={true} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Deposit form (no deposit yet) ──────────────────────────────────

function DepositForm({
  config,
  hasExisting,
  submitting,
  onSubmit,
  onError,
}: {
  config: Required<WorkDepositConfig>;
  hasExisting: boolean;
  submitting: boolean;
  onSubmit: (input: { files: File[]; comment: string }) => Promise<void>;
  onError: (err: unknown) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [comment, setComment] = useState("");
  const accept = config.accepted_formats.map((f) => FORMAT_MIME_ACCEPT[f]).join(",");
  const maxSizeBytes = config.max_size_mb * 1024 * 1024;

  const pickFiles = (picked: File[]) => {
    const valid: File[] = [];
    for (const f of picked) {
      if (!isFileFormatAllowed(f.type, config.accepted_formats)) {
        onError(new Error(`Format non accepté pour "${f.name}". Formats : ${config.accepted_formats.map((x) => FORMAT_LABELS[x]).join(", ")}.`));
        continue;
      }
      if (f.size > maxSizeBytes) {
        onError(new Error(`"${f.name}" est trop volumineux (max ${config.max_size_mb} Mo).`));
        continue;
      }
      valid.push(f);
    }
    setFiles((prev) => {
      const next = [...prev, ...valid];
      if (next.length > MAX_DEPOSIT_FILES) {
        onError(new Error(`Vous pouvez déposer au maximum ${MAX_DEPOSIT_FILES} fichiers à la fois.`));
        return next.slice(0, MAX_DEPOSIT_FILES);
      }
      return next;
    });
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (files.length === 0) {
      onError(new Error("Sélectionnez au moins un fichier à déposer."));
      return;
    }
    try {
      await onSubmit({ files, comment });
      setFiles([]);
      setComment("");
    } catch (err) {
      onError(err);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="font-semibold">{hasExisting ? "Ajouter un autre dépôt" : config.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {hasExisting
            ? "Vous pouvez déposer plusieurs travaux sur cette leçon. Chaque dépôt est conservé."
            : "Ajoutez ici votre exercice pour garder une trace de votre progression et le partager avec les autres apprenants de cette formation."}
        </p>
      </div>

      {config.instructions_html && (
        <div
          className="rounded-md bg-muted/40 p-3 prose prose-sm max-w-none break-words"
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(config.instructions_html) }}
        />
      )}

      {config.expected_deliverable && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Livrable attendu :</span> {config.expected_deliverable}
        </p>
      )}

      <div>
        <Label>Fichiers</Label>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length) pickFiles(picked);
            e.target.value = "";
          }}
        />
        {files.length > 0 && (
          <ul className="space-y-2 mt-1">
            {files.map((f, idx) => (
              <li key={`${f.name}-${idx}`} className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-md border bg-muted/40">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0 text-sm">
                  <p className="font-medium break-words">{f.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => removeFile(idx)} className="self-end sm:self-auto">
                  <X className="h-3.5 w-3.5 mr-1" /> Retirer
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2">
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            className="w-full sm:w-auto"
            disabled={files.length >= MAX_DEPOSIT_FILES}
          >
            <Upload className="h-4 w-4 mr-2" />
            {files.length > 0 ? "Ajouter d'autres fichiers" : "Choisir un ou plusieurs fichiers"}
          </Button>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            Formats : {config.accepted_formats.map((f) => FORMAT_LABELS[f]).join(", ")} — taille max {config.max_size_mb} Mo par fichier — {MAX_DEPOSIT_FILES} fichiers max
          </p>
        </div>
      </div>

      <div>
        <Label htmlFor="deposit-comment">Commentaire (optionnel)</Label>
        <Textarea
          id="deposit-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          placeholder="Ajoutez un mot pour SuperTilt ou pour les autres apprenants…"
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSubmit} disabled={files.length === 0 || submitting} className="w-full sm:w-auto">
          {submitting ? <Spinner className="mr-2" /> : null}
          {files.length > 1 ? `Envoyer mes ${files.length} travaux` : "Envoyer mon travail"}
        </Button>
      </div>
    </div>
  );
}

// ── Deposit summary (deposit exists) ───────────────────────────────

function DepositSummary({
  deposit,
  config,
  saving,
  deleting,
  onUpdate,
  onReplaceFile,
  onDelete,
  onError,
}: {
  deposit: WorkDeposit;
  config: Required<WorkDepositConfig>;
  saving: boolean;
  deleting: boolean;
  onUpdate: (updates: UpdateWorkDepositInput) => Promise<void>;
  onReplaceFile: (file: File) => Promise<void>;
  onDelete: () => Promise<void>;
  onError: (err: unknown) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingComment, setEditingComment] = useState(false);
  const [commentDraft, setCommentDraft] = useState(deposit.comment || "");
  const accept = config.accepted_formats.map((f) => FORMAT_MIME_ACCEPT[f]).join(",");
  const maxSizeBytes = config.max_size_mb * 1024 * 1024;

  const handleSaveComment = async () => {
    try {
      await onUpdate({ comment: commentDraft.trim() || null });
      setEditingComment(false);
    } catch (err) {
      onError(err);
    }
  };

  const handleReplaceFile = async (f: File) => {
    if (!isFileFormatAllowed(f.type, config.accepted_formats)) {
      onError(new Error(`Format non accepté. Formats : ${config.accepted_formats.map((x) => FORMAT_LABELS[x]).join(", ")}.`));
      return;
    }
    if (f.size > maxSizeBytes) {
      onError(new Error(`Fichier trop volumineux (max ${config.max_size_mb} Mo).`));
      return;
    }
    try {
      await onReplaceFile(f);
    } catch (err) {
      onError(err);
    }
  };

  const dateLabel = new Date(deposit.created_at).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="rounded-lg border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold">Votre travail a bien été déposé.</h3>
          <p className="text-xs text-muted-foreground">Déposé le {dateLabel}</p>
        </div>
      </div>

      {/* Preview */}
      <DepositPreview deposit={deposit} />

      {/* Comment */}
      <div>
        <Label className="text-xs">Votre commentaire</Label>
        {editingComment ? (
          <div className="space-y-2">
            <Textarea
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              rows={3}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveComment} disabled={saving}>
                {saving ? <Spinner className="mr-2" /> : null}
                Enregistrer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setCommentDraft(deposit.comment || "");
                  setEditingComment(false);
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic break-words">
            {deposit.comment || "Aucun commentaire."}
          </p>
        )}
      </div>

      {/* Status + visibility */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Statut :</span>
          <span className="font-medium">{PEDAGOGICAL_STATUS_LABELS[deposit.pedagogical_status]}</span>
        </div>
        <div className="flex items-center gap-2">
          {deposit.visibility === "shared" ? (
            <Globe2 className="h-3.5 w-3.5 text-blue-600" />
          ) : (
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <span className={cn("font-medium", deposit.visibility === "shared" && "text-blue-700")}>
            {VISIBILITY_LABELS[deposit.visibility]}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditingComment((v) => !v)}
          disabled={editingComment}
        >
          <Pencil className="h-3.5 w-3.5 mr-2" />
          Modifier mon dépôt
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={saving}
        >
          <RefreshCw className="h-3.5 w-3.5 mr-2" />
          Remplacer le fichier
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDelete}
          disabled={deleting}
          className="text-destructive hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5 mr-2" />
          Supprimer mon dépôt
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleReplaceFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

// File preview is delegated to DepositFilePreview, shared with the BO admin drawer.
const DepositPreview = DepositFilePreview;
