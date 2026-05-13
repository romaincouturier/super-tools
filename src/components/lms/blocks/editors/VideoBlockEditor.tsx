import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Upload, Sparkles, Video as VideoIcon, X, Link as LinkIcon } from "lucide-react";
import { uploadLmsVideo } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { formatFileSize } from "@/lib/file-utils";
import VideoBlockViewer from "@/components/lms/blocks/viewers/VideoBlockViewer";
import { InlineEdit } from "./InlineEdit";
import type { VideoBlockContent } from "@/types/lms-blocks";

const SUPERTILT_PRESET: Partial<VideoBlockContent> = {
  display_style: "styled",
  bg_color: "#FFD100",
  container_radius: 20,
  video_radius: 20,
  padding: 24,
};

interface Props {
  lessonId: string;
  content: VideoBlockContent;
  onChange: (content: VideoBlockContent) => void;
  slim?: boolean;
}

export default function VideoBlockEditor({ lessonId, content, onChange, slim }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const { toast } = useToast();

  const isStyled = content.display_style === "styled";

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

  const applySupertiltPreset = () => {
    onChange({ ...content, ...SUPERTILT_PRESET });
  };

  if (slim) {
    if (content.url) {
      return (
        <div>
          <div style={{ position: "relative" }}>
            <VideoBlockViewer content={content} />
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
              aria-label="Supprimer la vidéo"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      );
    }

    if (urlMode) {
      return (
        <div
          style={{
            borderRadius: "var(--st-br, 20px)",
            border: "2px dashed rgba(16,24,32,0.18)",
            padding: "1.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <Input
            autoFocus
            value={content.url || ""}
            onChange={(e) => onChange({ ...content, url: e.target.value || null })}
            placeholder="https://youtube.com/… ou URL directe d'une vidéo"
          />
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <Button size="sm" onClick={() => setUrlMode(false)} disabled={!content.url}>
              Valider
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setUrlMode(false)}>
              Annuler
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files[0];
          if (f?.type.startsWith("video/")) handleUpload(f);
        }}
        style={{
          borderRadius: "var(--st-br, 20px)",
          border: `2px dashed ${dragOver ? "rgba(16,24,32,0.35)" : "rgba(16,24,32,0.18)"}`,
          padding: "2.5rem 2rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
          background: dragOver ? "var(--st-ink-06)" : "transparent",
          transition: "all 120ms",
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
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
            <VideoIcon size={20} style={{ color: "var(--st-ink-50)" }} />
          )}
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500, color: "var(--st-ink)" }}>
            {uploading ? "Upload en cours…" : "Déposer une vidéo ou importer"}
          </p>
          <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--st-ink-50)" }}>
            MP4, WebM, MOV
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.625rem" }}>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.5rem 1rem",
              borderRadius: 999,
              border: "1px solid rgba(16,24,32,0.15)",
              background: "#fff",
              cursor: "pointer",
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "var(--st-ink)",
            }}
          >
            <Upload size={14} />
            Importer
          </button>
          <button
            onClick={() => setUrlMode(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.375rem",
              padding: "0.5rem 1rem",
              borderRadius: 999,
              border: "1px solid rgba(16,24,32,0.15)",
              background: "#fff",
              cursor: "pointer",
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "var(--st-ink)",
            }}
          >
            <LinkIcon size={14} />
            Coller une URL
          </button>
        </div>
      </div>
    );
  }

  // Form mode
  return (
    <div className="space-y-4">
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

      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Style d'affichage</Label>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1.5"
            onClick={applySupertiltPreset}
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Style SuperTilt
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="video-styled"
            checked={isStyled}
            onCheckedChange={(v) => onChange({ ...content, display_style: v ? "styled" : "simple" })}
          />
          <Label htmlFor="video-styled" className="cursor-pointer text-sm">
            Afficher dans un conteneur stylisé
          </Label>
        </div>

        {isStyled && (
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Couleur de fond</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={content.bg_color || "#FFD100"}
                    onChange={(e) => onChange({ ...content, bg_color: e.target.value })}
                    className="h-8 w-10 cursor-pointer rounded border p-0.5"
                  />
                  <Input
                    value={content.bg_color || ""}
                    onChange={(e) => onChange({ ...content, bg_color: e.target.value || null })}
                    placeholder="#FFD100"
                    className="flex-1 font-mono text-xs"
                  />
                </div>
              </div>
              <div>
                <Label className="text-xs">Padding interne (px)</Label>
                <Input
                  type="number"
                  min={0}
                  max={64}
                  className="mt-1"
                  value={content.padding ?? 24}
                  onChange={(e) => onChange({ ...content, padding: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Arrondi du conteneur (px)</Label>
                <Input
                  type="number"
                  min={0}
                  max={40}
                  className="mt-1"
                  value={content.container_radius ?? 20}
                  onChange={(e) => onChange({ ...content, container_radius: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                />
              </div>
              <div>
                <Label className="text-xs">Arrondi de la vidéo (px)</Label>
                <Input
                  type="number"
                  min={0}
                  max={40}
                  className="mt-1"
                  value={content.video_radius ?? 20}
                  onChange={(e) => onChange({ ...content, video_radius: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {content.url && <VideoBlockViewer content={content} />}
    </div>
  );
}
