import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Label } from "@/components/ui/label";
import { Upload, Paperclip, X, File as FileIcon } from "lucide-react";
import { uploadLmsFile } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { formatFileSize } from "@/lib/file-utils";
import RichTextEditor from "@/components/content/RichTextEditor";
import type { FileBlockContent, FileBlockItem } from "@/types/lms-blocks";

interface Props {
  lessonId: string;
  content: FileBlockContent;
  onChange: (content: FileBlockContent) => void;
  slim?: boolean;
}

function getFiles(content: FileBlockContent): FileBlockItem[] {
  if (content.files && content.files.length > 0) return content.files;
  if (content.url) return [{ url: content.url, name: content.name || "Fichier", size: content.size ?? null }];
  return [];
}

export default function FileBlockEditor({ lessonId, content, onChange, slim }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const { toast } = useToast();

  const files = getFiles(content);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await uploadLmsFile(file, lessonId);
      const next: FileBlockItem[] = [...files, { url: result.url, name: result.name, size: result.size }];
      onChange({
        ...content,
        url: null,
        name: null,
        size: null,
        files: next,
      });
      toast({ title: `Fichier ajouté (${formatFileSize(file.size)})` });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (index: number) => {
    const next = files.filter((_, i) => i !== index);
    onChange({ ...content, url: null, name: null, size: null, files: next });
  };

  if (slim) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {files.map((f, idx) => (
          <div
            key={`${f.url}-${idx}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.875rem",
              padding: "0.875rem 1rem",
              borderRadius: "var(--st-br, 12px)",
              background: "var(--st-surface)",
              border: "1px solid rgba(16,24,32,0.08)",
            }}
          >
            <div
              style={{
                width: 40, height: 40, borderRadius: 8,
                background: "rgba(16,24,32,0.08)",
                display: "grid", placeItems: "center", flexShrink: 0,
              }}
            >
              <Paperclip size={18} style={{ color: "var(--st-ink-60)" }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 600, color: "var(--st-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.name || "Fichier"}
              </p>
              {f.size != null && f.size > 0 && (
                <p style={{ margin: "0.125rem 0 0", fontSize: "0.75rem", color: "var(--st-ink-50)" }}>
                  {formatFileSize(f.size)}
                </p>
              )}
            </div>
            <button
              onClick={() => handleRemove(idx)}
              style={{
                width: 28, height: 28, borderRadius: "50%",
                border: "none", background: "rgba(16,24,32,0.08)",
                cursor: "pointer", display: "grid", placeItems: "center",
                flexShrink: 0,
              }}
              aria-label="Supprimer le fichier"
            >
              <X size={14} style={{ color: "var(--st-ink-60)" }} />
            </button>
          </div>
        ))}

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const f = e.dataTransfer.files[0];
            if (f) handleUpload(f);
          }}
          onClick={() => fileRef.current?.click()}
          style={{
            borderRadius: "var(--st-br, 12px)",
            border: `2px dashed ${dragOver ? "rgba(16,24,32,0.35)" : "rgba(16,24,32,0.18)"}`,
            padding: "1.25rem 2rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.5rem",
            cursor: uploading ? "default" : "pointer",
            background: dragOver ? "var(--st-ink-06)" : "transparent",
            transition: "all 120ms",
          }}
        >
          <input
            ref={fileRef}
            type="file"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <div
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--st-ink-06)",
              display: "grid", placeItems: "center",
            }}
          >
            {uploading ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <FileIcon size={16} style={{ color: "var(--st-ink-50)" }} />
            )}
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "0.875rem", fontWeight: 500, color: "var(--st-ink)" }}>
              {uploading
                ? "Upload en cours…"
                : files.length > 0
                  ? "Ajouter un autre fichier"
                  : "Déposer un fichier ou cliquer pour importer"}
            </p>
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "var(--st-ink-50)" }}>
              PDF, DOCX, ZIP, etc.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Form mode
  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
        <div className="flex-1">
          <Label>Fichiers à télécharger</Label>
          {files.length > 0 ? (
            <div className="space-y-2 mt-1">
              {files.map((f, idx) => (
                <div key={`${f.url}-${idx}`} className="flex items-center gap-2 p-3 bg-muted rounded-lg border">
                  <Paperclip className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium break-words">{f.name || "Fichier"}</p>
                    {f.size != null && f.size > 0 && (
                      <p className="text-xs text-muted-foreground">{formatFileSize(f.size)}</p>
                    )}
                  </div>
                  <Button variant="ghost" size="icon" className="shrink-0" onClick={() => handleRemove(idx)} title="Retirer">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">Aucun fichier importé</p>
          )}
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full sm:w-auto">
            {uploading ? <Spinner className="mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
            {uploading ? "Upload…" : files.length > 0 ? "Ajouter un fichier" : "Importer"}
          </Button>
        </div>
      </div>
      <div>
        <Label>Description / instructions (optionnel)</Label>
        <RichTextEditor
          content={content.description_html || ""}
          onChange={(description_html) => onChange({ ...content, description_html })}
        />
      </div>
    </div>
  );
}
