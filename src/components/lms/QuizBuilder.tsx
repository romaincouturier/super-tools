import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useCreateQuiz, useQuiz, useQuizQuestions, useCreateQuizQuestion,
  useUpdateLesson, LmsLesson,
} from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, HelpCircle } from "lucide-react";

interface Props {
  lesson: LmsLesson;
  courseId: string;
}

export default function LmsQuizBuilder({ lesson, courseId }: Props) {
  const { toast } = useToast();
  const { data: quiz, isLoading: quizLoading } = useQuiz(lesson.quiz_id || undefined);
  const { data: questions = [] } = useQuizQuestions(lesson.quiz_id || undefined);
  const createQuiz = useCreateQuiz();
  const createQuestion = useCreateQuizQuestion();
  const updateLesson = useUpdateLesson();

  const [newQ, setNewQ] = useState({
    question_type: "mcq",
    question_text: "",
    explanation: "",
    points: 1,
    options: [
      { label: "", is_correct: true, feedback: "" },
      { label: "", is_correct: false, feedback: "" },
    ],
    correct_answer: "",
  });

  // Create quiz if lesson doesn't have one yet
  const handleCreateQuiz = async () => {
    const q = await createQuiz.mutateAsync({
      course_id: courseId,
      title: `Quiz — ${lesson.title}`,
    });
    await updateLesson.mutateAsync({ id: lesson.id, quiz_id: q.id });
    toast({ title: "Quiz créé" });
  };

  const handleAddQuestion = async () => {
    if (!lesson.quiz_id || !newQ.question_text.trim()) return;
    await createQuestion.mutateAsync({
      quiz_id: lesson.quiz_id,
      question_type: newQ.question_type,
      question_text: newQ.question_text,
      explanation: newQ.explanation || null,
      points: newQ.points,
      position: questions.length,
      options: newQ.question_type === "mcq" || newQ.question_type === "true_false"
        ? newQ.options
        : [],
      correct_answer: newQ.question_type === "open" || newQ.question_type === "fill_blank"
        ? newQ.correct_answer
        : null,
    } as any);
    setNewQ({
      question_type: "mcq",
      question_text: "",
      explanation: "",
      points: 1,
      options: [
        { label: "", is_correct: true, feedback: "" },
        { label: "", is_correct: false, feedback: "" },
      ],
      correct_answer: "",
    });
    toast({ title: "Question ajoutée" });
  };

  if (!lesson.quiz_id) {
    return (
      <div className="text-center py-8 space-y-4">
        <HelpCircle className="w-12 h-12 mx-auto text-muted-foreground/50" />
        <p className="text-muted-foreground">Aucun quiz associé à cette leçon</p>
        <Button onClick={handleCreateQuiz} disabled={createQuiz.isPending}>
          <Plus className="w-4 h-4 mr-2" /> Créer un quiz
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Existing questions */}
      <div className="space-y-3">
        <h3 className="font-medium text-sm text-muted-foreground">
          {questions.length} question{questions.length !== 1 ? "s" : ""}
        </h3>
        {questions.map((q, i) => (
          <Card key={q.id}>
            <CardContent className="py-3 space-y-2">
              <div className="flex items-start gap-2">
                <Badge variant="outline" className="text-xs shrink-0">Q{i + 1}</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{q.question_text}</p>
                  {q.options?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {q.options.map((opt, j) => (
                        <div key={j} className={`text-xs px-2 py-1 rounded ${opt.is_correct ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-muted"}`}>
                          {opt.label} {opt.is_correct && "✓"}
                        </div>
                      ))}
                    </div>
                  )}
                  {q.explanation && (
                    <p className="text-xs text-muted-foreground mt-2 italic">💡 {q.explanation}</p>
                  )}
                </div>
                <Badge variant="secondary" className="text-xs">{q.points} pt{q.points > 1 ? "s" : ""}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add question form */}
      <Card className="border-dashed">
        <CardContent className="pt-4 space-y-4">
          <h4 className="font-medium text-sm">Ajouter une question</h4>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Type</Label>
              <Select value={newQ.question_type} onValueChange={(v) => setNewQ({ ...newQ, question_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">QCM</SelectItem>
                  <SelectItem value="true_false">Vrai / Faux</SelectItem>
                  <SelectItem value="open">Réponse libre</SelectItem>
                  <SelectItem value="fill_blank">Texte à trous</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Points</Label>
              <Input type="number" value={newQ.points} onChange={(e) => setNewQ({ ...newQ, points: +e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Question</Label>
            <Textarea
              value={newQ.question_text}
              onChange={(e) => setNewQ({ ...newQ, question_text: e.target.value })}
              placeholder="Posez votre question..."
              rows={2}
            />
          </div>

          {(newQ.question_type === "mcq" || newQ.question_type === "true_false") && (
            <div className="space-y-2">
              <Label>Options</Label>
              {newQ.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox
                    checked={opt.is_correct}
                    onCheckedChange={(v) => {
                      const opts = [...newQ.options];
                      opts[i] = { ...opts[i], is_correct: !!v };
                      setNewQ({ ...newQ, options: opts });
                    }}
                  />
                  <Input
                    value={opt.label}
                    onChange={(e) => {
                      const opts = [...newQ.options];
                      opts[i] = { ...opts[i], label: e.target.value };
                      setNewQ({ ...newQ, options: opts });
                    }}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1"
                  />
                  {newQ.options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setNewQ({ ...newQ, options: newQ.options.filter((_, j) => j !== i) })}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
              {newQ.options.length < 6 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setNewQ({
                      ...newQ,
                      options: [...newQ.options, { label: "", is_correct: false, feedback: "" }],
                    })
                  }
                >
                  <Plus className="w-3 h-3 mr-1" /> Option
                </Button>
              )}
            </div>
          )}

          {(newQ.question_type === "open" || newQ.question_type === "fill_blank") && (
            <div>
              <Label>Réponse attendue</Label>
              <Input
                value={newQ.correct_answer}
                onChange={(e) => setNewQ({ ...newQ, correct_answer: e.target.value })}
                placeholder="Réponse correcte"
              />
            </div>
          )}

          <div>
            <Label>Explication (optionnel)</Label>
            <Input
              value={newQ.explanation}
              onChange={(e) => setNewQ({ ...newQ, explanation: e.target.value })}
              placeholder="Explication affichée après réponse"
            />
          </div>

          <Button onClick={handleAddQuestion} disabled={!newQ.question_text.trim()}>
            <Plus className="w-4 h-4 mr-2" /> Ajouter la question
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
