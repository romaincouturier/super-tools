import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTrainingMedia, TrainingMediaItem } from "@/hooks/useTrainingMedia";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ImageIcon, Video, Plus, Loader2, Upload, Trash2, Play, Download } from "lucide-react";
import MediaLightbox from "@/components/media/MediaLightbox";
import { MediaItemWithMission } from "@/hooks/useMediaLibrary";

interface FormationMediaManagerProps {
  trainingId: string;
  trainingName: string;
}

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

const FormationMediaManager = ({ trainingId, trainingName }: FormationMediaManagerProps) => {
  const { data: media = [], invalidate } = useTrainingMedia(trainingId);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<MediaItemWithMission | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileType = (file: File): "image" | "video" | null => {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("video/")) return "video";
    return null;
  };

  const sanitizeFileName = (name: string) => {
    return name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .toLowerCase();
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((f) => getFileType(f) !== null);

    if (validFiles.length === 0) {
      toast.error("Seules les images et vidéos sont acceptées");
      return;
    }

    const oversized = validFiles.filter((f) => f.size > 50 * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error("Les fichiers ne doivent pas dépasser 50 Mo");
      return;
    }

    setUploading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        toast.error("Vous devez être connecté");
        return;
      }

      let successCount = 0;

      for (const file of validFiles) {
        const fileType = getFileType(file)!;
        const sanitized = sanitizeFileName(file.name);
        const path = `${trainingId}/${Date.now()}_${sanitized}`;

        const { error: uploadError } = await supabase.storage
          .from("training-media")
          .upload(path, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error(`Erreur lors de l'upload de ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("training-media")
          .getPublicUrl(path);

        const { error: insertError } = await (supabase as any)
          .from("training_media")
          .insert({
            training_id: trainingId,
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_type: fileType,
            mime_type: file.type,
            file_size: file.size,
            position: 0,
            created_by: userId,
          });

        if (insertError) {
          console.error("Insert error:", insertError);
          toast.error(`Erreur lors de l'enregistrement de ${file.name}`);
          continue;
        }

        successCount++;
      }

      if (successCount > 0) {
        toast.success(
          successCount === 1
            ? "Fichier ajouté"
            : `${successCount} fichiers ajoutés`
        );
        invalidate();
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent, item: TrainingMediaItem) => {
    e.stopPropagation();
    if (!confirm(`Supprimer ${item.file_name} ?`)) return;

    try {
      const url = new URL(item.file_url);
      const pathParts = url.pathname.split("/training-media/");
      if (pathParts.length > 1) {
        await supabase.storage
          .from("training-media")
          .remove([decodeURIComponent(pathParts[1])]);
      }

      const { error } = await (supabase as any)
        .from("training_media")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      toast.success("Fichier supprimé");
      invalidate();
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const downloadFile = async (e: React.MouseEvent, url: string, fileName: string) => {
    e.stopPropagation();
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.error("Erreur lors du téléchargement");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  // Convert TrainingMediaItem to MediaItemWithMission for lightbox compatibility
  const toLightboxItem = (item: TrainingMediaItem): MediaItemWithMission => ({
    id: item.id,
    mission_id: item.training_id,
    file_url: item.file_url,
    file_name: item.file_name,
    file_type: item.file_type,
    mime_type: item.mime_type,
    file_size: item.file_size,
    position: item.position,
    created_at: item.created_at,
    mission_title: trainingName,
    mission_tags: [trainingName],
    mission_emoji: null,
    mission_color: null,
    source: "event",
  });

  const lightboxItems = media.map(toLightboxItem);

  const imageCount = media.filter((m) => m.file_type === "image").length;
  const videoCount = media.filter((m) => m.file_type === "video").length;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Photos & Vidéos
              {media.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({imageCount} image{imageCount !== 1 ? "s" : ""}
                  {videoCount > 0 && `, ${videoCount} vidéo${videoCount !== 1 ? "s" : ""}`})
                </span>
              )}
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Ajouter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />

          {media.length === 0 ? (
            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-primary/50"
              )}
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Upload en cours...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Glissez vos photos et vidéos ici, ou cliquez pour sélectionner
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Plusieurs fichiers à la fois — max 50 Mo par fichier
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Media grid */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {media.map((item) => (
                  <div
                    key={item.id}
                    className="group relative aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer"
                    onClick={() => setLightboxItem(toLightboxItem(item))}
                  >
                    {item.file_type === "image" ? (
                      <img
                        src={item.file_url}
                        alt={item.file_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full relative">
                        <video
                          src={item.file_url}
                          className="w-full h-full object-cover"
                          preload="metadata"
                          muted
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="h-8 w-8 text-white drop-shadow" />
                        </div>
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => downloadFile(e, item.file_url, item.file_name)}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => handleDelete(e, item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* File type indicator */}
                    {item.file_type === "video" && (
                      <div className="absolute top-1 right-1">
                        <Video className="h-3.5 w-3.5 text-white drop-shadow" />
                      </div>
                    )}
                  </div>
                ))}

                {/* Add more button */}
                <div
                  className={cn(
                    "aspect-square rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors",
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                >
                  {uploading ? (
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  ) : (
                    <Plus className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lightbox */}
      {lightboxItem && (
        <MediaLightbox
          item={lightboxItem}
          items={lightboxItems}
          onClose={() => setLightboxItem(null)}
          onNavigate={setLightboxItem}
        />
      )}
    </>
  );
};

export default FormationMediaManager;
