import { useRef, useState } from "react";
import { Upload, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { uploadLmsImage } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { cryptoRandomId } from "@/types/lms-blocks";
import type { ImageHotspotBlockContent, HotspotItem } from "@/types/lms-blocks";

interface Props {
  lessonId: string;
  content: ImageHotspotBlockContent;
  onChange: (content: ImageHotspotBlockContent) => void;
  slim?: boolean;
}

export default function ImageHotspotBlockEditor({ lessonId, content, onChange, slim }: Props) {
  const [uploading, setUploading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const hotspots = content.hotspots ?? [];

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadLmsImage(file, lessonId);
      onChange({ ...content, image_url: url });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!content.image_url) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x_pct = ((e.clientX - rect.left) / rect.width) * 100;
    const y_pct = ((e.clientY - rect.top) / rect.height) * 100;
    const newHotspot: HotspotItem = {
      id: cryptoRandomId(),
      x_pct: Math.round(x_pct * 10) / 10,
      y_pct: Math.round(y_pct * 10) / 10,
      label: `Point ${hotspots.length + 1}`,
      description_html: "",
    };
    const next = [...hotspots, newHotspot];
    onChange({ ...content, hotspots: next });
    setSelectedIdx(next.length - 1);
  };

  const updateHotspot = (i: number, patch: Partial<HotspotItem>) => {
    onChange({
      ...content,
      hotspots: hotspots.map((h, idx) => (idx === i ? { ...h, ...patch } : h)),
    });
  };

  const removeHotspot = (i: number) => {
    onChange({ ...content, hotspots: hotspots.filter((_, idx) => idx !== i) });
    setSelectedIdx(null);
  };

  return (
    <div className="space-y-4">
      {/* Image upload */}
      <div
        className="relative rounded-xl overflow-hidden border-2 border-dashed cursor-pointer"
        style={{
          minHeight: 120,
          borderColor: content.image_url ? "transparent" : "#d1d5db",
          background: content.image_url ? "transparent" : "#f9fafb",
        }}
        onClick={content.image_url ? undefined : () => fileRef.current?.click()}
      >
        {uploading ? (
          <div className="flex items-center justify-center h-32">
            <Spinner size="sm" />
          </div>
        ) : content.image_url ? (
          <div className="relative" onClick={handleImageClick} style={{ cursor: "crosshair" }}>
            <img src={content.image_url} alt="" className="w-full block" draggable={false} />
            {hotspots.map((spot, i) => (
              <div
                key={spot.id}
                style={{
                  position: "absolute",
                  left: `${spot.x_pct}%`,
                  top: `${spot.y_pct}%`,
                  transform: "translate(-50%, -50%)",
                  zIndex: 2,
                }}
                onClick={(e) => { e.stopPropagation(); setSelectedIdx(selectedIdx === i ? null : i); }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: selectedIdx === i ? "#FFD100" : "#101820",
                    color: selectedIdx === i ? "#101820" : "#fff",
                    border: "2px solid white",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.6875rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {i + 1}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
              style={{
                position: "absolute", top: 8, right: 8,
                background: "rgba(0,0,0,0.5)", color: "#fff",
                border: "none", borderRadius: 6, padding: "4px 8px",
                fontSize: "0.6875rem", cursor: "pointer",
              }}
            >
              Changer
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-gray-400">
            <Upload className="h-8 w-8" />
            <span className="text-sm">Importer une image</span>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          ref={fileRef}
          style={{ display: "none" }}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
        />
      </div>

      {content.image_url && (
        <p className="text-xs text-muted-foreground">
          Cliquez sur l'image pour ajouter un point d'annotation.
        </p>
      )}

      {/* Hotspot list */}
      {hotspots.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Points d'annotation ({hotspots.length})</Label>
          {hotspots.map((spot, i) => (
            <div
              key={spot.id}
              className="rounded-lg border p-3 space-y-2"
              style={{ borderColor: selectedIdx === i ? "#FFD100" : "#e5e7eb", background: selectedIdx === i ? "#FFFBEA" : "#fff" }}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="flex items-center gap-2 text-left"
                  onClick={() => setSelectedIdx(selectedIdx === i ? null : i)}
                >
                  <span
                    style={{
                      width: 20, height: 20, borderRadius: "50%",
                      background: "#101820", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "0.6875rem", fontWeight: 700, flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium">{spot.label || `Point ${i + 1}`}</span>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  onClick={() => removeHotspot(i)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              {selectedIdx === i && (
                <div className="space-y-2 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs">Label</Label>
                    <Input
                      value={spot.label}
                      onChange={(e) => updateHotspot(i, { label: e.target.value })}
                      placeholder="Nom du point…"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description (HTML)</Label>
                    <textarea
                      value={spot.description_html ?? ""}
                      onChange={(e) => updateHotspot(i, { description_html: e.target.value })}
                      placeholder="Description du point…"
                      rows={3}
                      className="w-full rounded-md border border-input px-3 py-2 text-sm font-mono resize-y"
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!slim && !content.image_url && hotspots.length === 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileRef.current?.click()}
        >
          <Plus className="h-4 w-4 mr-1" /> Importer une image
        </Button>
      )}
    </div>
  );
}
