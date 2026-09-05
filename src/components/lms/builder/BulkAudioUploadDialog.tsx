import { useState, useRef, useCallback } from "react";
import { Mic, Upload, ChevronDown, Loader2, CheckCircle2, AlertCircle, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useCourseModules, useModuleLessons, useCourseLessons, useCreateLesson } from "@/hooks/useLms";
import { useCreateLessonBlock } from "@/hooks/useLmsBlocks";
import { uploadMediaFile, useAddMedia } from "@/hooks/useMedia";
import { resolveContentType } from "@/lib/file-utils";
import { transcribeAudio, analyzeAudioForLessons, type AudioSegment } from "@/services/lmsMediaImport";
import { createLessonBlock } from "@/services/lms-blocks";
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

// ── Lesson picker (shared with BulkImageUploadDialog pattern) ─────────────

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

function LessonPicker({
  courseId,
  value,
  onChange,
}: {
  courseId: string;
  value: string | null;
  onChange: (lessonId: string | null) => void;
}) {
  const { data: modules = [] } = useCourseModules(courseId);
  const qc = useQueryClient();
  const lessonLabel = (() => {
    if (!value) return <span className="text-muted-foreground">Ressources</span>;
    for (const m of modules) {
      const cached = qc.getQueryData<LmsLesson[]>(["lms-lessons", m.id]) ?? [];
      const found = cached.find((l) => l.id === value);
      if (found) return <span className="truncate">{found.title}</span>;
    }
    return <span className="truncate">Leçon sélectionnée</span>;
  })();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between text-xs h-8">
          {lessonLabel}
          <ChevronDown className="h-3.5 w-3.5 ml-1 opacity-50 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 max-h-72 overflow-y-auto">
        <DropdownMenuItem onSelect={() => onChange(null)} className="text-sm italic text-muted-foreground">
          Leçon "Ressources"
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        {modules.map((mod) => (
          <ModuleGroup key={mod.id} module={mod} onSelect={onChange} />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────

type TranscriptionStatus = "pending" | "transcribing" | "done" | "error";

interface AudioItem {
  id: string; // temp client id
  file: File;
  mediaId: string;
  url: string;
  status: TranscriptionStatus;
  transcript: string;
  error?: string;
  // After AI analysis: one entry per detected topic
  segments: AudioSegment[];
}

type Step = "upload" | "transcribing" | "validate" | "confirming";

/** Recolle les segments d'un audio en un seul, quand le découpage IA ne convient pas. */
function mergeSegments(segments: AudioSegment[]): AudioSegment[] {
  if (segments.length <= 1) return segments;
  return [
    {
      title: segments[0].title,
      lesson_id: segments[0].lesson_id,
      reformulated_text: segments.map((s) => s.reformulated_text).join("\n"),
      key_points: segments.flatMap((s) => s.key_points),
    },
  ];
}

// ── Main dialog ────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  courseId: string;
}

export default function BulkAudioUploadDialog({ open, onClose, courseId }: Props) {
  const { toast } = useToast();
  const { copy } = useCopyToClipboard();
  const addMedia = useAddMedia();
  const createLesson = useCreateLesson();
  const { data: modules = [] } = useCourseModules(courseId);
  const { refetch: refetchCourseLessons } = useCourseLessons(courseId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();

  const [step, setStep] = useState<Step>("upload");
  const [audios, setAudios] = useState<AudioItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const resetAndClose = () => {
    setStep("upload");
    setAudios([]);
    setGlobalError(null);
    setUploadError(null);
    onClose();
  };

  const copyError = (msg: string) => {
    copy(msg, { title: "Erreur copiée dans le presse-papiers" });
  };

  // ── Step 1: Upload + transcribe ───────────────────────────────────────

  const handleFiles = useCallback(
    async (files: File[]) => {
      const audioFiles = files.filter((f) => f.type.startsWith("audio/") || f.name.match(/\.(mp3|m4a|wav|ogg|webm|aac|flac)$/i));
      if (!audioFiles.length) return;

      setUploading(true);
      setUploadError(null);
      const newItems: AudioItem[] = [];

      try {
        for (const file of audioFiles) {
          try {
            const url = await uploadMediaFile(file, "lms", courseId);
            const media = await addMedia.mutateAsync({
              file_url: url,
              file_name: file.name,
              file_type: "audio",
              mime_type: resolveContentType(file),
              file_size: file.size,
              position: 0,
              source_type: "lms",
              source_id: courseId,
            });
            newItems.push({
              id: crypto.randomUUID(),
              file,
              mediaId: media.id,
              url,
              status: "pending",
              transcript: "",
              segments: [],
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Erreur inconnue";
            throw new Error(`Upload de "${file.name}" a échoué : ${msg}`);
          }
        }

        setAudios((prev) => [...prev, ...newItems]);
        setStep("transcribing");
        setUploading(false);

        // Transcribe all
        await transcribeAll([...audios, ...newItems]);
      } catch (err) {
        setUploading(false);
        const msg = err instanceof Error ? err.message : "Erreur lors de l'upload.";
        setUploadError(msg);
        toastError(toast, msg);
      }
    },
    [courseId, addMedia, audios, toast],
  );

  const transcribeAll = async (items: AudioItem[]) => {
    const updated = [...items];
    setGlobalError(null);

    setAudios(updated.map((a) => ({ ...a, status: "transcribing" as TranscriptionStatus })));

    for (let i = 0; i < updated.length; i++) {
      try {
        const transcript = await transcribeAudio(updated[i].url);
        if (!transcript || !transcript.trim()) {
          updated[i] = {
            ...updated[i],
            status: "error",
            error: "Transcription vide — aucune voix détectée ou fichier illisible.",
          };
        } else {
          updated[i] = { ...updated[i], status: "done", transcript };
        }
      } catch (err) {
        updated[i] = { ...updated[i], status: "error", error: err instanceof Error ? err.message : "Erreur" };
      }
      setAudios([...updated]);
    }

    // Toutes les leçons du cours, lues en base : le cache ne contient que les
    // modules déjà ouverts, ce qui privait l'IA d'une partie des leçons cibles.
    const { data: freshLessons } = await refetchCourseLessons();
    const moduleTitleById = new Map(modules.map((m) => [m.id, m.title]));
    const allLessons = (freshLessons ?? []).map((l) => ({
      id: l.id,
      title: l.title,
      module_title: moduleTitleById.get(l.module_id) ?? "",
    }));

    const successAudios = updated.filter((a) => a.status === "done" && a.transcript);
    if (!successAudios.length) {
      const errors = updated.map((a) => a.error).filter(Boolean).join(" · ");
      const msg = errors || "La transcription a échoué pour tous les fichiers.";
      setGlobalError(`Transcription : ${msg}`);
      toast({
        title: "Aucun audio transcrit avec succès",
        description: msg,
        variant: "destructive",
      });
      return;
    }

    try {
      const assignments = await analyzeAudioForLessons(
        successAudios.map((a) => ({ id: a.id, file_name: a.file.name, text: a.transcript })),
        allLessons,
      );

      setAudios((prev) =>
        prev.map((a) => {
          const assignment = assignments.find((x) => x.audio_id === a.id);
          if (!assignment) return a;
          return { ...a, segments: assignment.segments };
        }),
      );
      setStep("validate");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'analyse IA.";
      setGlobalError(`Analyse IA : ${msg}`);
      toastError(toast, msg);
    }
  };

  const retryAnalysis = async () => {
    setGlobalError(null);
    await transcribeAll(audios.map((a) => ({ ...a, status: "pending", transcript: "", error: undefined })));
  };


  // ── Step 3: Confirm ───────────────────────────────────────────────────

  const handleConfirm = async () => {
    setStep("confirming");
    try {
      // Find or create "Ressources" lesson for segments without a target lesson
      let ressourcesLessonId: string | null = null;
      const needsRessources = audios.some(
        (a) => a.status === "done" && a.segments.some((s) => s.lesson_id === null),
      );

      if (needsRessources) {
        // Search in cached lessons
        for (const mod of modules) {
          const cached = qc.getQueryData<LmsLesson[]>(["lms-lessons", mod.id]) ?? [];
          const found = cached.find((l) => l.title.toLowerCase() === "ressources");
          if (found) { ressourcesLessonId = found.id; break; }
        }

        if (!ressourcesLessonId) {
          const lastModule = modules[modules.length - 1];
          if (!lastModule) throw new Error("Aucun module dans ce cours");
          const allLessons = qc.getQueryData<LmsLesson[]>(["lms-lessons", lastModule.id]) ?? [];
          const newLesson = await createLesson.mutateAsync({
            module_id: lastModule.id,
            title: "Ressources",
            lesson_type: "content",
            position: allLessons.length,
          });
          ressourcesLessonId = newLesson.id;
        }
      }

      let blocksCreated = 0;
      for (const audio of audios) {
        if (audio.status !== "done") continue;
        for (const seg of audio.segments) {
          if (!seg.reformulated_text.trim()) continue;
          const targetLessonId = seg.lesson_id ?? ressourcesLessonId;
          if (!targetLessonId) continue;

          const htmlContent = [
            seg.title.trim() ? `<h3>${seg.title.trim()}</h3>` : "",
            seg.reformulated_text,
            seg.key_points.length
              ? `<ul>${seg.key_points.map((kp) => `<li><strong>${kp}</strong></li>`).join("")}</ul>`
              : "",
          ]
            .filter(Boolean)
            .join("\n");

          await createLessonBlock({
            lesson_id: targetLessonId,
            type: "text",
            kind: "content",
            parent_block_id: null,
            position: 9999,
            content: { html: htmlContent },
          });
          blocksCreated++;
        }
      }

      toast({
        title: `${blocksCreated} bloc${blocksCreated > 1 ? "s" : ""} créé${blocksCreated > 1 ? "s" : ""} dans les leçons`,
      });
      resetAndClose();
    } catch (err) {
      setStep("validate");
      toastError(toast, err instanceof Error ? err : "Erreur lors de la création des blocs.");
    }
  };

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); }}>
      <DialogContent className="w-full max-w-2xl max-h-[90vh] flex flex-col gap-0">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Importer des audios dans les leçons
          </DialogTitle>
        </DialogHeader>

        {/* Upload drop zone */}
        {step === "upload" && (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            {uploadError && (
              <div className="w-full rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-destructive">Échec de l'upload</p>
                    <p className="text-xs text-destructive/80 mt-0.5 whitespace-pre-wrap break-words">{uploadError}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyError(uploadError)}>Copier</Button>
                </div>
              </div>
            )}
            <div
              className="w-full border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
              onDrop={(e) => { e.preventDefault(); handleFiles(Array.from(e.dataTransfer.files)); }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <><Spinner /><p className="text-sm text-muted-foreground">Upload en cours…</p></>
              ) : (
                <>
                  <Upload className="h-10 w-10 text-muted-foreground/50" />
                  <p className="text-sm font-medium">Glissez vos fichiers audio ici ou cliquez</p>
                  <p className="text-xs text-muted-foreground">MP3, M4A, WAV, OGG, AAC — plusieurs fichiers acceptés</p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg,.aac,.flac" multiple className="hidden"
              onChange={(e) => handleFiles(Array.from(e.target.files ?? []))} />
          </div>
        )}

        {/* Transcription progress */}
        {step === "transcribing" && (
          <div className="flex-1 overflow-y-auto space-y-2 py-2">
            <p className="text-sm text-muted-foreground mb-3">
              Transcription en cours… L'analyse IA démarrera une fois tous les audios traités.
            </p>
            {globalError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 space-y-2 mb-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-destructive">Le traitement a échoué</p>
                    <p className="text-xs text-destructive/80 mt-0.5 whitespace-pre-wrap break-words font-mono">{globalError}</p>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyError(globalError)}>Copier</Button>
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={retryAnalysis}>Réessayer</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={resetAndClose}>Fermer</Button>
                </div>
              </div>
            )}
            {audios.map((audio) => (
              <div key={audio.id} className="border rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="shrink-0">
                    {audio.status === "transcribing" || audio.status === "pending"
                      ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      : audio.status === "done"
                      ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      : <AlertCircle className="h-4 w-4 text-destructive" />}
                  </div>
                  <span className="text-sm flex-1 truncate">{audio.file.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {audio.status === "pending" ? "En attente" : audio.status === "transcribing" ? "Transcription…" : audio.status === "done" ? "Transcrit" : "Erreur"}
                  </span>
                </div>
                {audio.status === "error" && audio.error && (
                  <p className="text-xs text-destructive/80 mt-1.5 pl-7 whitespace-pre-wrap break-words font-mono">{audio.error}</p>
                )}
              </div>
            ))}
          </div>
        )}


        {/* Validation */}
        {(step === "validate" || step === "confirming") && (
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 py-2">
            <p className="text-sm text-muted-foreground">
              Vérifiez et ajustez le texte et l'affectation de chaque audio avant de créer les blocs.
            </p>
            {audios.map((audio, idx) => (
              <div key={audio.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate flex-1">{audio.file.name}</span>
                  {audio.status === "error" && (
                    <span className="text-xs text-destructive shrink-0">Transcription échouée</span>
                  )}
                </div>
                {audio.status === "error" && audio.error && (
                  <p className="text-xs text-destructive/80 whitespace-pre-wrap break-words font-mono">{audio.error}</p>
                )}

                {audio.status === "done" && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {audio.segments.length > 1
                          ? `${audio.segments.length} sujets détectés — chaque sujet part dans sa propre leçon`
                          : "1 sujet détecté"}
                      </span>
                      {audio.segments.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() =>
                            setAudios((prev) => prev.map((a, i) => i === idx ? { ...a, segments: mergeSegments(a.segments) } : a))
                          }
                        >
                          Fusionner en un seul bloc
                        </Button>
                      )}
                    </div>

                    {audio.segments.map((seg, segIdx) => {
                      const updateSegment = (patch: Partial<AudioSegment>) =>
                        setAudios((prev) =>
                          prev.map((a, i) => i === idx
                            ? { ...a, segments: a.segments.map((s, si) => si === segIdx ? { ...s, ...patch } : s) }
                            : a,
                          ),
                        );
                      return (
                        <div key={segIdx} className="rounded-md border border-dashed p-3 space-y-3">
                          <div className="flex items-center gap-2">
                            <Layers className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <input
                              className="flex-1 text-sm font-medium bg-transparent outline-none border-b border-transparent hover:border-muted-foreground/30 focus:border-primary transition-colors"
                              value={seg.title}
                              placeholder={`Sujet ${segIdx + 1}`}
                              onChange={(e) => updateSegment({ title: e.target.value })}
                            />
                            {audio.segments.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-destructive"
                                onClick={() =>
                                  setAudios((prev) => prev.map((a, i) => i === idx
                                    ? { ...a, segments: a.segments.filter((_, si) => si !== segIdx) }
                                    : a,
                                  ))
                                }
                              >
                                Supprimer
                              </Button>
                            )}
                          </div>

                          <div className="space-y-1">
                            <Label className="text-xs">Leçon cible</Label>
                            <LessonPicker
                              courseId={courseId}
                              value={seg.lesson_id}
                              onChange={(lessonId) => updateSegment({ lesson_id: lessonId })}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Contenu reformulé</Label>
                            <Textarea
                              value={seg.reformulated_text}
                              onChange={(e) => updateSegment({ reformulated_text: e.target.value })}
                              rows={5}
                              className="text-sm resize-y"
                            />
                          </div>
                          {seg.key_points.length > 0 && (
                            <div className="space-y-1">
                              <Label className="text-xs">Points clés</Label>
                              <ul className="text-sm space-y-1">
                                {seg.key_points.map((kp, kpIdx) => (
                                  <li key={kpIdx} className="flex gap-2 items-start">
                                    <span className="text-primary mt-0.5">•</span>
                                    <input
                                      className="flex-1 bg-transparent outline-none border-b border-transparent hover:border-muted-foreground/30 focus:border-primary transition-colors"
                                      value={kp}
                                      onChange={(e) =>
                                        updateSegment({
                                          key_points: seg.key_points.map((k, ki) => ki === kpIdx ? e.target.value : k),
                                        })
                                      }
                                    />
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {(step === "validate" || step === "confirming") && (
          <div className="flex justify-between items-center pt-3 border-t mt-2">
            <span className="text-xs text-muted-foreground">
              {audios.filter((a) => a.status === "done").length} audio(s) prêt(s)
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={resetAndClose} disabled={step === "confirming"}>Annuler</Button>
              <Button size="sm" onClick={handleConfirm} disabled={step === "confirming"}>
                {step === "confirming" ? <><Spinner className="h-4 w-4 mr-1" />Création…</> : "Créer les blocs"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
