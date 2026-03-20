import { useState, useRef } from "react";
import { toast } from "sonner";
import { Mission } from "@/types/missions";
import { useAddMedia, uploadMediaFile, MediaSourceType } from "@/hooks/useMedia";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { resolveContentType } from "@/lib/file-utils";
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
import { Loader2, Upload, Plus, Briefcase, GraduationCap, CalendarDays, HandCoins } from "lucide-react";

interface EntityOption {
  id: string;
  label: string;
  emoji?: string | null;
}

interface MediaUploadDialogProps {
  missions: EntityOption[];
  trainings?: EntityOption[];
  events?: EntityOption[];
  crmCards?: EntityOption[];
}

const MediaUploadDialog = ({ missions, trainings = [], events = [], crmCards = [] }: MediaUploadDialogProps) => {
  const [open, setOpen] = useState(false);
  const [selectedSourceType, setSelectedSourceType] = useState<MediaSourceType>("mission");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMedia = useAddMedia();

  const getFileType = (file: File): "image" | "video" | null => {
    const mime = resolveContentType(file);
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    return null;
  };

  const currentEntities = (): EntityOption[] => {
    switch (selectedSourceType) {
      case "mission": return missions;
      case "training": return trainings;
      case "event": return events;
      case "crm": return crmCards;
      default: return [];
    }
  };

  const uploadFiles = async (files: FileList | File[]) => {
    if (!selectedEntityId) {
      toast.error("Veuillez sélectionner une entité");
      return;
    }

    const fileArray = Array.from(files);
    const validFiles = fileArray.filter((f) => getFileType(f) !== null);

    if (validFiles.length === 0) {
      toast.error("Seules les images et vidéos sont acceptées");
      return;
    }

    setUploading(true);

    try {
      let successCount = 0;

      for (const file of validFiles) {
        try {
          const fileType = getFileType(file)!;
          const fileUrl = await uploadMediaFile(file, selectedSourceType, selectedEntityId);

          await addMedia.mutateAsync({
            file_url: fileUrl,
            file_name: file.name,
            file_type: fileType,
            mime_type: file.type,
            file_size: file.size,
            position: 0,
            source_type: selectedSourceType,
            source_id: selectedEntityId,
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
        setOpen(false);
        setSelectedEntityId("");
      }
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

  const handleSourceTypeChange = (value: string) => {
    setSelectedSourceType(value as MediaSourceType);
    setSelectedEntityId("");
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
          {/* Source type selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Type de source</label>
            <Select value={selectedSourceType} onValueChange={handleSourceTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mission">
                  <span className="flex items-center gap-2">
                    <Briefcase className="h-3.5 w-3.5" /> Mission
                  </span>
                </SelectItem>
                <SelectItem value="training">
                  <span className="flex items-center gap-2">
                    <GraduationCap className="h-3.5 w-3.5" /> Formation
                  </span>
                </SelectItem>
                <SelectItem value="event">
                  <span className="flex items-center gap-2">
                    <CalendarDays className="h-3.5 w-3.5" /> Événement
                  </span>
                </SelectItem>
                <SelectItem value="crm">
                  <span className="flex items-center gap-2">
                    <HandCoins className="h-3.5 w-3.5" /> Opportunité
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Entity selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {selectedSourceType === "mission" ? "Mission" :
               selectedSourceType === "training" ? "Formation" :
               selectedSourceType === "event" ? "Événement" : "Opportunité"}
            </label>
            <Select value={selectedEntityId} onValueChange={setSelectedEntityId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {currentEntities().map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.emoji ? `${e.emoji} ` : ""}{e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Upload zone */}
          <div
            className={cn(
              "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
              !selectedEntityId && "opacity-50 pointer-events-none",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 cursor-pointer"
            )}
            onClick={() => selectedEntityId && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
          >
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
                  Images et vidéos
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
