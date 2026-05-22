import { useRef, useState } from "react";
import { Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { uploadLmsImage } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import type { BeforeAfterBlockContent } from "@/types/lms-blocks";

interface Props {
  lessonId: string;
  content: BeforeAfterBlockContent;
  onChange: (content: BeforeAfterBlockContent) => void;
  slim?: boolean;
}

export default function BeforeAfterBlockEditor({ lessonId, content, onChange, slim }: Props) {
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);
  const beforeRef = useRef<HTMLInputElement>(null);
  const afterRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (side: "before" | "after", file: File) => {
    const key = side === "before" ? "before_image_url" : "after_image_url";
    side === "before" ? setUploadingBefore(true) : setUploadingAfter(true);
    try {
      const url = await uploadLmsImage(file, lessonId);
      onChange({ ...content, [key]: url });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      side === "before" ? setUploadingBefore(false) : setUploadingAfter(false);
    }
  };

  const UploadArea = ({
    side,
    label,
    url,
    uploading,
    fileRef,
  }: {
    side: "before" | "after";
    label: string;
    url?: string | null;
    uploading: boolean;
    fileRef: React.RefObject<HTMLInputElement>;
  }) => (
    <div className="space-y-2">
      <Label className="text-xs font-semibold">{label}</Label>
      <div
        className="h-24 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer overflow-hidden hover:border-gray-400 transition-colors"
        style={{ borderColor: side === "after" ? "#FFD100" : "#d1d5db", background: side === "after" ? "#FFFBEA" : "#f9fafb" }}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? <Spinner size="sm" /> : url ? (
          <img src={url} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-1 text-gray-400">
            <Upload className="h-5 w-5" />
            <span className="text-xs">Importer</span>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          ref={fileRef}
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(side, f); e.target.value = ""; }}
        />
      </div>
    </div>
  );

  if (slim) {
    return (
      <div
        style={{
          borderRadius: "var(--st-br, 20px)",
          border: "1px solid var(--st-ink-08)",
          padding: "1.25rem",
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <UploadArea side="before" label="Avant" url={content.before_image_url} uploading={uploadingBefore} fileRef={beforeRef} />
          <UploadArea side="after" label="Après" url={content.after_image_url} uploading={uploadingAfter} fileRef={afterRef} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <UploadArea side="before" label="Image Avant" url={content.before_image_url} uploading={uploadingBefore} fileRef={beforeRef} />
        <UploadArea side="after" label="Image Après" url={content.after_image_url} uploading={uploadingAfter} fileRef={afterRef} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label className="text-xs">Label Avant</Label>
          <Input
            value={content.before_label ?? ""}
            onChange={(e) => onChange({ ...content, before_label: e.target.value || null })}
            placeholder="ex: Avant"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Label Après</Label>
          <Input
            value={content.after_label ?? ""}
            onChange={(e) => onChange({ ...content, after_label: e.target.value || null })}
            placeholder="ex: Après"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Légende (optionnelle)</Label>
        <Input
          value={content.caption ?? ""}
          onChange={(e) => onChange({ ...content, caption: e.target.value || null })}
          placeholder="Légende sous l'image…"
        />
      </div>
    </div>
  );
}
