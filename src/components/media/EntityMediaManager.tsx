import { useState, useRef, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  useEntityMedia,
  useAddMedia,
  useDeleteMedia,
  useToggleMediaDeliverable,
  useRenameMedia,
  uploadMediaFile,
  deleteMediaFile,
  MediaSourceType,
  MediaItem,
} from "@/hooks/useMedia";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatFileSize, downloadFile as downloadFileUtil } from "@/lib/file-utils";
import { ImageIcon, Video, Plus, Loader2, Upload, Trash2, Play, Download, Package, DownloadCloud, Pencil } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import MediaLightbox from "@/components/media/MediaLightbox";

interface EntityMediaManagerProps {
  sourceType: MediaSourceType;
  sourceId: string;
  sourceLabel: string;
  /** Show as a Card with header, or bare (for embedding in tabs) */
  variant?: "card" | "bare";
  /** Enable paste (Ctrl+V) upload */
  enablePaste?: boolean;
  /** Also allow video_link entries (for events) */
  allowVideoLinks?: boolean;
}

const getFileType = (file: File): "image" | "video" | null => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
};

const EntityMediaManager = ({
  sourceType,
  sourceId,
  sourceLabel,
  variant = "card",
  enablePaste = false,
  allowVideoLinks = false,
}: EntityMediaManagerProps) => {
  const { data: media = [], isLoading } = useEntityMedia(sourceType, sourceId);
  const addMedia = useAddMedia();
  const deleteMutation = useDeleteMedia();
  const toggleDeliverable = useToggleMediaDeliverable();
  const renameMedia = useRenameMedia();

  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lightboxItem, setLightboxItem] = useState<MediaItem | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter out video_link for display count purposes
  const imageItems = media.filter((m) => m.file_type === "image");
  const videoItems = media.filter((m) => m.file_type === "video");

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
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
    let successCount = 0;

    try {
      for (const file of validFiles) {
        try {
          const fileType = getFileType(file)!;
          const fileUrl = await uploadMediaFile(file, sourceType, sourceId);

          await addMedia.mutateAsync({
            file_url: fileUrl,
            file_name: file.name,
            file_type: fileType,
            mime_type: file.type,
            file_size: file.size,
            position: 0,
            source_type: sourceType,
            source_id: sourceId,
          });

          successCount++;
        } catch (err) {
          console.error("Upload error:", err);
          toast.error(`Erreur lors de l'upload de ${file.name}`);
        }
      }

      if (successCount > 0) {
        toast.success(
          successCount === 1
            ? "Fichier ajouté"
            : `${successCount} fichiers ajoutés`
        );
      }
    } finally {
      setUploading(false);
    }
  }, [sourceType, sourceId, addMedia]);

  const handleDelete = async (e: React.MouseEvent, item: MediaItem) => {
    e.stopPropagation();
    if (!confirm(`Supprimer ${item.file_name} ?`)) return;

    try {
      if (item.file_type !== "video_link") {
        await deleteMediaFile(item.file_url);
      }
      await deleteMutation.mutateAsync({
        id: item.id,
        sourceType: item.source_type,
        sourceId: item.source_id,
      });
      toast.success("Fichier supprimé");
      if (lightboxItem?.id === item.id) setLightboxItem(null);
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const handleDownloadFile = async (e: React.MouseEvent, url: string, fileName: string) => {
    e.stopPropagation();
    try {
      await downloadFileUtil(url, fileName);
    } catch {
      toast.error("Erreur lors du téléchargement");
    }
  };

  const handleDownloadAll = async () => {
    const downloadable = media.filter((m) => m.file_type !== "video_link");
    if (downloadable.length === 0) return;

    setDownloading(true);
    let successCount = 0;
    try {
      for (const item of downloadable) {
        try {
          await downloadFileUtil(item.file_url, item.file_name);
          successCount++;
        } catch {
          console.error(`Download error: ${item.file_name}`);
        }
      }
      if (successCount > 0) {
        toast.success(
          successCount === 1
            ? "1 fichier téléchargé"
            : `${successCount} fichiers téléchargés`
        );
      }
    } finally {
      setDownloading(false);
    }
  };

  const handleRename = (e: React.MouseEvent, item: MediaItem) => {
    e.stopPropagation();
    const currentName = item.file_name;
    const ext = currentName.includes(".") ? currentName.slice(currentName.lastIndexOf(".")) : "";
    const nameWithoutExt = currentName.includes(".") ? currentName.slice(0, currentName.lastIndexOf(".")) : currentName;
    const newName = window.prompt("Nouveau nom du fichier :", nameWithoutExt);
    if (newName === null || newName.trim() === "" || newName.trim() === nameWithoutExt) return;
    const finalName = newName.trim() + ext;
    renameMedia.mutate(
      { id: item.id, file_name: finalName },
      {
        onSuccess: () => toast.success(`Renommé en "${finalName}"`),
        onError: () => toast.error("Erreur lors du renommage"),
      }
    );
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  // Paste support
  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      if (!enablePaste) return;
      const items = e.clipboardData?.items;
      if (!items) return;

      const pastedFiles: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/") || item.type.startsWith("video/")) {
          const file = item.getAsFile();
          if (file) pastedFiles.push(file);
        }
      }

      if (pastedFiles.length > 0) {
        e.preventDefault();
        uploadFiles(pastedFiles);
      }
    },
    [enablePaste, uploadFiles]
  );

  useEffect(() => {
    if (!enablePaste) return;
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste, enablePaste]);

  // Items suitable for lightbox (exclude video_link)
  const lightboxItems = media.filter((m) => m.file_type !== "video_link");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const content = (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*,.svg"
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
                {enablePaste
                  ? "Glissez, collez (Ctrl+V) ou cliquez pour ajouter des médias"
                  : "Glissez vos photos et vidéos ici, ou cliquez pour sélectionner"}
              </p>
              <p className="text-xs text-muted-foreground">
                Plusieurs fichiers à la fois — max 50 Mo par fichier
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
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

            {[...media].filter((m) => m.file_type !== "video_link").sort((a, b) => (b.is_deliverable ? 1 : 0) - (a.is_deliverable ? 1 : 0)).map((item) => (
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
                <div className="absolute inset-0 bg-black/60 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity flex items-center justify-center gap-1 z-10">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={item.is_deliverable ? "default" : "secondary"}
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleDeliverable.mutate({
                            id: item.id,
                            sourceType: item.source_type,
                            sourceId: item.source_id,
                            is_deliverable: !item.is_deliverable,
                          });
                        }}
                      >
                        <Package className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {item.is_deliverable ? "Retirer des livrables" : "Marquer comme livrable"}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => handleRename(e, item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Renommer</TooltipContent>
                  </Tooltip>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7"
                    onClick={(e) => handleDownloadFile(e, item.file_url, item.file_name)}
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

                {/* Deliverable badge */}
                {item.is_deliverable && (
                  <div className="absolute top-1 left-1">
                    <Package className="h-3.5 w-3.5 text-white drop-shadow" />
                  </div>
                )}

                {item.file_type === "video" && (
                  <div className="absolute top-1 right-1">
                    <Video className="h-3.5 w-3.5 text-white drop-shadow" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxItem && (
        <MediaLightbox
          item={lightboxItem}
          items={lightboxItems}
          onClose={() => setLightboxItem(null)}
          onNavigate={setLightboxItem}
          onToggleDeliverable={(item) => {
            toggleDeliverable.mutate({
              id: item.id,
              sourceType: item.source_type,
              sourceId: item.source_id,
              is_deliverable: !item.is_deliverable,
            });
          }}
        />
      )}
    </>
  );

  if (variant === "bare") {
    return <div className="space-y-4">{content}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Photos & Vidéos
            {media.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({imageItems.length} image{imageItems.length !== 1 ? "s" : ""}
                {videoItems.length > 0 && `, ${videoItems.length} vidéo${videoItems.length !== 1 ? "s" : ""}`})
              </span>
            )}
          </CardTitle>
          {media.filter((m) => m.file_type !== "video_link").length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDownloadAll}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <DownloadCloud className="h-4 w-4 mr-2" />
              )}
              Tout télécharger
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
};

export default EntityMediaManager;
