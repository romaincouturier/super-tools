import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mission } from "@/types/missions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Loader2,
  Plus,
  Trash2,
  ImageIcon,
  Video,
  X,
  Upload,
  Play,
} from "lucide-react";

interface MediaItem {
  id: string;
  mission_id: string;
  file_url: string;
  file_name: string;
  file_type: "image" | "video";
  mime_type: string | null;
  file_size: number | null;
  position: number;
  created_at: string;
}

interface MissionGalleryProps {
  mission: Mission;
}

const MissionGallery = ({ mission }: MissionGalleryProps) => {
  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMedia();
  }, [mission.id]);

  const fetchMedia = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("mission_media")
        .select("*")
        .eq("mission_id", mission.id)
        .order("position", { ascending: true });

      if (error) throw error;
      setMediaItems((data || []) as MediaItem[]);
    } catch (error) {
      console.error("Error fetching media:", error);
    } finally {
      setLoading(false);
    }
  };

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

      for (const file of validFiles) {
        const fileType = getFileType(file)!;
        const sanitized = sanitizeFileName(file.name);
        const path = `${mission.id}/${Date.now()}_${sanitized}`;

        const { error: uploadError } = await supabase.storage
          .from("mission-media")
          .upload(path, file);

        if (uploadError) {
          console.error("Upload error:", uploadError);
          toast.error(`Erreur lors de l'upload de ${file.name}`);
          continue;
        }

        const { data: urlData } = supabase.storage
          .from("mission-media")
          .getPublicUrl(path);

        const { error: insertError } = await (supabase as any)
          .from("mission_media")
          .insert({
            mission_id: mission.id,
            file_url: urlData.publicUrl,
            file_name: file.name,
            file_type: fileType,
            mime_type: file.type,
            file_size: file.size,
            position: mediaItems.length,
            created_by: userId,
          });

        if (insertError) {
          console.error("Insert error:", insertError);
          toast.error(`Erreur lors de l'enregistrement de ${file.name}`);
        }
      }

      toast.success(
        validFiles.length === 1
          ? "Fichier ajouté"
          : `${validFiles.length} fichiers ajoutés`
      );
      fetchMedia();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (item: MediaItem) => {
    if (!confirm(`Supprimer ${item.file_name} ?`)) return;

    try {
      // Extract path from URL
      const url = new URL(item.file_url);
      const pathParts = url.pathname.split("/mission-media/");
      if (pathParts.length > 1) {
        await supabase.storage
          .from("mission-media")
          .remove([decodeURIComponent(pathParts[1])]);
      }

      const { error } = await (supabase as any)
        .from("mission_media")
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      toast.success("Fichier supprimé");
      fetchMedia();
      if (lightboxItem?.id === item.id) setLightboxItem(null);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload zone */}
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-primary/50"
        )}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
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
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Upload en cours...</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Glissez vos photos ou vidéos ici, ou cliquez pour sélectionner
            </p>
            <p className="text-xs text-muted-foreground">
              Images (PNG, JPG, WebP, GIF) et vidéos (MP4, WebM, MOV) — max 50 Mo
            </p>
          </div>
        )}
      </div>

      {/* Media grid */}
      {mediaItems.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aucun média pour cette mission
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {mediaItems.map((item) => (
            <div
              key={item.id}
              className="group relative aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer"
              onClick={() => setLightboxItem(item)}
            >
              {item.file_type === "image" ? (
                <img
                  src={item.file_url}
                  alt={item.file_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-muted relative">
                  <video
                    src={item.file_url}
                    className="w-full h-full object-cover"
                    preload="metadata"
                    muted
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Play className="h-10 w-10 text-white drop-shadow" />
                  </div>
                </div>
              )}

              {/* Overlay with info and delete */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-white text-xs truncate">
                    {item.file_type === "image" ? (
                      <ImageIcon className="h-3 w-3 flex-shrink-0" />
                    ) : (
                      <Video className="h-3 w-3 flex-shrink-0" />
                    )}
                    <span className="truncate">{item.file_name}</span>
                  </div>
                  <Button
                    variant="destructive"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {item.file_size && (
                  <span className="text-white/70 text-xs">
                    {formatFileSize(item.file_size)}
                  </span>
                )}
              </div>
            </div>
          ))}

          {/* Add more button */}
          <button
            className="aspect-square rounded-lg border-2 border-dashed border-muted-foreground/25 hover:border-primary/50 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="h-6 w-6" />
            <span className="text-xs">Ajouter</span>
          </button>
        </div>
      )}

      {/* Lightbox */}
      {lightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxItem(null)}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-4 right-4 text-white hover:bg-white/20 z-10"
            onClick={() => setLightboxItem(null)}
          >
            <X className="h-6 w-6" />
          </Button>

          <div
            className="max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {lightboxItem.file_type === "image" ? (
              <img
                src={lightboxItem.file_url}
                alt={lightboxItem.file_name}
                className="max-w-full max-h-[90vh] object-contain rounded"
              />
            ) : (
              <video
                src={lightboxItem.file_url}
                controls
                autoPlay
                className="max-w-full max-h-[90vh] rounded"
              />
            )}
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm bg-black/50 px-3 py-1 rounded">
            {lightboxItem.file_name}
            {lightboxItem.file_size && ` — ${formatFileSize(lightboxItem.file_size)}`}
          </div>
        </div>
      )}
    </div>
  );
};

export default MissionGallery;
