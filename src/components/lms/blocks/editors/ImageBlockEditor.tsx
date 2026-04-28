import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Upload } from "lucide-react";
import { uploadLmsImage } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { formatFileSize } from "@/lib/file-utils";
import RichTextEditor from "@/components/content/RichTextEditor";
import type { ImageBlockContent } from "@/types/lms-blocks";

interface Props {
  lessonId: string;
  content: ImageBlockContent;
  onChange: (content: ImageBlockContent) => void;
}

export default function ImageBlockEditor({ lessonId, content, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadLmsImage(file, lessonId);
      onChange({ ...content, url });
      toast({ title: `Image importée (${formatFileSize(file.size)})` });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1">
          <Label>URL de l'image</Label>
          <Input
            value={content.url || ""}
            onChange={(e) => onChange({ ...content, url: e.target.value || null })}
            placeholder="https://… ou téléversez un fichier"
          />
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
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
      {content.url && (
        <div className="rounded-lg overflow-hidden bg-muted border max-w-2xl">
          <img src={content.url} alt="" className="w-full h-auto object-contain max-h-[500px]" />
        </div>
      )}
      <div>
        <Label>Légende / description (optionnel)</Label>
        <RichTextEditor
          content={content.caption_html || ""}
          onChange={(caption_html) => onChange({ ...content, caption_html })}
        />
      </div>
    </div>
  );
}
