import { useEffect, useRef, useState } from "react";
import { Eye, Paperclip, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useConfirm } from "@/hooks/useConfirm";
import { useVhdAttachments, type VhdAttachment } from "@/hooks/useVhdAttachments";
import { rpc, type VhdNarrativeAccess } from "@/lib/supabase-rpc";

/**
 * Pièces jointes et journal des consultations d'un signalement.
 *
 * Les deux tiennent au même principe : ce qui touche au récit d'une victime
 * laisse une trace et ne quitte pas la base. Les fichiers vivent dans un
 * bucket privé exclu de la sauvegarde Drive, et chaque ouverture du récit est
 * journalisée par la base avant que le texte ne soit rendu.
 */

interface Props {
  reportId: string;
  /** Rechargé à chaque ouverture du récit, pour que le journal reste juste. */
  narrativeReadAt: number;
}

export function VhdReportEvidence({ reportId, narrativeReadAt }: Props) {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const { attachments, loading, uploading, upload, openUrl, remove } = useVhdAttachments(reportId);
  const [accesses, setAccesses] = useState<VhdNarrativeAccess[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    rpc.getVhdNarrativeAccess(reportId).then(({ data }) => {
      if (!cancelled) setAccesses(data || []);
    });
    return () => {
      cancelled = true;
    };
  }, [reportId, narrativeReadAt]);

  const handleOpen = async (attachment: VhdAttachment) => {
    const url = await openUrl(attachment);
    if (!url) return;
    // Le lien signé expire en quelques minutes : on l'ouvre, on ne le stocke pas.
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handlePick = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      toastError(toast, "Fichier trop volumineux (25 Mo maximum)");
      return;
    }
    await upload(file);
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <div className="space-y-4 border-t pt-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="flex items-center gap-2">
            <Paperclip className="h-4 w-4" />
            Pièces jointes
          </Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? <Spinner className="mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
            Ajouter
          </Button>
          <input
            ref={fileInput}
            type="file"
            className="hidden"
            onChange={(e) => handlePick(e.target.files?.[0])}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Conservées hors de la sauvegarde externe, comme le récit. Elles ne
          s'ouvrent que par un lien signé valable quelques minutes.
        </p>

        {loading ? (
          <div className="flex justify-center py-4"><Spinner /></div>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune pièce jointe.</p>
        ) : (
          <ul className="space-y-1">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <span className="flex-1 truncate">{attachment.file_name}</span>
                {attachment.file_size !== null && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {Math.max(1, Math.round(attachment.file_size / 1024))} Ko
                  </span>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpen(attachment)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Supprimer cette pièce jointe ?",
                      description: `${attachment.file_name} sera définitivement effacé.`,
                    });
                    if (ok) await remove(attachment);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Consultations du récit
        </Label>
        {accesses.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune consultation enregistrée pour ce signalement.
          </p>
        ) : (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {accesses.slice(0, 10).map((access) => (
              <li key={`${access.accessed_at}-${access.user_id ?? "?"}`} className="tabular-nums">
                {new Date(access.accessed_at).toLocaleString("fr-FR")}
                {access.reader ? ` — ${access.reader}` : ""}
              </li>
            ))}
            {accesses.length > 10 && (
              <li className="text-xs">et {accesses.length - 10} consultation
                {accesses.length - 10 > 1 ? "s" : ""} plus ancienne
                {accesses.length - 10 > 1 ? "s" : ""}.
              </li>
            )}
          </ul>
        )}
      </div>
      <ConfirmDialog />
    </div>
  );
}

export default VhdReportEvidence;
