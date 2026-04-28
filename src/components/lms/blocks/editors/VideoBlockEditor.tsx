import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Upload } from "lucide-react";
import { uploadLmsVideo } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { formatFileSize } from "@/lib/file-utils";
import VideoBlockViewer from "@/components/lms/blocks/viewers/VideoBlockViewer";
import type { VideoBlockContent } from "@/types/lms-blocks";

interface Props {
  lessonId: string;
  content: VideoBlockContent;
  onChange: (content: VideoBlockContent) => void;
}

export default function VideoBlockEditor({ lessonId, content, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadLmsVideo(file, lessonId);
      onChange({ ...content, url });
      toast({ title: `Vidéo importée (${formatFileSize(file.size)})` });
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
          <Label>URL de la vidéo</Label>
          <Input
            value={content.url || ""}
            onChange={(e) => onChange({ ...content, url: e.target.value || null })}
            placeholder="https://youtube.com/… ou téléversez un fichier"
          />
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full sm:w-auto">
            {uploading ? <Spinner className="mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            {uploading ? "Upload…" : "Téléverser"}
          </Button>
        </div>
      </div>
      {content.url && <VideoBlockViewer content={content} />}
    </div>
  );
}
