import { useMemo, useState } from "react";
import { FileText, AlertCircle, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { toastError } from "@/lib/toastError";
import { useCourseModules, useCourseLessons, useCreateLesson } from "@/hooks/useLms";
import { useTranscriptsPage } from "@/hooks/useTranscripts";
import { createLessonBlock } from "@/services/lms-blocks";
import {
  analyzeTranscriptsForLessons,
  buildLessonBlockContents,
  fetchTranscriptText,
  type ProposedLesson,
  type TranscriptInput,
} from "@/services/lmsTranscriptImport";

type Step = "source" | "analyzing" | "validate" | "confirming";

interface Props {
  open: boolean;
  onClose: () => void;
  courseId: string;
}

interface DraftLesson extends ProposedLesson {
  key: string;
  transcriptId: string | null;
  transcriptTitle: string;
  selected: boolean;
  blockSelection: boolean[];
}

const PAGE_SIZE = 20;

export default function TranscriptImportDialog({ open, onClose, courseId }: Props) {
  const { toast } = useToast();
  const { copy: copyError } = useCopyToClipboard({ defaultToastTitle: "Erreur copiée" });
  const { data: modules = [] } = useCourseModules(courseId);
  const { data: courseLessons = [] } = useCourseLessons(courseId);
  const createLesson = useCreateLesson();

  const [step, setStep] = useState<Step>("source");
  const [tab, setTab] = useState<"library" | "paste">("library");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pastedTitle, setPastedTitle] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [moduleId, setModuleId] = useState<string>("");
  const [drafts, setDrafts] = useState<DraftLesson[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { data: page, isLoading: listLoading } = useTranscriptsPage({
    search,
    status: "ready",
    page: 0,
    pageSize: PAGE_SIZE,
  });

  const targetModuleId = moduleId || modules[modules.length - 1]?.id || "";

  const moduleTitleById = useMemo(
    () => new Map(modules.map((m) => [m.id, m.title])),
    [modules],
  );

  const lessonOptions = useMemo(
    () =>
      courseLessons.map((l) => ({
        id: l.id,
        title: l.title,
        module_title: moduleTitleById.get(l.module_id) ?? "",
      })),
    [courseLessons, moduleTitleById],
  );

  const reset = () => {
    setStep("source");
    setTab("library");
    setSearch("");
    setSelectedIds([]);
    setPastedTitle("");
    setPastedText("");
    setDrafts([]);
    setExpanded(null);
    setProgress(0);
    setError(null);
  };

  const resetAndClose = () => {
    reset();
    onClose();
  };

  const toggleTranscript = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const canAnalyze =
    tab === "library" ? selectedIds.length > 0 : pastedText.trim().length > 50;

  // ── Analyse ────────────────────────────────────────────────────────────

  const runAnalysis = async () => {
    setError(null);
    setStep("analyzing");
    setProgress(8);

    const tick = setInterval(() => setProgress((p) => (p < 92 ? p + 3 : p)), 700);

    try {
      let inputs: TranscriptInput[] = [];
      const titleById = new Map<string, string>();

      if (tab === "library") {
        for (const id of selectedIds) {
          const loaded = await fetchTranscriptText(id);
          if (!loaded) continue;
          inputs.push(loaded);
          titleById.set(loaded.id, loaded.title);
        }
        if (!inputs.length) throw new Error("Les transcripts sélectionnés n'ont aucun texte exploitable.");
      } else {
        const pastedId = crypto.randomUUID();
        const title = pastedTitle.trim() || "Texte collé";
        inputs = [{ id: pastedId, title, text: pastedText.trim() }];
        titleById.set(pastedId, title);
      }

      const { proposals, failures } = await analyzeTranscriptsForLessons(inputs, lessonOptions);

      const next: DraftLesson[] = [];
      for (const proposal of proposals) {
        const isLibrary = tab === "library";
        proposal.lessons.forEach((lesson, index) => {
          const blockCount = buildLessonBlockContents(lesson).length;
          next.push({
            ...lesson,
            key: `${proposal.transcript_id}-${index}`,
            transcriptId: isLibrary ? proposal.transcript_id : null,
            transcriptTitle: titleById.get(proposal.transcript_id) ?? "Transcript",
            selected: true,
            blockSelection: Array.from({ length: blockCount }, () => true),
          });
        });
      }

      if (!next.length) throw new Error("L'IA n'a proposé aucune leçon exploitable.");

      setDrafts(next);
      setExpanded(next[0]?.key ?? null);
      setProgress(100);
      setStep("validate");

      if (failures.length) {
        toast({
          title: "Certains transcripts n'ont pas pu être analysés",
          description: failures.join(" · "),
          variant: "destructive",
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'analyse IA.";
      setError(msg);
      setStep("source");
      toastError(toast, msg);
    } finally {
      clearInterval(tick);
    }
  };

  // ── Création ───────────────────────────────────────────────────────────

  const patchDraft = (key: string, patch: Partial<DraftLesson>) =>
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const handleConfirm = async () => {
    const kept = drafts.filter((d) => d.selected);
    if (!kept.length) return;
    setStep("confirming");

    try {
      let lessonsCreated = 0;
      let blocksCreated = 0;

      for (const draft of kept) {
        const contents = buildLessonBlockContents(draft).filter((_, i) => draft.blockSelection[i] !== false);
        if (!contents.length) continue;

        let lessonId = draft.target_lesson_id;

        if (!lessonId) {
          if (!targetModuleId) throw new Error("Aucun module dans ce cours : créez un module d'abord.");
          const siblings = courseLessons.filter((l) => l.module_id === targetModuleId);
          const created = await createLesson.mutateAsync({
            module_id: targetModuleId,
            title: draft.title,
            lesson_type: "content",
            position: siblings.length + lessonsCreated,
            ...(draft.transcriptId ? { source_transcript_id: draft.transcriptId } : {}),
          } as Parameters<typeof createLesson.mutateAsync>[0]);
          lessonId = created.id;
          lessonsCreated++;
        }

        for (const content of contents) {
          await createLessonBlock({
            lesson_id: lessonId,
            type: "text",
            kind: "content",
            parent_block_id: null,
            position: 9999,
            content,
            ...(draft.transcriptId ? { source_transcript_id: draft.transcriptId } : {}),
          } as Parameters<typeof createLessonBlock>[0]);
          blocksCreated++;
        }
      }

      toast({
        title: `${lessonsCreated} leçon${lessonsCreated > 1 ? "s" : ""} créée${lessonsCreated > 1 ? "s" : ""}, ${blocksCreated} bloc${blocksCreated > 1 ? "s" : ""} ajouté${blocksCreated > 1 ? "s" : ""}`,
      });
      resetAndClose();
    } catch (err) {
      setStep("validate");
      toastError(toast, err instanceof Error ? err : "Erreur lors de la création des leçons.");
    }
  };

  // ── Rendu ──────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetAndClose(); }}>
      <DialogContent className="w-full max-w-3xl max-h-[90vh] flex flex-col gap-0">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Construire des leçons à partir d'un transcript
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="mb-3 rounded-lg border border-destructive/40 bg-destructive/5 p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-xs text-destructive/90 whitespace-pre-wrap break-words flex-1">{error}</p>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => copyError(error)}>
              Copier
            </Button>
          </div>
        )}

        {step === "source" && (
          <div className="flex-1 overflow-y-auto space-y-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "library" | "paste")}>
              <TabsList>
                <TabsTrigger value="library">Bibliothèque</TabsTrigger>
                <TabsTrigger value="paste">Coller un texte</TabsTrigger>
              </TabsList>

              <TabsContent value="library" className="space-y-3 pt-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Rechercher un transcript…"
                    className="pl-9"
                  />
                </div>
                <div className="border rounded-lg divide-y max-h-72 overflow-y-auto">
                  {listLoading && <p className="p-3 text-sm text-muted-foreground">Chargement…</p>}
                  {!listLoading && !page?.rows.length && (
                    <p className="p-3 text-sm text-muted-foreground">Aucun transcript disponible.</p>
                  )}
                  {page?.rows.map((t) => (
                    <label key={t.id} className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/40">
                      <Checkbox
                        checked={selectedIds.includes(t.id)}
                        onCheckedChange={() => toggleTranscript(t.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium truncate">
                          {t.ai_title || t.title || "Sans titre"}
                        </span>
                        {t.summary && (
                          <span className="block text-xs text-muted-foreground line-clamp-2">{t.summary}</span>
                        )}
                        {!!t.duration_seconds && (
                          <span className="block text-xs text-muted-foreground">
                            {Math.round(t.duration_seconds / 60)} min
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="paste" className="space-y-3 pt-3">
                <div className="space-y-1">
                  <Label>Titre (optionnel)</Label>
                  <Input value={pastedTitle} onChange={(e) => setPastedTitle(e.target.value)} placeholder="Atelier du 12 mars" />
                </div>
                <div className="space-y-1">
                  <Label>Texte du transcript</Label>
                  <Textarea
                    rows={12}
                    value={pastedText}
                    onChange={(e) => setPastedText(e.target.value)}
                    placeholder="Collez ici le texte de la réunion ou de l'atelier…"
                  />
                </div>
              </TabsContent>
            </Tabs>

            <div className="space-y-1">
              <Label>Module de destination des nouvelles leçons</Label>
              <Select value={targetModuleId} onValueChange={setModuleId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un module" />
                </SelectTrigger>
                <SelectContent>
                  {modules.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={resetAndClose}>Annuler</Button>
              <Button onClick={runAnalysis} disabled={!canAnalyze}>Analyser</Button>
            </div>
          </div>
        )}

        {step === "analyzing" && (
          <div className="py-10 space-y-4 text-center">
            <Spinner className="mx-auto" />
            <p className="text-sm text-muted-foreground">
              Découpage du transcript en leçons… cela peut prendre une à deux minutes.
            </p>
            <Progress value={progress} className="max-w-sm mx-auto" />
          </div>
        )}

        {(step === "validate" || step === "confirming") && (
          <div className="flex-1 overflow-y-auto space-y-3">
            <p className="text-sm text-muted-foreground">
              {drafts.filter((d) => d.selected).length} leçon(s) retenue(s) sur {drafts.length} proposée(s).
              Rien n'est écrit dans le cours avant confirmation.
            </p>

            {drafts.map((draft) => {
              const blocks = buildLessonBlockContents(draft);
              const isOpen = expanded === draft.key;
              return (
                <div key={draft.key} className="border rounded-lg">
                  <div className="flex items-center gap-2 p-3">
                    <Checkbox
                      checked={draft.selected}
                      onCheckedChange={(c) => patchDraft(draft.key, { selected: !!c })}
                    />
                    <Input
                      value={draft.title}
                      onChange={(e) => patchDraft(draft.key, { title: e.target.value })}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      className="p-1 text-muted-foreground hover:text-foreground"
                      onClick={() => setExpanded(isOpen ? null : draft.key)}
                      aria-label={isOpen ? "Replier" : "Déplier"}
                    >
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="px-3 pb-3 space-y-3 border-t pt-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Destination</Label>
                        <Select
                          value={draft.target_lesson_id ?? "new"}
                          onValueChange={(v) =>
                            patchDraft(draft.key, { target_lesson_id: v === "new" ? null : v })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">Créer une nouvelle leçon</SelectItem>
                            {lessonOptions.map((l) => (
                              <SelectItem key={l.id} value={l.id}>
                                Compléter : {l.title}
                                {l.module_title ? ` (${l.module_title})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {blocks.map((b, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <Checkbox
                            checked={draft.blockSelection[i] !== false}
                            onCheckedChange={(c) => {
                              const next = [...draft.blockSelection];
                              next[i] = !!c;
                              patchDraft(draft.key, { blockSelection: next });
                            }}
                          />
                          <Textarea
                            rows={5}
                            value={b.html}
                            onChange={(e) => {
                              const value = e.target.value;
                              if (i === 0 && draft.summary_html) {
                                patchDraft(draft.key, { summary_html: value });
                                return;
                              }
                              const offset = draft.summary_html ? 1 : 0;
                              const sectionIndex = i - offset;
                              if (sectionIndex >= 0 && sectionIndex < draft.sections.length) {
                                const sections = draft.sections.map((s, si) =>
                                  si === sectionIndex ? { heading: "", html: value } : s,
                                );
                                patchDraft(draft.key, { sections });
                                return;
                              }
                              // Bloc « À retenir » : la saisie libre remplace les points clés.
                              patchDraft(draft.key, {
                                key_points: [],
                                sections: [...draft.sections, { heading: "", html: value }],
                              });
                            }}
                            className="font-mono text-xs"
                          />
                        </div>
                      ))}

                      <p className="text-xs text-muted-foreground">
                        Issu du transcript : {draft.transcriptTitle}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setStep("source")} disabled={step === "confirming"}>
                Relancer l'analyse
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={step === "confirming" || !drafts.some((d) => d.selected)}
              >
                {step === "confirming" ? "Création…" : "Créer les leçons"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
