import { useRef, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, X, Video, Image as ImageIcon, FileText } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import RichTextEditor from "@/components/content/RichTextEditor";
import { cryptoRandomId } from "@/types/lms-blocks";
import type { ExerciseBlockContent } from "@/types/lms-blocks";
import { uploadLmsImage, uploadLmsFile } from "@/hooks/useLms";
import { resolveContentType } from "@/lib/file-utils";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import WorkDepositBlockEditor from "./WorkDepositBlockEditor";

interface Props {
  lessonId: string;
  content: ExerciseBlockContent;
  onChange: (content: ExerciseBlockContent) => void;
  slim?: boolean;
}

function VideoPreview({ url }: { url: string }) {
  const isYouTube = url.includes("youtube") || url.includes("youtu.be");
  const isVimeo = url.includes("vimeo");
  return (
    <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
      {isYouTube ? (
        <iframe
          src={url.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : isVimeo ? (
        <iframe
          src={url.replace("vimeo.com/", "player.vimeo.com/video/")}
          className="w-full h-full"
          allow="autoplay; fullscreen"
          allowFullScreen
        />
      ) : (
        <video src={url} controls className="w-full h-full" />
      )}
    </div>
  );
}

function PdfUploader({
  lessonId,
  pdfUrl,
  onUpload,
  onRemove,
}: {
  lessonId: string;
  pdfUrl: string | null | undefined;
  onUpload: (url: string) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    if (resolveContentType(file) !== "application/pdf") {
      toastError(toast, "Seuls les fichiers PDF sont acceptés.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toastError(toast, "Le fichier ne doit pas dépasser 20 Mo.");
      return;
    }
    setUploading(true);
    try {
      const result = await uploadLmsFile(file, lessonId);
      onUpload(result.url);
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      setUploading(false);
    }
  };

  if (pdfUrl) {
    return (
      <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5 bg-muted/40">
        <FileText size={16} className="shrink-0 text-muted-foreground" />
        <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="flex-1 text-sm truncate underline">
          Voir le PDF de consigne
        </a>
        <button onClick={onRemove} aria-label="Supprimer le PDF" className="shrink-0">
          <X size={14} className="text-muted-foreground hover:text-destructive" />
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed text-sm transition-all hover:bg-black/5"
        style={{ borderColor: "rgba(16,24,32,0.18)", color: "var(--st-ink-muted)" }}
      >
        {uploading ? <Spinner className="h-4 w-4" /> : <FileText size={16} />}
        {uploading ? "Upload en cours…" : "Ajouter un PDF de consigne"}
      </button>
    </>
  );
}

function ImageUploader({
  lessonId,
  imageUrl,
  onUpload,
  onRemove,
}: {
  lessonId: string;
  imageUrl: string | null | undefined;
  onUpload: (url: string) => void;
  onRemove: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadLmsImage(file, lessonId);
      onUpload(url);
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      setUploading(false);
    }
  };

  if (imageUrl) {
    return (
      <div className="relative rounded-lg overflow-hidden border bg-muted">
        <img src={imageUrl} alt="Image de consigne" className="w-full h-auto max-h-80 object-contain" />
        <button
          onClick={onRemove}
          aria-label="Supprimer l'image"
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: "rgba(16,24,32,0.6)", color: "#fff" }}
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border-2 border-dashed text-sm transition-all hover:bg-black/5"
        style={{ borderColor: "rgba(16,24,32,0.18)", color: "var(--st-ink-muted)" }}
      >
        {uploading ? <Spinner className="h-4 w-4" /> : <ImageIcon size={16} />}
        {uploading ? "Upload en cours…" : "Ajouter une image de consigne"}
      </button>
    </>
  );
}

export default function ExerciseBlockEditor({ lessonId, content, onChange, slim }: Props) {
  const checklistItems = content.checklist_items || [];
  const hasChecklist = checklistItems.length > 0 || content.checklist_title;
  const depositEnabled = content.work_deposit_enabled === true;
  const depositConfig = content.work_deposit ?? {};

  const setChecklistLabel = (id: string, label: string) =>
    onChange({
      ...content,
      checklist_items: checklistItems.map((it) => (it.id === id ? { ...it, label } : it)),
    });

  const addChecklistItem = () =>
    onChange({
      ...content,
      checklist_items: [...checklistItems, { id: cryptoRandomId(), label: "" }],
    });

  const removeChecklistItem = (id: string) => {
    const updated = checklistItems.filter((it) => it.id !== id);
    onChange({
      ...content,
      checklist_items: updated.length > 0 ? updated : null,
      checklist_title: updated.length > 0 ? content.checklist_title : null,
    });
  };

  const enableChecklist = () =>
    onChange({
      ...content,
      checklist_items: [{ id: cryptoRandomId(), label: "" }],
      checklist_title: null,
    });

  if (slim) {
    return (
      <div className="space-y-3">
        {content.video_url && <VideoPreview url={content.video_url} />}
        {content.image_url ? (
          <div className="relative rounded-lg overflow-hidden border bg-muted">
            <img src={content.image_url} alt="Image de consigne" className="w-full h-auto max-h-64 object-contain" />
            <button
              onClick={() => onChange({ ...content, image_url: null })}
              aria-label="Supprimer l'image"
              className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: "rgba(16,24,32,0.6)", color: "#fff" }}
            >
              <X size={13} />
            </button>
          </div>
        ) : null}
        <PdfUploader
          lessonId={lessonId}
          pdfUrl={content.pdf_url}
          onUpload={(url) => onChange({ ...content, pdf_url: url })}
          onRemove={() => onChange({ ...content, pdf_url: null })}
        />
        <RichTextEditor
          content={content.prompt_html || ""}
          onChange={(prompt_html) => onChange({ ...content, prompt_html })}
          placeholder="Énoncé de l'exercice…"
        />
        {hasChecklist && (
          <div className="space-y-1 pl-2">
            {checklistItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <span style={{ color: "var(--st-ink-50)" }}>☐</span>
                <Input
                  value={item.label}
                  onChange={(e) => setChecklistLabel(item.id, e.target.value)}
                  placeholder="Étape ou critère"
                  className="flex-1 text-sm h-7 border-none bg-transparent px-0 focus-visible:ring-0"
                />
              </div>
            ))}
            <button
              className="text-xs mt-1"
              style={{ color: "var(--st-ink-50)" }}
              onClick={addChecklistItem}
            >
              + Ajouter un critère
            </button>
          </div>
        )}
        {!hasChecklist && (
          <button
            className="text-xs"
            style={{ color: "var(--st-ink-50)" }}
            onClick={enableChecklist}
          >
            + Ajouter une liste de critères
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Custom title */}
      <div>
        <Label>Titre du bloc (optionnel)</Label>
        <Input
          value={content.title || ""}
          onChange={(e) => onChange({ ...content, title: e.target.value || null })}
          placeholder="Exercice"
        />
      </div>

      {/* Video de consigne */}
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm">Vidéo de consigne (optionnel)</Label>
        </div>
        <Input
          value={content.video_url || ""}
          onChange={(e) => onChange({ ...content, video_url: e.target.value || null })}
          placeholder="URL YouTube, Vimeo ou lien direct…"
          type="url"
        />
        {content.video_url && <VideoPreview url={content.video_url} />}
      </div>

      {/* Image de consigne */}
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm">Image de consigne (optionnel)</Label>
        </div>
        <ImageUploader
          lessonId={lessonId}
          imageUrl={content.image_url}
          onUpload={(url) => onChange({ ...content, image_url: url })}
          onRemove={() => onChange({ ...content, image_url: null })}
        />
      </div>

      {/* PDF de consigne */}
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <Label className="text-sm">PDF de consigne (optionnel)</Label>
        </div>
        <PdfUploader
          lessonId={lessonId}
          pdfUrl={content.pdf_url}
          onUpload={(url) => onChange({ ...content, pdf_url: url })}
          onRemove={() => onChange({ ...content, pdf_url: null })}
        />
      </div>

      <div>
        <Label>Énoncé de l'exercice</Label>
        <RichTextEditor
          content={content.prompt_html || ""}
          onChange={(prompt_html) => onChange({ ...content, prompt_html })}
          placeholder="Décrivez ce que l'apprenant doit faire…"
        />
      </div>

      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Liste à cocher dans la consigne</Label>
          {!hasChecklist && (
            <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={enableChecklist}>
              <Plus className="h-3.5 w-3.5 mr-1" />Ajouter
            </Button>
          )}
        </div>
        {hasChecklist && (
          <div className="space-y-2">
            <Input
              value={content.checklist_title || ""}
              onChange={(e) => onChange({ ...content, checklist_title: e.target.value || null })}
              placeholder="Titre de la liste (optionnel)"
              className="text-sm"
            />
            {checklistItems.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <span className="text-muted-foreground shrink-0">☐</span>
                <Input
                  value={item.label}
                  onChange={(e) => setChecklistLabel(item.id, e.target.value)}
                  placeholder="Étape ou critère"
                  className="flex-1 text-sm"
                />
                <Button
                  variant="ghost" size="icon" className="h-8 w-8 shrink-0"
                  onClick={() => removeChecklistItem(item.id)} aria-label="Supprimer"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addChecklistItem}>
              <Plus className="h-3.5 w-3.5 mr-1" />Ajouter un élément
            </Button>
          </div>
        )}
      </div>

      <div>
        <Label>Corrigé (optionnel)</Label>
        <RichTextEditor
          content={content.answer_html || ""}
          onChange={(answer_html) => onChange({ ...content, answer_html })}
          placeholder="Le corrigé est masqué par défaut, l'apprenant le révèle d'un clic."
        />
      </div>

      {/* Work deposit toggle (ST-2026-0138) */}
      <div className="rounded-lg border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Demander un dépôt de travail</Label>
            <p className="text-xs text-muted-foreground mt-0.5">L'apprenant pourra remettre un fichier en réponse à cet exercice.</p>
          </div>
          <Switch
            checked={depositEnabled}
            onCheckedChange={(v) => onChange({ ...content, work_deposit_enabled: v, work_deposit: v ? (content.work_deposit ?? {}) : null })}
          />
        </div>
        {depositEnabled && (
          <WorkDepositBlockEditor
            content={depositConfig}
            onChange={(wd) => onChange({ ...content, work_deposit: wd })}
          />
        )}
      </div>
    </div>
  );
}
