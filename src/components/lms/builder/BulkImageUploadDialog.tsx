import { useState, useRef, useCallback } from "react";
import { ImageIcon, Upload, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useCourseModules, useModuleLessons } from "@/hooks/useLms";
import { useCreateLessonBlock } from "@/hooks/useLmsBlocks";
import { uploadMediaFile, useAddMedia } from "@/hooks/useMedia";
import { resolveContentType } from "@/lib/file-utils";
import type { LmsModule, LmsLesson } from "@/hooks/useLms";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";

interface UploadedImage {
  file: File;
  url: string;
  mediaId: string;
  preview: string;
  lessonId: string | null;
}

// ── Lesson picker (grouped by module) ─────────────────────────────────────

function LessonPicker({
  courseId,
  value,
  onChange,
}: {
  courseId: string;
  value: string | null;
  onChange: (lessonId: string) => void;
}) {
  const { data: modules = [] } = useCourseModules(courseId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between text-xs h-8">
          <LessonLabel courseId={courseId} lessonId={value} />
          <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-50 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 max-h-72 overflow-y-auto">
        {modules.map((mod) => (
          <ModuleGroup key={mod.id} module={mod} onSelect={onChange} />
        ))}
        {modules.length === 0 && (
          <DropdownMenuItem disabled>Aucune leçon</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ModuleGroup({ module, onSelect }: { module: LmsModule; onSelect: (id: string) => void }) {
  const { data: lessons = [] } = useModuleLessons(module.id);
  if (!lessons.length) return null;
  return (
    <>
      <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground px-2 py-1">
        {module.title}
      </DropdownMenuLabel>
      <DropdownMenuGroup>
        {lessons.map((l) => (
          <DropdownMenuItem key={l.id} onSelect={() => onSelect(l.id)} className="text-sm pl-4">
            {l.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </>
  );
}

function LessonLabel({ courseId, lessonId }: { courseId: string; lessonId: string | null }) {
  const { data: modules = [] } = useCourseModules(courseId);
  const allLessons = useFlatLessons(modules);
  if (!lessonId) return <span className="text-muted-foreground">Choisir une leçon…</span>;
  const lesson = allLessons.find((l) => l.id === lessonId);
  return <span className="truncate">{lesson?.title ?? "Leçon inconnue"}</span>;
}

function useFlatLessons(modules: LmsModule[]): LmsLesson[] {
  // This is a best-effort client-side cache read — lessons are already fetched by ModuleGroup
  // We collect them from the query cache via a simple concatenation.
  // Not ideal but avoids a redundant query.
  const qc = useQueryClient();
  return modules.flatMap((m) => {
    const cached = qc.getQueryData<LmsLesson[]>(["lms-lessons", m.id]) ?? [];
    return cached;
  });
}

// ── Main dialog ────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  courseId: string;
}

type Step = "upload" | "assign" | "confirm";

export default function BulkImageUploadDialog({ open, onClose, courseId }: Props) {
  const { toast } = useToast();
  const addMedia = useAddMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [confirming, setConfirming] = useState(false);

  const resetAndClose = () => {
    setStep("upload");
    setImages([]);
    onClose();
  };

  const handleFiles = useCallback(
    async (files: File[]) => {
      const imageFiles = files.filter((f) => f.type.startsWith("image/"));
      if (!imageFiles.length) return;

      setUploading(true);
      try {
        const results: UploadedImage[] = [];
        for (const file of imageFiles) {
          const preview = URL.createObjectURL(file);
          const url = await uploadMediaFile(file, "lms", courseId);
          const media = await addMedia.mutateAsync({
            file_url: url,
            file_name: file.name,
            file_type: "image",
            mime_type: resolveContentType(file),
            file_size: file.size,
            position: 0,
            source_type: "lms",
            source_id: courseId,
          });
          results.push({ file, url, mediaId: media.id, preview, lessonId: null });
        }
        setImages((prev) => [...prev, ...results]);
        setStep("assign");
      } catch (err) {
        toastError(toast, err instanceof Error ? err : "Erreur lors de l'upload.");
      } finally {
        setUploading(false);
      }
    },
    [courseId, addMedia, toast],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    handleFiles(Array.from(e.dataTransfer.files));
  };

  const handleConfirm = async () => {
    const unassigned = images.filter((img) => !img.lessonId);
    if (unassigned.length) {
      toast({ title: `${unassigned.length} image(s) sans leçon assignée`, variant: "destructive" });
      return;
    }

    setConfirming(true);
    try {
      // Group by lessonId to create blocks with correct positions
      const byLesson = new Map<string, UploadedImage[]>();
      for (const img of images) {
        const arr = byLesson.get(img.lessonId!) ?? [];
        arr.push(img);
        byLesson.set(img.lessonId!, arr);
      }

      for (const [lessonId, imgs] of byLesson.entries()) {
        for (let i = 0; i < imgs.length; i++) {
          const img = imgs[i];
          // useCreateLessonBlock is a hook — we call the service directly here
          const { createLessonBlock } = await import("@/services/lms-blocks");
          await createLessonBlock({
            lesson_id: lessonId,
            type: "image",
            kind: "content",
            parent_block_id: null,
            position: 9999 + i, // appended at end; builder reorders
            content: { url: img.url, caption_html: null },
          });
        }
      }

      toast({ title: `${images.length} image(s) ajoutée(s) aux leçons` });
      resetAndClose();
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur lors de la création des blocs.");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); }}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Importer des images dans les leçons
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div
              className="w-full border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Spinner />
                  <p className="text-sm text-muted-foreground">Upload en cours…</p>
                </>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm font-medium">Glissez vos images ici ou cliquez pour sélectionner</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WEBP, GIF — plusieurs fichiers acceptés</p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
            />
          </div>
        )}

        {/* Step 2: Assign lessons */}
        {step === "assign" && (
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            <p className="text-sm text-muted-foreground">
              Assignez chaque image à une leçon. Un bloc image sera créé dans la leçon choisie.
            </p>
            {images.map((img, idx) => (
              <div key={img.mediaId} className="flex items-center gap-3 border rounded-lg p-3">
                <img src={img.preview} alt={img.file.name} className="h-14 w-14 object-cover rounded shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate mb-1">{img.file.name}</p>
                  <LessonPicker
                    courseId={courseId}
                    value={img.lessonId}
                    onChange={(lessonId) =>
                      setImages((prev) =>
                        prev.map((im, i) => (i === idx ? { ...im, lessonId } : im)),
                      )
                    }
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}

            {/* Add more */}
            <button
              type="button"
              className="w-full border-2 border-dashed rounded-lg p-4 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors flex items-center justify-center gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Ajouter d'autres images
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(Array.from(e.target.files ?? []))}
            />
          </div>
        )}

        {/* Footer */}
        {step === "assign" && (
          <div className="flex justify-between items-center pt-3 border-t">
            <span className="text-xs text-muted-foreground">{images.length} image(s)</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetAndClose}>Annuler</Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={confirming || images.some((i) => !i.lessonId)}
              >
                {confirming ? <Spinner className="h-4 w-4 mr-1" /> : null}
                Créer les blocs ({images.length})
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
