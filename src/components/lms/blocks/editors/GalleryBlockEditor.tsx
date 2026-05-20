import { useRef, useState } from "react";
import { Upload, X, Images, ChevronLeft, ChevronRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { uploadLmsImage } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { formatFileSize } from "@/lib/file-utils";
import { cn } from "@/lib/utils";
import type { GalleryBlockContent, GalleryImage, GalleryMode } from "@/types/lms-blocks";

interface Props {
  lessonId: string;
  content: GalleryBlockContent;
  onChange: (content: GalleryBlockContent) => void;
  slim?: boolean;
}

const COLUMNS_OPTIONS: Array<2 | 3 | 4> = [2, 3, 4];
const MODE_OPTIONS: { value: GalleryMode; label: string }[] = [
  { value: "grid", label: "Grille" },
  { value: "carousel", label: "Carrousel" },
];

export default function GalleryBlockEditor({ lessonId, content, onChange, slim }: Props) {
  const images = content.images ?? [];
  const mode = content.mode ?? "grid";
  const columns = content.columns ?? 3;
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const { toast } = useToast();
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const updateImages = (next: GalleryImage[]) => onChange({ ...content, images: next });

  const handleUpload = async (file: File, idx: number) => {
    setUploadingIdx(idx);
    try {
      const url = await uploadLmsImage(file, lessonId);
      const next = [...images];
      next[idx] = { ...next[idx], url };
      updateImages(next);
      toast({ title: `Image importée (${formatFileSize(file.size)})` });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      setUploadingIdx(null);
    }
  };

  const handleAddSlot = () => updateImages([...images, { url: null }]);

  const handleRemove = (idx: number) => {
    updateImages(images.filter((_, i) => i !== idx));
  };

  const colClass =
    columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-3" : "grid-cols-4";

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium" style={{ color: "var(--st-ink-50)" }}>Affichage</span>
          <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "rgba(16,24,32,0.14)" }}>
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChange({ ...content, mode: opt.value })}
                className={cn(
                  "px-3 py-1 text-xs font-medium transition-colors",
                  mode === opt.value
                    ? "bg-[var(--st-ink)] text-white"
                    : "bg-transparent hover:bg-[rgba(16,24,32,0.05)]",
                )}
                style={{ color: mode === opt.value ? "#fff" : "var(--st-ink)" }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {mode === "grid" && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: "var(--st-ink-50)" }}>Colonnes</span>
            <div className="flex rounded-lg overflow-hidden border" style={{ borderColor: "rgba(16,24,32,0.14)" }}>
              {COLUMNS_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChange({ ...content, columns: n })}
                  className={cn(
                    "w-8 py-1 text-xs font-medium transition-colors",
                    columns === n
                      ? "bg-[var(--st-ink)] text-white"
                      : "bg-transparent hover:bg-[rgba(16,24,32,0.05)]",
                  )}
                  style={{ color: columns === n ? "#fff" : "var(--st-ink)" }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Image grid */}
      <div className={cn("grid gap-3", colClass)}>
        {images.map((img, idx) => (
          <ImageSlot
            key={idx}
            img={img}
            uploading={uploadingIdx === idx}
            fileRef={(el) => { fileRefs.current[idx] = el; }}
            onFileClick={() => fileRefs.current[idx]?.click()}
            onFilePick={(file) => handleUpload(file, idx)}
            onRemove={() => handleRemove(idx)}
          />
        ))}

        {/* Add slot */}
        <button
          type="button"
          onClick={handleAddSlot}
          className="aspect-square flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors"
          style={{
            borderColor: "rgba(16,24,32,0.18)",
            color: "var(--st-ink-50)",
            background: "transparent",
            minHeight: 80,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "var(--st-yellow)";
            (e.currentTarget as HTMLElement).style.color = "var(--st-ink)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "rgba(16,24,32,0.18)";
            (e.currentTarget as HTMLElement).style.color = "var(--st-ink-50)";
          }}
        >
          <Images size={20} />
          <span className="text-xs font-medium">Ajouter</span>
        </button>
      </div>

      {images.length === 0 && (
        <p className="text-xs text-center" style={{ color: "var(--st-ink-50)" }}>
          Cliquez sur « Ajouter » pour insérer votre première image.
        </p>
      )}
    </div>
  );
}

function ImageSlot({
  img,
  uploading,
  fileRef,
  onFileClick,
  onFilePick,
  onRemove,
}: {
  img: GalleryImage;
  uploading: boolean;
  fileRef: (el: HTMLInputElement | null) => void;
  onFileClick: () => void;
  onFilePick: (file: File) => void;
  onRemove: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  if (img.url) {
    return (
      <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
        <img src={img.url} alt="" className="w-full h-full object-cover" />
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-1.5 right-1.5 w-6 h-6 flex items-center justify-center rounded-full"
          style={{ background: "rgba(16,24,32,0.6)", color: "#fff" }}
          aria-label="Supprimer l'image"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors"
      style={{
        borderColor: dragOver ? "rgba(16,24,32,0.35)" : "rgba(16,24,32,0.18)",
        background: dragOver ? "rgba(16,24,32,0.04)" : "transparent",
        minHeight: 80,
      }}
      onClick={onFileClick}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files[0];
        if (f?.type.startsWith("image/")) onFilePick(f);
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFilePick(f);
          e.target.value = "";
        }}
      />
      {uploading ? (
        <Spinner className="h-5 w-5" />
      ) : (
        <Upload size={16} style={{ color: "var(--st-ink-50)" }} />
      )}
      <span className="text-xs" style={{ color: "var(--st-ink-50)" }}>
        {uploading ? "Upload…" : "Image"}
      </span>
    </div>
  );
}
