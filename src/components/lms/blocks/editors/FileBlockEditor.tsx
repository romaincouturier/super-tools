import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { Upload, Paperclip, X } from "lucide-react";
import { uploadLmsFile } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { formatFileSize } from "@/lib/file-utils";
import RichTextEditor from "@/components/content/RichTextEditor";
import type { FileBlockContent } from "@/types/lms-blocks";

interface Props {
  lessonId: string;
  content: FileBlockContent;
  onChange: (content: FileBlockContent) => void;
}

export default function FileBlockEditor({ lessonId, content, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadLmsFile(file, lessonId);
      onChange({ ...content, url: result.url, name: result.name, size: result.size });
      toast({ title: `Fichier importé (${formatFileSize(file.size)})` });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    onChange({ ...content, url: null, name: null, size: null });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1">
          <Label>Fichier à télécharger</Label>
          {content.url ? (
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border mt-1">
              <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{content.name || "Fichier"}</p>
                {content.size != null && content.size > 0 && (
                  <p className="text-xs text-muted-foreground">{formatFileSize(content.size)}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" className="shrink-0" onClick={handleRemove} title="Retirer">
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Aucun fichier importé</p>
          )}
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full sm:w-auto">
            {uploading ? <Spinner className="mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            {uploading ? "Upload…" : "Importer"}
          </Button>
        </div>
      </div>
      <div>
        <Label>Description / instructions (optionnel)</Label>
        <RichTextEditor
          content={content.description_html || ""}
          onChange={(description_html) => onChange({ ...content, description_html })}
        />
      </div>
    </div>
  );
}
