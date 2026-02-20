import { MediaItemWithMission } from "@/hooks/useMediaLibrary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageIcon, Video, Play, Trash2, Briefcase, Download, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface MediaGridProps {
  items: MediaItemWithMission[];
  onOpenLightbox: (item: MediaItemWithMission) => void;
}

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
};

const MediaGrid = ({ items, onOpenLightbox }: MediaGridProps) => {
  const queryClient = useQueryClient();

  const downloadFile = async (url: string, fileName: string) => {
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

  const handleDelete = async (e: React.MouseEvent, item: MediaItemWithMission) => {
    e.stopPropagation();
    if (!confirm(`Supprimer ${item.file_name} ?`)) return;

    try {
      const url = new URL(item.file_url);

      if (item.source === "training") {
        const pathParts = url.pathname.split("/training-media/");
        if (pathParts.length > 1) {
          await supabase.storage
            .from("training-media")
            .remove([decodeURIComponent(pathParts[1])]);
        }
      } else {
        const pathParts = url.pathname.split("/mission-media/");
        if (pathParts.length > 1) {
          await supabase.storage
            .from("mission-media")
            .remove([decodeURIComponent(pathParts[1])]);
        }
      }

      const tableName = item.source === "training" ? "training_media" : "mission_media";
      const { error } = await (supabase as any)
        .from(tableName)
        .delete()
        .eq("id", item.id);

      if (error) throw error;

      toast.success("Fichier supprimé");
      queryClient.invalidateQueries({ queryKey: ["media-library"] });
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Erreur lors de la suppression");
    }
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">Aucun média trouvé</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="group relative aspect-square rounded-lg overflow-hidden border bg-muted cursor-pointer"
          onClick={() => onOpenLightbox(item)}
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
                <Play className="h-10 w-10 text-white drop-shadow" />
              </div>
            </div>
          )}

          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1 text-white text-xs truncate">
                {item.file_type === "image" ? (
                  <ImageIcon className="h-3 w-3 flex-shrink-0" />
                ) : (
                  <Video className="h-3 w-3 flex-shrink-0" />
                )}
                <span className="truncate">{item.file_name}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadFile(item.file_url, item.file_name);
                  }}
                >
                  <Download className="h-3 w-3" />
                </Button>
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-6 w-6"
                  onClick={(e) => handleDelete(e, item)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-1 text-white/80 text-xs truncate">
              {item.source === "training" ? (
                <GraduationCap className="h-3 w-3 flex-shrink-0" />
              ) : (
                <Briefcase className="h-3 w-3 flex-shrink-0" />
              )}
              <span className="truncate">
                {item.mission_emoji ? `${item.mission_emoji} ` : ""}
                {item.mission_title}
              </span>
            </div>
            {item.file_size && (
              <span className="text-white/60 text-xs">{formatFileSize(item.file_size)}</span>
            )}
          </div>

          {/* Source tag (always visible) */}
          <div className="absolute top-2 left-2">
            <Badge
              variant="secondary"
              className="text-[10px] px-1.5 py-0 bg-black/50 text-white border-0 backdrop-blur-sm"
            >
              {item.source === "training"
                ? <GraduationCap className="h-2.5 w-2.5" />
                : (item.mission_emoji || <Briefcase className="h-2.5 w-2.5" />)
              }
              <span className="ml-1 max-w-[80px] truncate">{item.mission_title}</span>
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
};

export default MediaGrid;
