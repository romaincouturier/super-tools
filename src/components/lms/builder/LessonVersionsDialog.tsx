import { History, RotateCcw, Calendar, Database, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useConfirm } from "@/hooks/useConfirm";
import { useLessonSnapshots, type LmsLessonSnapshot } from "@/hooks/useLmsQueries";
import { useRestoreLessonVersion, useDeleteLessonSnapshot } from "@/hooks/useLmsMutations";

interface Props {
  open: boolean;
  onClose: () => void;
  lessonId: string;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_err) {
    return iso;
  }
}

function sourceLabel(source: string): string {
  switch (source) {
    case "mcp":
      return "Assistant MCP";
    case "app":
      return "Application";
    case "restore":
      return "Restauration";
    default:
      return source;
  }
}

export default function LessonVersionsDialog({ open, onClose, lessonId }: Props) {
  const { confirm, ConfirmDialog } = useConfirm();
  const restore = useRestoreLessonVersion();
  const deleteSnapshot = useDeleteLessonSnapshot();
  const { data: versions = [], isLoading } = useLessonSnapshots(lessonId, open);

  async function handleRestore(snapshotId: string) {
    const ok = await confirm({
      title: "Restaurer cette version ?",
      description: "L'état actuel de la leçon sera sauvegardé automatiquement avant la restauration. Vous pourrez revenir en arrière.",
      confirmText: "Restaurer",
      cancelText: "Annuler",
    });
    if (!ok) return;
    await restore.mutateAsync(snapshotId);
  }

  async function handleDelete(snapshotId: string) {
    const ok = await confirm({
      title: "Supprimer cette version ?",
      description: "Cette action est irréversible.",
      confirmText: "Supprimer",
      cancelText: "Annuler",
      variant: "destructive",
    });
    if (!ok) return;
    await deleteSnapshot.mutateAsync(snapshotId);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-full max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History size={18} />
            Versions de la leçon
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Chaque version contient une copie complète des blocs au moment où elle a été créée.
          Restaurer une version sauvegarde automatiquement l'état actuel.
        </p>

        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        )}

        {!isLoading && versions.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Aucune version sauvegardée pour cette leçon.
          </div>
        )}

        <div className="space-y-2 mt-2">
          {versions.map((v: LmsLessonSnapshot, index: number) => (
            <div
              key={v.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Calendar size={14} className="shrink-0 text-muted-foreground" />
                  <span>{formatDate(v.created_at)}</span>
                  {index === 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">plus récent</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                  <Database size={12} />
                  <span>{v.block_count} bloc{v.block_count > 1 ? "s" : ""}</span>
                  <span className="mx-1">·</span>
                  <span>{sourceLabel(v.source)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Restaurer cette version"
                  disabled={restore.isPending}
                  onClick={() => handleRestore(v.id)}
                >
                  <RotateCcw size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Supprimer cette version"
                  disabled={deleteSnapshot.isPending}
                  onClick={() => handleDelete(v.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <ConfirmDialog />
      </DialogContent>
    </Dialog>
  );
}
