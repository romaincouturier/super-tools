import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { ClipboardList, Plus, Trash2, GripVertical, ChevronDown, ChevronUp, Send, CalendarIcon, Copy, Check } from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { toastError } from "@/lib/toastError";
import { useToast } from "@/hooks/use-toast";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import {
  useTrainingSurvey, useTrainingSurveyQuestions, useUpsertTrainingSurvey,
  useUpsertTrainingSurveyQuestion, useDeleteTrainingSurveyQuestion,
  useReorderTrainingSurveyQuestions, useSendTrainingSurvey,
  useDuplicateTrainingSurvey,
  type TrainingSurveyQuestion,
} from "@/hooks/useTrainingSurveys";

const QUESTION_TYPES = [
  { value: "text", label: "Texte court" },
  { value: "textarea", label: "Texte long" },
  { value: "single_choice", label: "Choix unique" },
  { value: "multiple_choice", label: "Choix multiple" },
  { value: "rating", label: "Note (étoiles)" },
  { value: "nps", label: "NPS (0-10)" },
  { value: "date", label: "Date" },
] as const;

function SortableQuestion({ question, onUpdate, onDelete }: {
  question: TrainingSurveyQuestion;
  onUpdate: (q: Partial<TrainingSurveyQuestion> & { survey_id: string; id: string }) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  const [expanded, setExpanded] = useState(false);
  const [localLabel, setLocalLabel] = useState(question.label);
  const [localDesc, setLocalDesc] = useState(question.description ?? "");
  const [localOptions, setLocalOptions] = useState<string[]>(question.options?.map((o) => o.label) ?? [""]);
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const save = (patch: Partial<TrainingSurveyQuestion>) => onUpdate({ ...patch, id: question.id, survey_id: question.survey_id });
  const saveOptions = () => save({ options: localOptions.filter(Boolean).map((l) => ({ label: l })) });
  const isChoice = question.type === "single_choice" || question.type === "multiple_choice";

  return (
    <div ref={setNodeRef} style={style} className="border rounded-lg bg-background">
      <div className="flex items-center gap-2 p-3">
        <button {...attributes} {...listeners} className="cursor-grab text-muted-foreground hover:text-foreground">
          <GripVertical className="h-4 w-4" />
        </button>
        <Badge variant="secondary" className="text-xs shrink-0">{QUESTION_TYPES.find((t) => t.value === question.type)?.label}</Badge>
        <Input value={localLabel} onChange={(e) => setLocalLabel(e.target.value)} onBlur={() => save({ label: localLabel })}
          placeholder="Question..." className="flex-1 border-0 shadow-none focus-visible:ring-0 px-0" />
        <button onClick={() => setExpanded((e) => !e)} className="text-muted-foreground hover:text-foreground">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <button onClick={onDelete} className="text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t pt-3">
          <div className="space-y-1">
            <Label className="text-xs">Description (optionnelle)</Label>
            <Input value={localDesc} onChange={(e) => setLocalDesc(e.target.value)} onBlur={() => save({ description: localDesc || null })} placeholder="Aide ou précision..." />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={question.required} onCheckedChange={(v) => save({ required: v })} id={`req-${question.id}`} />
            <Label htmlFor={`req-${question.id}`} className="text-xs">Obligatoire</Label>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Type</Label>
            <Select value={question.type} onValueChange={(v) => save({ type: v as TrainingSurveyQuestion["type"] })}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {QUESTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isChoice && (
            <div className="space-y-2">
              <Label className="text-xs">Options</Label>
              {localOptions.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={opt} onChange={(e) => setLocalOptions((p) => p.map((o, idx) => idx === i ? e.target.value : o))}
                    onBlur={saveOptions} placeholder={`Option ${i + 1}`} />
                  {localOptions.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => { setLocalOptions((p) => p.filter((_, idx) => idx !== i)); setTimeout(saveOptions, 0); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setLocalOptions((p) => [...p, ""])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Ajouter une option
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface Props {
  trainingId: string;
  trainingName: string;
  participantCount: number;
}

export default function TrainingSurveyDialog({ trainingId, trainingName, participantCount }: Props) {
  const [open, setOpen] = useState(false);
  const { toast: useToastFn } = useToast();
  const { copy, copied } = useCopyToClipboard();
  const { data: survey } = useTrainingSurvey(trainingId);
  const { data: questions = [] } = useTrainingSurveyQuestions(survey?.id ?? "");
  const upsertSurvey = useUpsertTrainingSurvey();
  const upsertQuestion = useUpsertTrainingSurveyQuestion();
  const deleteQuestion = useDeleteTrainingSurveyQuestion();
  const reorderQuestions = useReorderTrainingSurveyQuestions();
  const sendSurvey = useSendTrainingSurvey();
  const duplicateSurvey = useDuplicateTrainingSurvey();

  const [title, setTitle] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [intro, setIntro] = useState("");
  const [closesAt, setClosesAt] = useState<Date | undefined>(undefined);
  const [localQuestions, setLocalQuestions] = useState<TrainingSurveyQuestion[]>([]);
  const [includeTrainer, setIncludeTrainer] = useState(false);

  useEffect(() => {
    if (survey) {
      setTitle(survey.title || "");
      setEmailSubject(survey.email_subject || "");
      setEmailBody(survey.email_body || "");
      setIntro(survey.intro_message || "");
      setClosesAt(survey.closes_at ? new Date(survey.closes_at) : undefined);
    } else {
      setTitle(`Sondage – ${trainingName}`);
      setEmailSubject(`Sondage : ${trainingName}`);
      setEmailBody(`Bonjour {{first_name}},\n\nDans le cadre de la formation "${trainingName}", merci de prendre quelques minutes pour répondre à ce sondage.\n\nVos réponses sont précieuses.`);
    }
  }, [survey?.id, trainingName]);

  useEffect(() => { setLocalQuestions(questions); }, [questions]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const ensureSurvey = async () => {
    if (survey) return survey;
    return upsertSurvey.mutateAsync({
      training_id: trainingId,
      title: title || `Sondage – ${trainingName}`,
      email_subject: emailSubject || null,
      email_body: emailBody || null,
      intro_message: intro || null,
      closes_at: closesAt ? closesAt.toISOString() : null,
    });
  };

  const saveMeta = async () => {
    try {
      const s = await ensureSurvey();
      await upsertSurvey.mutateAsync({
        id: s.id,
        training_id: trainingId,
        title,
        email_subject: emailSubject || null,
        email_body: emailBody || null,
        intro_message: intro || null,
        closes_at: closesAt ? closesAt.toISOString() : null,
      });
    } catch (e) {
      toastError(useToastFn, e instanceof Error ? e : "Erreur");
    }
  };

  const handleAddQuestion = async () => {
    try {
      const s = await ensureSurvey();
      await upsertQuestion.mutateAsync({
        survey_id: s.id, type: "text", label: "", required: false, position: localQuestions.length,
      });
    } catch (e) { toastError(useToastFn, e instanceof Error ? e : "Erreur"); }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!survey) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = localQuestions.findIndex((q) => q.id === active.id);
    const newIndex = localQuestions.findIndex((q) => q.id === over.id);
    const reordered = arrayMove(localQuestions, oldIndex, newIndex);
    setLocalQuestions(reordered);
    await reorderQuestions.mutateAsync({
      surveyId: survey.id, ordered: reordered.map((q, i) => ({ id: q.id, position: i })),
    });
  };

  const handleSend = async () => {
    if (localQuestions.length === 0) { toast.error("Ajoute au moins une question"); return; }
    if (!emailSubject.trim()) { toast.error("L'objet de l'email est requis"); return; }
    try {
      await saveMeta();
      let s = await ensureSurvey();
      // If the current survey has already been sent, automatically start a new wave
      // so results don't mix with the previous one.
      if (s.sent_at) {
        s = await duplicateSurvey.mutateAsync(s.id);
      }
      const res = await sendSurvey.mutateAsync(s.id);
      if (res.sent === 0 && res.failed === 0) {
        toast.warning("Aucun envoi : tous les participants ont déjà reçu ce sondage. Utilise 'Renvoyer aux nouveaux' depuis les résultats, ou ajoute des participants.");
      } else {
        toast.success(`Sondage envoyé à ${res.sent} participant${res.sent > 1 ? "s" : ""}${res.failed ? ` (${res.failed} échec${res.failed > 1 ? "s" : ""})` : ""}`);
      }
      setOpen(false);
    } catch (e) {
      toastError(useToastFn, e instanceof Error ? e : "Erreur");
    }
  };

  const publicLinkExample = useMemo(() => {
    if (!survey) return null;
    return `${window.location.origin}/sondage-formation/<token>`;
  }, [survey]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={participantCount === 0}>
          <ClipboardList className="h-4 w-4 mr-2" />
          Envoyer un sondage
        </Button>
      </DialogTrigger>
      <DialogContent className="w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardList className="h-5 w-5" />Sondage de formation</DialogTitle>
          <DialogDescription>
            Un lien personnalisé est envoyé à chaque participant. Les apprenants peuvent modifier leurs réponses jusqu'à la clôture.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="content">
          <TabsList>
            <TabsTrigger value="content">Contenu</TabsTrigger>
            <TabsTrigger value="questions">Questions ({localQuestions.length})</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="space-y-4 pt-4">
            <div className="space-y-1">
              <Label>Titre du sondage</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveMeta} />
            </div>
            <div className="space-y-1">
              <Label>Introduction (affichée en haut du sondage, optionnelle)</Label>
              <Textarea value={intro} onChange={(e) => setIntro(e.target.value)} onBlur={saveMeta} rows={3}
                placeholder="Contexte ou consignes pour les apprenants..." />
            </div>
            <div className="space-y-1">
              <Label>Date de clôture (optionnelle)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-[280px] justify-start text-left font-normal", !closesAt && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {closesAt ? format(closesAt, "PPP", { locale: fr }) : "Aucune (sondage ouvert)"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={closesAt} onSelect={(d) => { setClosesAt(d); setTimeout(saveMeta, 0); }} initialFocus className="p-3 pointer-events-auto" />
                  {closesAt && (
                    <div className="border-t p-2 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => { setClosesAt(undefined); setTimeout(saveMeta, 0); }}>Effacer</Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">Un rappel automatique sera envoyé aux non-répondants 2 jours avant la clôture.</p>
            </div>
          </TabsContent>

          <TabsContent value="questions" className="space-y-3 pt-4">
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
                        onUpdate={async (patch) => { try { await upsertQuestion.mutateAsync(patch); } catch (e) { toastError(useToastFn, e instanceof Error ? e : "Erreur"); } }}
                        onDelete={async () => { if (!survey) return; try { await deleteQuestion.mutateAsync({ id: q.id, surveyId: survey.id }); } catch (e) { toastError(useToastFn, e instanceof Error ? e : "Erreur"); } }}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </TabsContent>

          <TabsContent value="email" className="space-y-4 pt-4">
            <div className="space-y-1">
              <Label>Objet de l'email</Label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} onBlur={saveMeta} />
            </div>
            <div className="space-y-1">
              <Label>Corps de l'email</Label>
              <Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} onBlur={saveMeta} rows={8}
                placeholder="Bonjour {{first_name}}, ..." />
              <p className="text-xs text-muted-foreground">
                Variable disponible : <code className="bg-muted px-1 rounded">{"{{first_name}}"}</code>. Le bouton "Répondre au sondage" et la signature sont ajoutés automatiquement.
              </p>
            </div>
            {publicLinkExample && (
              <div className="text-xs text-muted-foreground border rounded-md p-2 bg-muted/30 flex items-center justify-between">
                <span>Format du lien : <code>{publicLinkExample}</code></span>
                <Button variant="ghost" size="sm" onClick={() => copy(publicLinkExample)}>
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 gap-2 flex-wrap sm:justify-between">
          <Button variant="outline" onClick={() => setOpen(false)}>Fermer</Button>
          <Button onClick={handleSend} disabled={sendSurvey.isPending || duplicateSurvey.isPending || localQuestions.length === 0}>
            {(sendSurvey.isPending || duplicateSurvey.isPending) ? <Spinner className="mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            {survey?.sent_at
              ? `Lancer une nouvelle vague (${participantCount})`
              : `Envoyer à ${participantCount} participant${participantCount > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
