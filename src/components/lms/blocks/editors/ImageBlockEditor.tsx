import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Upload, Image as ImageIcon, X } from "lucide-react";
import { uploadLmsImage } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { formatFileSize } from "@/lib/file-utils";
import RichTextEditor from "@/components/content/RichTextEditor";
import { InlineEdit } from "./InlineEdit";
import type { ImageBlockContent } from "@/types/lms-blocks";

interface Props {
  lessonId: string;
  content: ImageBlockContent;
  onChange: (content: ImageBlockContent) => void;
  slim?: boolean;
}

export default function ImageBlockEditor({ lessonId, content, onChange, slim }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
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

  if (slim) {
    if (!content.url) {
      return (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f?.type.startsWith("image/")) handleUpload(f);
          }}
          onClick={() => fileRef.current?.click()}
          style={{
            borderRadius: "var(--st-br, 20px)",
            border: `2px dashed ${dragOver ? "rgba(16,24,32,0.35)" : "rgba(16,24,32,0.18)"}`,
            padding: "2.5rem 2rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
            cursor: uploading ? "default" : "pointer",
            background: dragOver ? "var(--st-ink-06)" : "transparent",
            transition: "all 120ms",
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "var(--st-ink-06)",
              display: "grid",
              placeItems: "center",
            }}
          >
            {uploading ? (
              <Spinner className="h-5 w-5" />
            ) : (
              <ImageIcon size={20} style={{ color: "var(--st-ink-50)" }} />
            )}
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500, color: "var(--st-ink)" }}>
              {uploading ? "Upload en cours…" : "Déposer une image ou cliquer pour importer"}
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--st-ink-50)" }}>
              PNG, JPG, GIF, WebP
            </p>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div style={{ position: "relative", borderRadius: "var(--st-br, 20px)", overflow: "hidden" }}>
          <img
            src={content.url}
            alt=""
            style={{ width: "100%", height: "auto", display: "block" }}
          />
          <button
            onClick={() => onChange({ ...content, url: null })}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(16,24,32,0.6)",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              display: "grid",
              placeItems: "center",
            }}
            aria-label="Supprimer l'image"
          >
            <X size={14} />
          </button>
        </div>
        <InlineEdit
          value={content.caption_html || ""}
          onChange={(v) => onChange({ ...content, caption_html: v || null })}
          placeholder="Ajouter une légende (facultatif)…"
          style={{
            marginTop: "0.5rem",
            fontSize: "0.875rem",
            color: "var(--st-ink-60)",
            textAlign: "center",
            outline: "none",
            display: "block",
          }}
        />
      </div>
    );
  }

  // Form mode
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
