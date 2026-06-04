import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  Plus,
  Trash2,
  Settings2,
  Share2,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Mail,
  Download,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  useSurveyByPageId,
  useCreateSurvey,
  useUpdateSurvey,
  useSurveyQuestions,
  useUpsertSurveyQuestion,
  useDeleteSurveyQuestion,
  useReorderSurveyQuestions,
  useSurveyResponses,
  type SurveyQuestion,
} from "@/hooks/useMissionSurvey";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { MissionPage } from "@/hooks/useMissions";
import SurveyResults from "./SurveyResults";

const FREE_EXPRESSION_LABEL = "Expression libre, vous avez quelque chose à ajouter ? À préciser ?";

const isExpressionLibre = (q: SurveyQuestion) => q.label === FREE_EXPRESSION_LABEL;

const QUESTION_TYPES = [
  { value: "text", label: "Texte court" },
  { value: "textarea", label: "Texte long" },
  { value: "single_choice", label: "Choix unique" },
  { value: "multiple_choice", label: "Choix multiple" },
  { value: "rating", label: "Note (étoiles)" },
  { value: "nps", label: "NPS (0-10)" },
  { value: "date", label: "Date" },
] as const;

// ── Sortable question row ─────────────────────────────────────────────

function SortableQuestion({
  question,
  onUpdate,
  onDelete,
  locked = false,
}: {
  question: SurveyQuestion;
  onUpdate: (q: Partial<SurveyQuestion> & { survey_id: string; id: string }) => void;
  onDelete: () => void;
  locked?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: question.id,
    disabled: locked,
  });
  const [expanded, setExpanded] = useState(false);
  const [localLabel, setLocalLabel] = useState(question.label);
  const [localDesc, setLocalDesc] = useState(question.description ?? "");
  const [localOptions, setLocalOptions] = useState<string[]>(
    question.options?.map((o) => o.label) ?? [""]
  );

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  const save = (patch: Partial<SurveyQuestion>) =>
    onUpdate({ ...patch, id: question.id, survey_id: question.survey_id });

  const addOption = () => setLocalOptions((prev) => [...prev, ""]);
  const updateOption = (i: number, val: string) => setLocalOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));
  const removeOption = (i: number) => setLocalOptions((prev) => prev.filter((_, idx) => idx !== i));

  const saveOptions = () =>
    save({ options: localOptions.filter(Boolean).map((l) => ({ label: l })) });

  const isChoice = question.type === "single_choice" || question.type === "multiple_choice";

  return (
    <div ref={setNodeRef} style={style} className={`border rounded-lg bg-background ${locked ? "border-muted" : ""}`}>
      <div className="flex items-center gap-2 p-3">
        {locked ? (
          <Lock className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <Badge variant={locked ? "outline" : "secondary"} className="text-xs shrink-0">
          {QUESTION_TYPES.find((t) => t.value === question.type)?.label}
        </Badge>
        <span className={`flex-1 text-sm px-0 ${locked ? "text-muted-foreground italic" : ""}`}>
          {question.label}
        </span>
        <button onClick={() => setExpanded((e) => !e)} className="text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {!locked && (
          <button onClick={onDelete} className="text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          <div className="space-y-1">
            <Label className="text-xs">Description (optionnelle)</Label>
            <Input
              value={localDesc}
              onChange={(e) => setLocalDesc(e.target.value)}
              onBlur={() => save({ description: localDesc || null })}
              placeholder="Aide ou précision..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch
              checked={question.required}
              onCheckedChange={(v) => save({ required: v })}
              id={`req-${question.id}`}
            />
            <Label htmlFor={`req-${question.id}`} className="text-xs">Obligatoire</Label>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select
              value={question.type}
              onValueChange={(v) =>
                save({ type: v as SurveyQuestion["type"] })
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUESTION_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isChoice && (
            <div className="space-y-2">
              <Label className="text-xs">Options</Label>
              {localOptions.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    onBlur={saveOptions}
                    placeholder={`Option ${i + 1}`}
                  />
                  {localOptions.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => { removeOption(i); setTimeout(saveOptions, 0); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addOption}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter une option
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Share panel ───────────────────────────────────────────────────────

function SurveySharePanel({ token, recipientEmails, onUpdateEmails }: {
  token: string;
  recipientEmails: string[];
  onUpdateEmails: (emails: string[]) => void;
}) {
  const { copied, copy } = useCopyToClipboard();
  const [emailInput, setEmailInput] = useState(recipientEmails.join(", "));
  const url = `${window.location.origin}/sondage/${token}`;

  const saveEmails = () => {
    const emails = emailInput
      .split(/[,;\n]+/)
      .map((e) => e.trim())
      .filter(Boolean);
    onUpdateEmails(emails);
  };

  return (
    <div className="space-y-6 max-w-lg">
      <div className="space-y-2">
        <Label>Lien public</Label>
        <div className="flex gap-2">
          <Input value={url} readOnly className="font-mono text-xs" />
          <Button variant="outline" size="icon" onClick={() => copy(url)}>
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Partagez ce lien — les participants répondent sans créer de compte.</p>
      </div>

      <div className="space-y-2">
        <Label className="flex items-center gap-2"><Mail className="h-4 w-4" /> Liste d'emails (envoi manuel)</Label>
        <Textarea
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          onBlur={saveEmails}
          placeholder="jean@example.com, marie@example.com"
          rows={4}
        />
        <p className="text-xs text-muted-foreground">Séparés par une virgule, un point-virgule ou un saut de ligne. La liste est sauvegardée.</p>
      </div>
    </div>
  );
}

// ── Main builder ──────────────────────────────────────────────────────

export default function SurveyBuilder({ page, missionId }: { page: MissionPage; missionId: string }) {
  const { toast } = useToast();
  const { data: survey, isLoading: surveyLoading } = useSurveyByPageId(page.id);
  const { data: questions = [], isLoading: qLoading } = useSurveyQuestions(survey?.id ?? "");
  const { data: responses = [] } = useSurveyResponses(survey?.id ?? "");
  const createSurvey = useCreateSurvey();
  const updateSurvey = useUpdateSurvey();
  const upsertQuestion = useUpsertSurveyQuestion();
  const deleteQuestion = useDeleteSurveyQuestion();
  const reorderQuestions = useReorderSurveyQuestions();

  const [localTitle, setLocalTitle] = useState("");
  const [localIntro, setLocalIntro] = useState("");
  const [localThanks, setLocalThanks] = useState("");
  const [localRequireIdentity, setLocalRequireIdentity] = useState(false);
  const [localQuestions, setLocalQuestions] = useState<SurveyQuestion[]>([]);

  useEffect(() => {
    if (survey) {
      setLocalTitle(survey.title);
      setLocalIntro(survey.intro_message ?? "");
      setLocalThanks(survey.thank_you_message);
      setLocalRequireIdentity(!!survey.require_identity);
    }
  }, [survey?.id]);

  useEffect(() => {
    setLocalQuestions(questions);
    if (!survey) return;
    if (qLoading) return;
    // Guard: only add Expression libre if NONE exists yet (avoid duplicates
    // when ordering becomes ambiguous due to colliding positions).
    if (!questions.some(isExpressionLibre)) {
      upsertQuestion.mutate({
        survey_id: survey.id,
        type: "textarea",
        label: FREE_EXPRESSION_LABEL,
        required: false,
        position: questions.length,
      });
    }
  }, [survey?.id, questions.length, qLoading]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Ensure survey exists
  const ensureSurvey = async () => {
    if (survey) return survey;
    return createSurvey.mutateAsync({ mission_page_id: page.id, mission_id: missionId, title: page.title || "Sondage" });
  };

  const handleAddQuestion = async () => {
    try {
      const s = await ensureSurvey();
      // Insert before the Expression libre question (always last)
      const exprIdx = localQuestions.findIndex(isExpressionLibre);
      const insertAt = exprIdx >= 0 ? exprIdx : localQuestions.length;
      await upsertQuestion.mutateAsync({
        survey_id: s.id,
        type: "text",
        label: "",
        required: false,
        position: insertAt,
      });
    } catch (e) {
      toastError(toast, e instanceof Error ? e : "Erreur");
    }
  };

  const handleUpdateQuestion = async (q: Partial<SurveyQuestion> & { survey_id: string; id: string }) => {
    try {
      await upsertQuestion.mutateAsync(q);
    } catch (e) {
      toastError(toast, e instanceof Error ? e : "Erreur");
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    if (!survey) return;
    try {
      await deleteQuestion.mutateAsync({ id, surveyId: survey.id });
    } catch (e) {
      toastError(toast, e instanceof Error ? e : "Erreur");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!survey) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localQuestions.findIndex((q) => q.id === active.id);
    const newIndex = localQuestions.findIndex((q) => q.id === over.id);
    // Never allow moving to or past the Expression libre position
    const exprIdx = localQuestions.findIndex(isExpressionLibre);
    if (exprIdx >= 0 && newIndex >= exprIdx) return;
    const reordered = arrayMove(localQuestions, oldIndex, newIndex);
    setLocalQuestions(reordered);
    await reorderQuestions.mutateAsync({
      surveyId: survey.id,
      ordered: reordered.map((q, i) => ({ id: q.id, position: i })),
    });
  };

  const saveSurveyMeta = async () => {
    try {
      const s = await ensureSurvey();
      await updateSurvey.mutateAsync({
        id: s.id,
        updates: {
          title: localTitle || page.title || "Sondage",
          intro_message: localIntro || null,
          thank_you_message: localThanks || "Merci pour vos réponses !",
          require_identity: localRequireIdentity,
        },
      });
      toast({ title: "Sondage sauvegardé" });
    } catch (e) {
      toastError(toast, e instanceof Error ? e : "Erreur");
    }
  };

  const toggleRequireIdentity = async (val: boolean) => {
    setLocalRequireIdentity(val);
    try {
      const s = await ensureSurvey();
      await updateSurvey.mutateAsync({ id: s.id, updates: { require_identity: val } });
    } catch (e) {
      toastError(toast, e instanceof Error ? e : "Erreur");
    }
  };

  const handleUpdateEmails = async (emails: string[]) => {
    if (!survey) return;
    try {
      await updateSurvey.mutateAsync({ id: survey.id, updates: { recipient_emails: emails } });
      toast({ title: "Liste d'emails sauvegardée" });
    } catch (e) {
      toastError(toast, e instanceof Error ? e : "Erreur");
    }
  };

  if (surveyLoading || qLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner size="md" className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="builder"><Settings2 className="h-4 w-4 mr-2" />Builder</TabsTrigger>
          <TabsTrigger value="share"><Share2 className="h-4 w-4 mr-2" />Partager</TabsTrigger>
          <TabsTrigger value="results">
            <BarChart3 className="h-4 w-4 mr-2" />
            Résultats
            {responses.length > 0 && (
              <Badge variant="secondary" className="ml-2 text-xs">{responses.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── Builder tab ── */}
        <TabsContent value="builder" className="space-y-6 pt-4">
          <div className="space-y-4 max-w-lg">
            <div className="space-y-1">
              <Label>Titre du sondage</Label>
              <Input
                value={localTitle}
                onChange={(e) => setLocalTitle(e.target.value)}
                onBlur={saveSurveyMeta}
                placeholder="Titre..."
              />
            </div>
            <div className="space-y-1">
              <Label>Message d'introduction (optionnel)</Label>
              <Textarea
                value={localIntro}
                onChange={(e) => setLocalIntro(e.target.value)}
                onBlur={saveSurveyMeta}
                placeholder="Contexte ou instructions pour les participants..."
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label>Message de remerciement</Label>
              <Textarea
                value={localThanks}
                onChange={(e) => setLocalThanks(e.target.value)}
                onBlur={saveSurveyMeta}
                placeholder="Merci pour vos réponses !"
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Identité obligatoire</Label>
                <p className="text-xs text-muted-foreground">
                  Si activé, le nom et l'email du répondant sont requis. Sinon, ils restent optionnels (les champs sont toujours affichés).
                </p>
              </div>
              <Switch checked={localRequireIdentity} onCheckedChange={toggleRequireIdentity} />
            </div>
          </div>


          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Questions</Label>
              <Button size="sm" onClick={handleAddQuestion} disabled={upsertQuestion.isPending}>
                <Plus className="h-4 w-4 mr-1" /> Ajouter une question
              </Button>
            </div>

            {localQuestions.length === 0 ? (
              <div className="border-2 border-dashed rounded-lg py-10 text-center text-muted-foreground text-sm">
                Aucune question — cliquez sur "Ajouter une question" pour commencer.
              </div>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={localQuestions.map((q) => q.id)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {localQuestions.map((q) => (
                      <SortableQuestion
                        key={q.id}
                        question={q}
                        onUpdate={handleUpdateQuestion}
                        onDelete={() => handleDeleteQuestion(q.id)}
                        locked={isExpressionLibre(q)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </TabsContent>

        {/* ── Share tab ── */}
        <TabsContent value="share" className="pt-4">
          {survey ? (
            <SurveySharePanel
              token={survey.public_token}
              recipientEmails={survey.recipient_emails}
              onUpdateEmails={handleUpdateEmails}
            />
          ) : (
            <div className="text-sm text-muted-foreground py-6">
              Ajoutez d'abord une question pour activer le partage.
            </div>
          )}
        </TabsContent>

        {/* ── Results tab ── */}
        <TabsContent value="results" className="pt-4">
          {survey ? (
            <SurveyResults survey={survey} questions={localQuestions} responses={responses} />
          ) : (
            <div className="text-sm text-muted-foreground py-6">Aucune réponse pour l'instant.</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
