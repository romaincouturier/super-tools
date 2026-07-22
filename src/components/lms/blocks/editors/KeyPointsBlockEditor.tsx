import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Plus, X, Lightbulb, Image as ImageIcon, Upload } from "lucide-react";
import { uploadLmsImage } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { formatFileSize } from "@/lib/file-utils";
import { InlineEdit } from "./InlineEdit";
import type { KeyPointsBlockContent } from "@/types/lms-blocks";

interface Props {
  lessonId: string;
  content: KeyPointsBlockContent;
  onChange: (content: KeyPointsBlockContent) => void;
  slim?: boolean;
}

export default function KeyPointsBlockEditor({ lessonId, content, onChange, slim }: Props) {
  const items = content.items || [""];
  const listRef = useRef<(HTMLElement | null)[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadLmsImage(file, lessonId);
      onChange({ ...content, image_url: url });
      toast({ title: `Image importée (${formatFileSize(file.size)})` });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      setUploading(false);
    }
  };

  const setItem = (i: number, value: string) => {
    const next = [...items];
    next[i] = value;
    onChange({ ...content, items: next });
  };

  const addItem = (afterIndex?: number) => {
    const next = [...items];
    const idx = afterIndex !== undefined ? afterIndex + 1 : next.length;
    next.splice(idx, 0, "");
    onChange({ ...content, items: next });
    setTimeout(() => {
      const el = listRef.current[idx];
      if (el) el.focus();
    }, 10);
  };

  const removeItem = (i: number) =>
    onChange({ ...content, items: items.length > 1 ? items.filter((_, idx) => idx !== i) : items });

  if (slim) {
    return (
      <div
        style={{
          background: "var(--st-yellow-soft)",
          borderRadius: "var(--st-br, 20px)",
          padding: "1.25rem 1.5rem",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
          <Lightbulb size={20} style={{ color: "var(--st-ink)", flexShrink: 0 }} />
          <InlineEdit
            value={content.title || ""}
            onChange={(v) => onChange({ ...content, title: v || null })}
            placeholder="À retenir"
            style={{
              flex: 1,
              fontWeight: 700,
              fontSize: "0.9375rem",
              color: "var(--st-ink)",
              outline: "none",
            }}
          />
        </div>

        {/* Items */}
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {items.map((item, i) => (
            <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem" }}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--st-ink)",
                  flexShrink: 0,
                  marginTop: "0.45em",
                }}
              />
              <InlineEdit
                value={item}
                onChange={(v) => setItem(i, v)}
                placeholder="Un point clé à retenir…"
                onEnter={() => addItem(i)}
                onEmptyBackspace={() => {
                  if (items.length > 1) {
                    removeItem(i);
                    setTimeout(() => listRef.current[Math.max(0, i - 1)]?.focus(), 10);
                  }
                }}
                style={{ flex: 1, fontSize: "0.9375rem", color: "var(--st-ink)", outline: "none" }}
              />
              <button
                onClick={() => items.length > 1 && removeItem(i)}
                style={{
                  opacity: 0.4,
                  fontSize: 16,
                  lineHeight: 1,
                  padding: "1px 5px",
                  borderRadius: 4,
                  border: "none",
                  background: "transparent",
                  cursor: items.length > 1 ? "pointer" : "default",
                  flexShrink: 0,
                  color: "var(--st-ink)",
                }}
                aria-label="Supprimer ce point"
              >
                ×
              </button>
            </li>
          ))}
        </ul>

        {/* Add button */}
        <button
          onClick={() => addItem()}
          style={{
            marginTop: "0.875rem",
            display: "flex",
            alignItems: "center",
            gap: "0.375rem",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "var(--st-ink-60)",
            cursor: "pointer",
            border: "none",
            background: "transparent",
            padding: "0.25rem 0",
          }}
        >
          <Plus size={14} />
          Ajouter un point
        </button>

        {/* Image */}
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
        {content.image_url ? (
          <div style={{ position: "relative", marginTop: "1rem", borderRadius: "var(--st-br, 20px)", overflow: "hidden" }}>
            <img src={content.image_url} alt="" style={{ width: "100%", height: "auto", display: "block" }} />
            <button
              onClick={() => onChange({ ...content, image_url: null })}
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
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{
              marginTop: "0.875rem",
              display: "flex",
              alignItems: "center",
              gap: "0.375rem",
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: "var(--st-ink-60)",
              cursor: uploading ? "default" : "pointer",
              border: "none",
              background: "transparent",
              padding: "0.25rem 0",
            }}
          >
            {uploading ? <Spinner className="h-3.5 w-3.5" /> : <ImageIcon size={14} />}
            {uploading ? "Upload en cours…" : "Ajouter une image"}
          </button>
        )}
      </div>
    );
  }

  // Form mode (non-slim)
  return (
    <div className="space-y-3">
      <div>
        <Label>Titre</Label>
        <Input
          value={content.title || ""}
          onChange={(e) => onChange({ ...content, title: e.target.value || null })}
          placeholder="À retenir"
        />
      </div>
      <div className="space-y-2">
        <Label>Points clés</Label>
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={item}
              onChange={(e) => setItem(i, e.target.value)}
              placeholder={`Point ${i + 1}`}
              className="flex-1"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeItem(i)}
              disabled={items.length <= 1}
              aria-label="Supprimer ce point"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => addItem()}>
          <Plus className="h-4 w-4 mr-2" /> Ajouter un point
        </Button>
      </div>
      <div>
        <Label>Image (optionnel)</Label>
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
        {content.image_url ? (
          <div className="space-y-2">
            <div className="rounded-lg overflow-hidden bg-muted border max-w-md">
              <img src={content.image_url} alt="" className="w-full h-auto object-contain max-h-[400px]" />
            </div>
            <Button variant="outline" size="sm" onClick={() => onChange({ ...content, image_url: null })}>
              <X className="h-4 w-4 mr-2" /> Retirer l'image
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Spinner className="mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            {uploading ? "Upload…" : "Importer une image"}
          </Button>
        )}
      </div>
    </div>
  );
}
