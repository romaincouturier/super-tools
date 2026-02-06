import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Mission } from "@/types/missions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Upload, Plus } from "lucide-react";

interface MediaUploadDialogProps {
  missions: Mission[];
}

const MediaUploadDialog = ({ missions }: MediaUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedMissionId, setSelectedMissionId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

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
    if (!selectedMissionId) {
      toast.error("Veuillez sélectionner une mission");
      return;
    }

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
        const path = `${selectedMissionId}/${Date.now()}_${sanitized}`;

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
            mission_id: selectedMissionId,
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
        queryClient.invalidateQueries({ queryKey: ["media-library"] });
        setOpen(false);
        setSelectedMissionId("");
      }
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Erreur lors de l'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter des médias
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter des médias</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Mission selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Mission</label>
            <Select value={selectedMissionId} onValueChange={setSelectedMissionId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner une mission..." />
              </SelectTrigger>
              <SelectContent>
                {missions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.emoji ? `${m.emoji} ` : ""}{m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Upload zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              !selectedMissionId && "opacity-50 pointer-events-none",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 cursor-pointer"
            )}
            onClick={() => selectedMissionId && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
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
                  Glissez vos fichiers ici, ou cliquez pour sélectionner
                </p>
                <p className="text-xs text-muted-foreground">
                  Images et vidéos — max 50 Mo par fichier
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MediaUploadDialog;
