import { useRef, useState } from "react";
import { Upload, X, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { uploadLmsImage } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { reportHandledError } from "@/lib/sentry";
import { formatFileSize, resolveContentType } from "@/lib/file-utils";
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
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);
  const bulkFileRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef(content);
  const imagesRef = useRef(images);
  const busyRef = useRef(false);
  contentRef.current = content;
  imagesRef.current = images;
  const busy = progress !== null || uploadingIdx !== null;

  const updateImages = (next: GalleryImage[]) => {
    imagesRef.current = next;
    contentRef.current = { ...contentRef.current, images: next };
    onChange(contentRef.current);
  };

  const handleBulkUpload = async (selected: File[]) => {
    if (busyRef.current) return;
    const files = selected.filter((file) => resolveContentType(file).startsWith("image/"))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    if (files.length === 0) return;
    busyRef.current = true;
    setProgress({ done: 0, total: files.length });
    const results: Array<{ url: string } | null | undefined> = new Array(files.length);
    let cursor = 0;
    let nextAppend = 0;
    let done = 0;
    let failed = 0;

    const worker = async () => {
      while (cursor < files.length) {
        const index = cursor++;
        try {
          results[index] = { url: await uploadLmsImage(files[index], lessonId) };
        } catch (err) {
          results[index] = null;
          failed++;
          reportHandledError(err);
        }
        const appended: GalleryImage[] = [];
        while (nextAppend < files.length && results[nextAppend] !== undefined) {
          const result = results[nextAppend++];
          if (result) appended.push(result);
        }
        if (appended.length > 0) updateImages([...imagesRef.current, ...appended]);
        setProgress({ done: ++done, total: files.length });
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(3, files.length) }, worker));
      const imported = files.length - failed;
      const title = `${imported} image${imported > 1 ? "s" : ""} importée${imported > 1 ? "s" : ""}`;
      if (failed > 0) {
        toastError(toast, `${failed} image${failed > 1 ? "s" : ""} en échec.`, { title });
      } else {
        toast({ title });
      }
    } finally {
      busyRef.current = false;
      setProgress(null);
    }
  };

  const handleUpload = async (file: File, idx: number) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setUploadingIdx(idx);
    try {
      const url = await uploadLmsImage(file, lessonId);
      const next = [...imagesRef.current];
      next[idx] = { ...next[idx], url };
      updateImages(next);
      toast({ title: `Image importée (${formatFileSize(file.size)})` });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      busyRef.current = false;
      setUploadingIdx(null);
    }
  };

  const handleAddSlot = () => {
    if (!busyRef.current) updateImages([...imagesRef.current, { url: null }]);
  };

  const handleRemove = (idx: number) => {
    if (!busyRef.current) updateImages(imagesRef.current.filter((_, i) => i !== idx));
  };

  const colClass =
    columns === 2 ? "grid-cols-2" : columns === 3 ? "grid-cols-3" : "grid-cols-4";

  return (
    <div
      className={cn("space-y-4", dragOver && "outline outline-2 outline-primary")}
      onDragOver={(e) => {
        if (!Array.from(e.dataTransfer.types).includes("Files")) return;
        e.preventDefault();
        e.stopPropagation();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        void handleBulkUpload(Array.from(e.dataTransfer.files));
      }}
    >
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
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => bulkFileRef.current?.click()} className="whitespace-normal text-left">
          <Upload />
          Importer plusieurs images
        </Button>
        <input
          ref={bulkFileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          disabled={busy}
          onChange={(e) => {
            const files = Array.from(e.currentTarget.files ?? []);
            e.currentTarget.value = "";
            void handleBulkUpload(files);
          }}
        />
      </div>

      {progress && (
        <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner className="h-4 w-4" />
          Import {progress.done}/{progress.total}…
        </p>
      )}

      {/* Image grid */}
      <div className={cn("grid gap-3", colClass)}>
        {images.map((img, idx) => (
          <ImageSlot
            key={idx}
            img={img}
            uploading={uploadingIdx === idx}
            disabled={busy}
            fileRef={(el) => { fileRefs.current[idx] = el; }}
            onFileClick={() => fileRefs.current[idx]?.click()}
            onFilePick={(file) => handleUpload(file, idx)}
            onFilesDrop={(files) => {
              setDragOver(false);
              void handleBulkUpload(files);
            }}
            onRemove={() => handleRemove(idx)}
          />
        ))}

        {/* Add slot */}
        <button
          type="button"
          disabled={busy}
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

    </div>
  );
}

function ImageSlot({
  img,
  uploading,
  disabled,
  fileRef,
  onFileClick,
  onFilePick,
  onFilesDrop,
  onRemove,
}: {
  img: GalleryImage;
  uploading: boolean;
  disabled: boolean;
  fileRef: (el: HTMLInputElement | null) => void;
  onFileClick: () => void;
  onFilePick: (file: File) => void;
  onFilesDrop: (files: File[]) => void;
  onRemove: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  if (img.url) {
    return (
      <div className="relative aspect-square rounded-xl overflow-hidden bg-gray-100">
        <img src={img.url} alt="" className="w-full h-full object-cover" />
        <button
          type="button"
          disabled={disabled}
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
      onClick={() => { if (!disabled) onFileClick(); }}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        onFilesDrop(Array.from(e.dataTransfer.files));
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        disabled={disabled}
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
