import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { formatFileSize } from "@/lib/file-utils";
import {
  useMyDeposit,
  useVisibleDeposits,
  useCreateDeposit,
  useUpdateDeposit,
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
  type DepositVisibility,
  type UpdateWorkDepositInput,
} from "@/types/lms-work-deposit";

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
  const { data: deposit, isLoading } = useMyDeposit(lessonId, learnerEmail);
  const createDeposit = useCreateDeposit(lessonId, learnerEmail);
  const updateDeposit = useUpdateDeposit(lessonId, learnerEmail);

  if (isLoading) {
    return (
      <div className="rounded-lg border bg-card p-4 flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="h-3.5 w-3.5" /> Chargement…
      </div>
    );
  }

  if (!deposit) {
    return (
      <DepositForm
        config={config}
        submitting={createDeposit.isPending}
        onSubmit={async ({ file, comment, share }) => {
          const upload = await uploadDepositFile(file, lessonId, learnerEmail);
          await createDeposit.mutateAsync({
            lesson_id: lessonId,
            course_id: courseId,
            module_id: moduleId,
            learner_email: learnerEmail,
            file_url: upload.url,
            file_name: upload.name,
            file_size: upload.size,
            file_mime: upload.mime,
            comment: comment.trim() || null,
            visibility: share && config.sharing_allowed ? "shared" : "private",
          });
          toast({ title: "Votre travail a bien été déposé." });
        }}
        onError={(err) => toastError(toast, err instanceof Error ? err : "Erreur d'envoi")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <DepositSummary
        deposit={deposit}
        config={config}
        saving={updateDeposit.isPending}
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

      <PeerDepositsSection
        lessonId={lessonId}
        learnerEmail={learnerEmail}
        ownDepositId={deposit.id}
        commentsEnabled={config.comments_enabled}
      />
    </div>
  );
}

// ── Peer deposits (other learners, shared) ────────────────────────

function PeerDepositsSection({
  lessonId,
  learnerEmail,
  ownDepositId,
  commentsEnabled,
}: {
  lessonId: string;
  learnerEmail: string;
  ownDepositId: string;
  commentsEnabled: boolean;
}) {
  const { data: deposits = [] } = useVisibleDeposits(lessonId, learnerEmail);
  const peers = deposits.filter((d) => d.id !== ownDepositId);

  if (peers.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground">
        Travaux partagés des autres apprenants ({peers.length})
      </h3>
      <ul className="space-y-3">
        {peers.map((d) => (
          <li key={d.id} className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground break-all">{d.learner_email}</span>
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
    </div>
  );
}

// ── Deposit form (no deposit yet) ──────────────────────────────────

function DepositForm({
  config,
  submitting,
  onSubmit,
  onError,
}: {
  config: Required<WorkDepositConfig>;
  submitting: boolean;
  onSubmit: (input: { file: File; comment: string; share: boolean }) => Promise<void>;
  onError: (err: unknown) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [comment, setComment] = useState("");
  const [share, setShare] = useState(false);
  const accept = config.accepted_formats.map((f) => FORMAT_MIME_ACCEPT[f]).join(",");
  const maxSizeBytes = config.max_size_mb * 1024 * 1024;

  const pickFile = (f: File) => {
    if (!isFileFormatAllowed(f.type, config.accepted_formats)) {
      onError(new Error(`Format non accepté. Formats : ${config.accepted_formats.map((x) => FORMAT_LABELS[x]).join(", ")}.`));
      return;
    }
    if (f.size > maxSizeBytes) {
      onError(new Error(`Fichier trop volumineux (max ${config.max_size_mb} Mo).`));
      return;
    }
    setFile(f);
  };

  const handleSubmit = async () => {
    if (!file) {
      onError(new Error("Sélectionnez un fichier à déposer."));
      return;
    }
    try {
      await onSubmit({ file, comment, share });
      setFile(null);
      setComment("");
      setShare(false);
    } catch (err) {
      onError(err);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 sm:p-5 space-y-4">
      <div>
        <h3 className="font-semibold">{config.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Ajoutez ici votre exercice pour garder une trace de votre progression. Vous pouvez le garder
          privé ou le partager avec les autres apprenants de cette formation.
        </p>
      </div>

      {config.instructions_html && (
        <div
          className="rounded-md bg-muted/40 p-3 prose prose-sm max-w-none break-words"
          dangerouslySetInnerHTML={{ __html: config.instructions_html }}
        />
      )}

      {config.expected_deliverable && (
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Livrable attendu :</span> {config.expected_deliverable}
        </p>
      )}

      <div>
        <Label>Fichier</Label>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickFile(f);
            e.target.value = "";
          }}
        />
        {file ? (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-1 p-3 rounded-md border bg-muted/40">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0 text-sm">
              <p className="font-medium break-words">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="self-end sm:self-auto">
              <X className="h-3.5 w-3.5 mr-1" /> Retirer
            </Button>
          </div>
        ) : (
          <div className="mt-1">
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              className="w-full sm:w-auto"
            >
              <Upload className="h-4 w-4 mr-2" />
              Choisir un fichier
            </Button>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Formats : {config.accepted_formats.map((f) => FORMAT_LABELS[f]).join(", ")} — taille max {config.max_size_mb} Mo
            </p>
          </div>
        )}
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

      {config.sharing_allowed && (
        <label className="flex items-start gap-3 rounded-md border bg-muted/30 p-3 cursor-pointer">
          <Switch checked={share} onCheckedChange={setShare} className="mt-0.5" />
          <span className="text-sm flex-1 break-words">
            <span className="font-medium">Je souhaite partager ce travail</span> avec les autres apprenants
            de cette formation. Vous pourrez changer d'avis plus tard.
          </span>
        </label>
      )}

      <div className="flex justify-end pt-2">
        <Button onClick={handleSubmit} disabled={!file || submitting} className="w-full sm:w-auto">
          {submitting ? <Spinner className="mr-2" /> : null}
          Envoyer mon travail
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
  onUpdate,
  onReplaceFile,
  onError,
}: {
  deposit: WorkDeposit;
  config: Required<WorkDepositConfig>;
  saving: boolean;
  onUpdate: (updates: UpdateWorkDepositInput) => Promise<void>;
  onReplaceFile: (file: File) => Promise<void>;
  onError: (err: unknown) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingComment, setEditingComment] = useState(false);
  const [commentDraft, setCommentDraft] = useState(deposit.comment || "");
  const accept = config.accepted_formats.map((f) => FORMAT_MIME_ACCEPT[f]).join(",");
  const maxSizeBytes = config.max_size_mb * 1024 * 1024;

  const handleVisibilityChange = async (next: DepositVisibility) => {
    if (next === deposit.visibility) return;
    try {
      await onUpdate({ visibility: next });
    } catch (err) {
      onError(err);
    }
  };

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
      <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
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
        {config.sharing_allowed && (
          <Button
            variant={deposit.visibility === "shared" ? "secondary" : "outline"}
            size="sm"
            onClick={() => handleVisibilityChange(deposit.visibility === "shared" ? "private" : "shared")}
            disabled={saving}
          >
            {deposit.visibility === "shared" ? (
              <>
                <Lock className="h-3.5 w-3.5 mr-2" /> Repasser en privé
              </>
            ) : (
              <>
                <Globe2 className="h-3.5 w-3.5 mr-2" /> Partager
              </>
            )}
          </Button>
        )}
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

// ── File preview ────────────────────────────────────────────────────

function DepositPreview({ deposit }: { deposit: WorkDeposit }) {
  if (!deposit.file_url) return null;
  const mime = deposit.file_mime || "";
  const isImage = mime.startsWith("image/");
  const isVideo = mime.startsWith("video/");
  const isPdf = mime === "application/pdf";

  return (
    <div className="rounded-md border bg-muted/30 overflow-hidden">
      {isImage ? (
        <img src={deposit.file_url} alt={deposit.file_name || ""} className="w-full h-auto max-h-[420px] object-contain" />
      ) : isVideo ? (
        <video src={deposit.file_url} controls className="w-full h-auto max-h-[420px]" />
      ) : (
        <a
          href={deposit.file_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3 hover:bg-muted transition-colors"
        >
          <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium break-words">{deposit.file_name || "Fichier"}</p>
            {deposit.file_size != null && (
              <p className="text-xs text-muted-foreground">{formatFileSize(deposit.file_size)}{isPdf ? " · PDF" : ""}</p>
            )}
          </div>
        </a>
      )}
    </div>
  );
}
