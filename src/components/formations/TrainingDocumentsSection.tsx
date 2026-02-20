import { useRef, useState } from "react";
import { FileText, Upload, Download, Trash2, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import {
  useTrainingDocuments,
  useAddTrainingDocument,
  useDeleteTrainingDocument,
  uploadTrainingDocument,
  deleteTrainingDocumentFile,
} from "@/hooks/useTrainingDocuments";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 Mo

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} octets`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

interface TrainingDocumentsSectionProps {
  trainingId: string;
}

const TrainingDocumentsSection = ({ trainingId }: TrainingDocumentsSectionProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const { data: documents = [], isLoading } = useTrainingDocuments(trainingId);
  const addDocument = useAddTrainingDocument();
  const deleteDocument = useDeleteTrainingDocument();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so the same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";

    if (file.size > MAX_FILE_SIZE) {
      toast.error("Fichier trop volumineux", {
        description: `La taille maximale est de 20 Mo. Ce fichier fait ${formatFileSize(file.size)}.`,
      });
      return;
    }

    setUploading(true);
    try {
      const fileUrl = await uploadTrainingDocument(file, trainingId);
      await addDocument.mutateAsync({
        training_id: trainingId,
        file_name: file.name,
        file_url: fileUrl,
        file_size: file.size,
      });
      toast.success("Document ajouté", {
        description: file.name,
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Erreur lors de l'upload", {
        description: error.message || "Impossible d'ajouter le document.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (docId: string, fileUrl: string, fileName: string) => {
    setDownloadingId(docId);
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error("Erreur de téléchargement");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Download error:", error);
      toast.error("Erreur de téléchargement", {
        description: error.message || "Impossible de télécharger le document.",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (docId: string, fileUrl: string, fileName: string) => {
    const confirmed = window.confirm(
      `Supprimer le document "${fileName}" ?`
    );
    if (!confirmed) return;

    setDeletingId(docId);
    try {
      // Delete from storage first
      await deleteTrainingDocumentFile(fileUrl);
      // Then delete the DB record
      await deleteDocument.mutateAsync({ id: docId, trainingId });
      toast.success("Document supprimé", {
        description: fileName,
      });
    } catch (error: any) {
      console.error("Delete error:", error);
      toast.error("Erreur de suppression", {
        description: error.message || "Impossible de supprimer le document.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents joints
          </CardTitle>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {uploading ? "Upload en cours..." : "Ajouter"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucun document joint. Cliquez sur "Ajouter" pour attacher un fichier.
          </p>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-2 py-2 px-3 rounded-md bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(doc.file_size)}
                      {doc.created_at && (
                        <>
                          {" "}
                          &middot;{" "}
                          {format(parseISO(doc.created_at), "d MMM yyyy", {
                            locale: fr,
                          })}
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Télécharger"
                    disabled={downloadingId === doc.id}
                    onClick={() =>
                      handleDownload(doc.id, doc.file_url, doc.file_name)
                    }
                  >
                    {downloadingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
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
                    onClick={() =>
                      handleDelete(doc.id, doc.file_url, doc.file_name)
                    }
                  >
                    {deletingId === doc.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TrainingDocumentsSection;
