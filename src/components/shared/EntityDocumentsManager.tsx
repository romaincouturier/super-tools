/**
 * Reusable document manager for any entity (missions, trainings, etc.).
 * Handles upload, download, delete with consistent UI.
 */
import { useRef, useState, useCallback } from "react";
import { FileText, Upload, Download, Trash2, Package } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatFileSize, downloadFile } from "@/lib/file-utils";
import {
  DocumentEntityType,
  useEntityDocuments,
  useAddEntityDocument,
  useDeleteEntityDocument,
  useToggleDocumentDeliverable,
  uploadEntityDocument,
  deleteEntityDocumentFile,
} from "@/hooks/useEntityDocuments";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface EntityDocumentsManagerProps {
  entityType: DocumentEntityType;
  entityId: string;
  /** Card or bare (for embedding in tabs) */
  variant?: "card" | "bare";
  /** Accepted MIME types (default: all) */
  accept?: string;
  /** Custom title */
  title?: string;
}

const EntityDocumentsManager = ({
  entityType,
  entityId,
  variant = "card",
  accept,
  title = "Documents",
}: EntityDocumentsManagerProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useEntityDocuments(entityType, entityId);
  const addDocument = useAddEntityDocument(entityType);
  const deleteDocument = useDeleteEntityDocument(entityType);
  const toggleDeliverable = useToggleDocumentDeliverable(entityType);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    // Capture files BEFORE clearing the input (clearing empties the FileList reference)
    const files = Array.from(fileList);
    if (fileInputRef.current) fileInputRef.current.value = "";

    setUploading(true);
    let successCount = 0;

    try {
      for (const file of Array.from(files)) {
        try {
          const fileUrl = await uploadEntityDocument(file, entityType, entityId);
          await addDocument.mutateAsync({
            entityId,
            file_name: file.name,
            file_url: fileUrl,
            file_size: file.size,
          });
          successCount++;
        } catch (err: unknown) {
          console.error("[EntityDocumentsManager] Upload error:", err);
          toast.error(`Erreur lors de l'upload de ${file.name}`, {
            description: (err instanceof Error ? err.message : "Erreur inconnue"),
          });
        }
      }

      if (successCount > 0) {
        toast.success(
          successCount === 1
            ? "Document ajouté"
            : `${successCount} documents ajoutés`,
        );
      }
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = useCallback(async (docId: string, fileUrl: string, fileName: string) => {
    setDownloadingId(docId);
    try {
      await downloadFile(fileUrl, fileName);
    } catch (err: unknown) {
      console.error("Download error:", err);
      toast.error("Erreur de téléchargement", {
        description: err instanceof Error ? err.message : "Impossible de télécharger le document.",
      });
    } finally {
      setDownloadingId(null);
    }
  }, []);

  const handleDelete = useCallback(async (docId: string, fileUrl: string, fileName: string) => {
    if (!confirm(`Supprimer le document "${fileName}" ?`)) return;

    setDeletingId(docId);
    try {
      // Delete DB row first (this is what matters), storage is best-effort
      await deleteDocument.mutateAsync({ id: docId, entityId });
      // Best-effort storage cleanup (non-blocking)
      deleteEntityDocumentFile(fileUrl, entityType).catch((err) =>
        console.warn("Storage cleanup failed:", err)
      );
      toast.success("Document supprimé", { description: fileName });
    } catch (err: unknown) {
      console.error("Delete error:", err);
      toast.error("Erreur de suppression", {
        description: err instanceof Error ? err.message : "Impossible de supprimer le document.",
      });
    } finally {
      setDeletingId(null);
    }
  }, [entityType, deleteDocument, entityId]);

  const content = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        accept={accept}
        onChange={handleFileSelect}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner size="md" className="text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <div
          className="border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer border-muted-foreground/25 hover:border-primary/50"
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Spinner size="lg" className="text-primary" />
              <p className="text-sm text-muted-foreground">Upload en cours...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Cliquez pour ajouter des documents
              </p>
              <p className="text-xs text-muted-foreground">
                Plusieurs fichiers à la fois
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {[...documents].sort((a, b) => (b.is_deliverable ? 1 : 0) - (a.is_deliverable ? 1 : 0)).map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-2 py-2 px-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.file_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.created_at && format(parseISO(doc.created_at), "d MMM yyyy", { locale: fr })}
                    {doc.created_at && doc.file_size != null && <>{" "}&middot;{" "}</>}
                    {formatFileSize(doc.file_size)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() =>
                        toggleDeliverable.mutate({
                          id: doc.id,
                          entityId,
                          is_deliverable: !doc.is_deliverable,
                        })
                      }
                      className={`h-8 w-8 flex items-center justify-center rounded-md transition-colors ${
                        doc.is_deliverable
                          ? "text-primary bg-primary/10"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                      title={doc.is_deliverable ? "Retirer des livrables" : "Marquer comme livrable"}
                    >
                      <Package className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {doc.is_deliverable ? "Retirer des livrables" : "Marquer comme livrable"}
                  </TooltipContent>
                </Tooltip>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  title="Télécharger"
                  disabled={downloadingId === doc.id}
                  onClick={() => handleDownload(doc.id, doc.file_url, doc.file_name)}
                >
                  {downloadingId === doc.id ? (
                    <Spinner />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  title="Supprimer"
                  disabled={deletingId === doc.id}
                  onClick={() => handleDelete(doc.id, doc.file_url, doc.file_name)}
                >
                  {deletingId === doc.id ? (
                    <Spinner />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}

          {/* Add more button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? (
              <Spinner className="mr-2" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {uploading ? "Upload en cours..." : "Ajouter un document"}
          </Button>
        </div>
      )}
    </>
  );

  if (variant === "bare") {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {title}
          {documents.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">
              ({documents.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
};

export default EntityDocumentsManager;
