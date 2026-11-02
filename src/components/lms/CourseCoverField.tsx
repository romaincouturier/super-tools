import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { COURSE_COVER_ACCEPT, validateCourseCover } from "@/lib/lmsCourseCover";

type Props = {
  url: string | null;
  file: File | null;
  disabled: boolean;
  onChange: (url: string | null, file: File | null) => void;
};

export default function CourseCoverField({ url, file, disabled, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const selectFile = (selected: File) => {
    if (disabled) return;
    try {
      validateCourseCover(selected);
      setError("");
      onChange(url, selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image invalide.");
    }
  };
  const imageUrl = preview ?? url;

  return (
    <div className="space-y-2">
      <Label htmlFor="course-cover">Image de couverture</Label>
      <input
        ref={input}
        id="course-cover"
        type="file"
        accept={COURSE_COVER_ACCEPT}
        className="sr-only"
        disabled={disabled}
        aria-describedby="course-cover-help"
        onChange={(event) => {
          const selected = event.target.files?.[0];
          if (selected) selectFile(selected);
          event.target.value = "";
        }}
      />
      <div
        className={`relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-md border border-dashed ${dragOver ? "border-primary bg-accent" : "border-border bg-muted/30"}`}
        onDragOver={(event) => { event.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const selected = event.dataTransfer.files[0];
          if (selected) selectFile(selected);
        }}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="Aperçu de la couverture du cours" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <Button type="button" variant="outline" disabled={disabled} onClick={() => input.current?.click()}>
            <ImagePlus className="mr-2 h-4 w-4" /> Importer une image
          </Button>
        )}
      </div>
      <p id="course-cover-help" className="text-xs text-muted-foreground">
        PNG, JPG, WebP · 5 Mo maximum · Conseillé : 16:9, 1200 × 675 px
      </p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {imageUrl && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => input.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Remplacer
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={() => { setError(""); onChange(null, null); }}>
            <Trash2 className="mr-2 h-4 w-4" /> Supprimer
          </Button>
        </div>
      )}
    </div>
  );
}