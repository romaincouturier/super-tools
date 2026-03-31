import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Image, Video, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { resolveContentType, getFileType, formatFileSize } from "@/lib/file-utils";
import { useAddSupportImport, uploadSupportFile, type SupportImport } from "@/hooks/useTrainingSupport";

interface SupportBulkImportProps {
  supportId: string;
  imports: SupportImport[];
}

const SupportBulkImport = ({ supportId, imports }: SupportBulkImportProps) => {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addImport = useAddSupportImport();

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);

    try {
      let count = 0;
      for (const file of Array.from(files)) {
        const fileType = getFileType(file);
        if (fileType !== "image" && fileType !== "video") continue;

        const mimeType = resolveContentType(file);
        const fileUrl = await uploadSupportFile(file, supportId);

        await addImport.mutateAsync({
          supportId,
          fileUrl,
          fileName: file.name,
          fileType: fileType as "image" | "video",
          mimeType,
          fileSize: file.size,
        });
        count++;
      }

      toast.success(`${count} fichier${count > 1 ? "s" : ""} importé${count > 1 ? "s" : ""}`);
    } catch (error) {
      console.error("Bulk import error:", error);
      toast.error("Erreur lors de l'import");
    } finally {
      setUploading(false);
    }
  };

  if (imports.length === 0 && !uploading) {
    return (
      <div className="border-2 border-dashed rounded-lg p-4 text-center">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          Importer en masse
        </Button>
        <p className="text-xs text-muted-foreground mt-2">
          Importez des images et vidéos, puis affectez-les aux sections
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>
    );
  }

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-muted/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">Images/vidéos à affecter</h4>
          <Badge variant="secondary" className="text-[10px]">{imports.length}</Badge>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
          Ajouter
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {imports.map((imp) => (
          <div key={imp.id} className="relative w-20 h-20 rounded border overflow-hidden group">
            {imp.file_type === "image" ? (
              <img src={imp.file_url} alt={imp.file_name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full relative bg-muted">
                <video
                  src={`${imp.file_url}#t=0.1`}
                  className="w-full h-full object-cover"
                  preload="metadata"
                  muted
                  playsInline
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/20 gap-0.5 px-1">
                  <Video className="h-4 w-4 text-white drop-shadow" />
                  <span className="text-[9px] text-white/80 truncate w-full text-center">{imp.file_name}</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Ouvrez une section et cliquez sur l'icone image pour affecter ces fichiers.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
};

export default SupportBulkImport;
