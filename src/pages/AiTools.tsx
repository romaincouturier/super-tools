import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ModuleLayout from "@/components/ModuleLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Sparkles, BookOpen, ClipboardCheck, Activity,
  CheckCircle2, AlertTriangle, TrendingUp, Target,
  ArrowRight, Download, Copy, Brain, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgramModule {
  title: string;
  duration_minutes: number;
  content: string[];
  activities: string[];
}

interface GeneratedProgram {
  program_title: string;
  objectives: string[];
  prerequisites: string[];
  target_audience: string;
  pedagogical_methods: string[];
  evaluation_methods: string[];
  modules: ProgramModule[];
  materials_needed: string[];
  accessibility_info: string;
}

interface QuizQuestion {
  id: number;
  type: string;
  question: string;
  options: string[] | null;
  correct_answer: string;
  explanation: string;
  difficulty: string;
  linked_objective: string;
}

interface HealthReport {
  health_score: number;
  health_label: string;
  summary: string;
  dropout_risks: { description: string; severity: string; action: string }[];
  recommendations: { title: string; description: string; priority: string; category: string }[];
  strengths: string[];
  kpis: { completion_rate: number; satisfaction_score: number; conversion_rate: number; pipeline_value: number };
}

export default function AiTools() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  // Program generator state
  const [programTitle, setProgramTitle] = useState("");
  const [programObjectives, setProgramObjectives] = useState("");
  const [programSector, setProgramSector] = useState("");
  const [programDuration, setProgramDuration] = useState("7");
  const [generatingProgram, setGeneratingProgram] = useState(false);
  const [generatedProgram, setGeneratedProgram] = useState<GeneratedProgram | null>(null);

  // Quiz generator state
  const [quizContent, setQuizContent] = useState("");
  const [quizNumQuestions, setQuizNumQuestions] = useState("10");
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const [generatedQuiz, setGeneratedQuiz] = useState<{ quiz_title: string; questions: QuizQuestion[] } | null>(null);

  // Health score state
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);

  const handleGenerateProgram = async () => {
    if (!programTitle.trim()) {
      toast({ title: "Veuillez saisir un titre", variant: "destructive" });
      return;
    }
    setGeneratingProgram(true);
    setGeneratedProgram(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-training-program", {
        body: { title: programTitle, objectives: programObjectives, sector: programSector, duration_hours: parseInt(programDuration) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGeneratedProgram(data.program);
      toast({ title: "Programme généré ✨" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingProgram(false);
    }
  };

  const handleGenerateQuiz = async () => {
    const content = quizContent.trim() || (generatedProgram ? JSON.stringify(generatedProgram) : "");
    if (!content) {
      toast({ title: "Générez d'abord un programme ou collez du contenu", variant: "destructive" });
      return;
    }
    setGeneratingQuiz(true);
    setGeneratedQuiz(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: { program_content: content, num_questions: parseInt(quizNumQuestions) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setGeneratedQuiz(data.quiz);
      toast({ title: "Quiz généré ✨" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const handleHealthScore = async () => {
    setLoadingHealth(true);
    setHealthReport(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("business-health-score", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setHealthReport(data.report);
      toast({ title: "Analyse terminée ✨" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setLoadingHealth(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copié !" });
  };

  const healthColor = (label: string) => {
    switch (label) {
      case "excellent": return "text-emerald-600";
      case "bon": return "text-primary";
      case "attention": return "text-amber-600";
      case "critique": return "text-destructive";
      default: return "text-muted-foreground";
    }
  };

  const priorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "border-destructive/30 bg-destructive/5";
      case "medium": return "border-amber-500/30 bg-amber-500/5";
      default: return "border-border";
    }
  };

  if (authLoading) return null;

  return (
    <ModuleLayout module="ia_tools" title="IA Augmentée" description="Générez des programmes, quiz et analysez votre activité">
      <Tabs defaultValue="program" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="program" className="gap-2">
            <BookOpen className="w-4 h-4" /> Programme
          </TabsTrigger>
          <TabsTrigger value="quiz" className="gap-2">
            <ClipboardCheck className="w-4 h-4" /> Quiz
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-2">
            <Activity className="w-4 h-4" /> Santé Business
          </TabsTrigger>
        </TabsList>

        {/* ═══ TAB 1: Program Generator ═══ */}
        <TabsContent value="program" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Générateur de programme
              </CardTitle>
              <CardDescription>
                Créez un programme complet conforme Qualiopi à partir d'un titre et d'objectifs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Titre de la formation *</Label>
                  <Input value={programTitle} onChange={e => setProgramTitle(e.target.value)} placeholder="Ex: Management d'équipe hybride" />
                </div>
                <div className="space-y-2">
                  <Label>Secteur</Label>
                  <Input value={programSector} onChange={e => setProgramSector(e.target.value)} placeholder="Ex: Management, Tech, Langues..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Objectifs pédagogiques (optionnel)</Label>
                <Textarea value={programObjectives} onChange={e => setProgramObjectives(e.target.value)} placeholder="Listez les objectifs séparés par des virgules ou des retours à la ligne..." rows={3} />
              </div>
              <div className="space-y-2 max-w-32">
                <Label>Durée (heures)</Label>
                <Input type="number" value={programDuration} onChange={e => setProgramDuration(e.target.value)} min="1" max="100" />
              </div>
              <Button onClick={handleGenerateProgram} disabled={generatingProgram || !programTitle.trim()} className="gap-2">
                {generatingProgram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                {generatingProgram ? "Génération en cours..." : "Générer le programme"}
              </Button>
            </CardContent>
          </Card>

          {generatedProgram && (
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{generatedProgram.program_title}</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(JSON.stringify(generatedProgram, null, 2))}>
                    <Copy className="w-4 h-4 mr-1" /> Copier JSON
                  </Button>
                </div>
                <CardDescription>{generatedProgram.target_audience}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-2 flex items-center gap-2"><Target className="w-4 h-4" /> Objectifs</h4>
                  <ul className="space-y-1">
                    {generatedProgram.objectives.map((obj, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-primary mt-0.5 shrink-0" />{obj}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Prérequis</h4>
                  <div className="flex flex-wrap gap-2">
                    {generatedProgram.prerequisites.map((p, i) => <Badge key={i} variant="outline">{p}</Badge>)}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Modules</h4>
                  <div className="space-y-3">
                    {generatedProgram.modules.map((mod, i) => (
                      <div key={i} className="p-4 rounded-lg border">
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium">{mod.title}</h5>
                          <Badge variant="secondary">{mod.duration_minutes} min</Badge>
                        </div>
                        <ul className="text-sm text-muted-foreground space-y-1 mb-2">
                          {mod.content.map((c, j) => <li key={j}>• {c}</li>)}
                        </ul>
                        {mod.activities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {mod.activities.map((a, j) => <Badge key={j} variant="outline" className="text-xs">{a}</Badge>)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Méthodes pédagogiques</h4>
                    <ul className="text-sm space-y-1">{generatedProgram.pedagogical_methods.map((m, i) => <li key={i}>• {m}</li>)}</ul>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Méthodes d'évaluation</h4>
                    <ul className="text-sm space-y-1">{generatedProgram.evaluation_methods.map((m, i) => <li key={i}>• {m}</li>)}</ul>
                  </div>
                </div>
                <Button variant="outline" className="gap-2" onClick={() => { setQuizContent(JSON.stringify(generatedProgram)); }}>
                  <ArrowRight className="w-4 h-4" /> Générer un quiz à partir de ce programme
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ TAB 2: Quiz Generator ═══ */}
        <TabsContent value="quiz" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Générateur de quiz
              </CardTitle>
              <CardDescription>
                Créez automatiquement un quiz d'évaluation à partir du programme
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Contenu du programme {generatedProgram && <span className="text-xs text-muted-foreground">(pré-rempli depuis le programme généré)</span>}</Label>
                <Textarea
                  value={quizContent}
                  onChange={e => setQuizContent(e.target.value)}
                  placeholder="Collez le contenu du programme ou les objectifs pédagogiques..."
                  rows={4}
                />
              </div>
              <div className="space-y-2 max-w-32">
                <Label>Nombre de questions</Label>
                <Input type="number" value={quizNumQuestions} onChange={e => setQuizNumQuestions(e.target.value)} min="3" max="30" />
              </div>
              <Button onClick={handleGenerateQuiz} disabled={generatingQuiz} className="gap-2">
                {generatingQuiz ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                {generatingQuiz ? "Génération..." : "Générer le quiz"}
              </Button>
            </CardContent>
          </Card>

          {generatedQuiz && (
            <Card className="border-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{generatedQuiz.quiz_title}</CardTitle>
                  <Button variant="outline" size="sm" onClick={() => copyToClipboard(JSON.stringify(generatedQuiz, null, 2))}>
                    <Copy className="w-4 h-4 mr-1" /> Copier
                  </Button>
                </div>
                <CardDescription>{generatedQuiz.questions.length} questions générées</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {generatedQuiz.questions.map((q) => (
                  <div key={q.id} className="p-4 rounded-lg border space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{q.type === "qcm" ? "QCM" : q.type === "vrai_faux" ? "Vrai/Faux" : "Ouverte"}</Badge>
                      <Badge variant="secondary">{q.difficulty}</Badge>
                    </div>
                    <p className="font-medium">{q.id}. {q.question}</p>
                    {q.options && (
                      <div className="grid grid-cols-2 gap-2">
                        {q.options.map((opt, i) => (
                          <div key={i} className={cn("p-2 rounded border text-sm", opt === q.correct_answer ? "border-primary bg-primary/5 font-medium" : "")}>
                            {opt} {opt === q.correct_answer && <CheckCircle2 className="w-3 h-3 inline text-primary" />}
                          </div>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-muted-foreground">💡 {q.explanation}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ TAB 3: Business Health ═══ */}
        <TabsContent value="health" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                Score de santé business
              </CardTitle>
              <CardDescription>
                Analyse IA de vos métriques avec recommandations actionnables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleHealthScore} disabled={loadingHealth} className="gap-2">
                {loadingHealth ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                {loadingHealth ? "Analyse en cours..." : "Lancer l'analyse"}
              </Button>
            </CardContent>
          </Card>

          {healthReport && (
            <>
              {/* Score card */}
              <Card className="border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-6">
                    <div className="relative w-24 h-24">
                      <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
                        <circle
                          cx="50" cy="50" r="45" fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth="8"
                          strokeDasharray={`${healthReport.health_score * 2.83} 283`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <span className={cn("absolute inset-0 flex items-center justify-center text-2xl font-bold", healthColor(healthReport.health_label))}>
                        {healthReport.health_score}
                      </span>
                    </div>
                    <div>
                      <h3 className={cn("text-xl font-bold capitalize", healthColor(healthReport.health_label))}>
                        {healthReport.health_label}
                      </h3>
                      <p className="text-muted-foreground mt-1">{healthReport.summary}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Taux complétion", value: `${healthReport.kpis.completion_rate}%`, icon: CheckCircle2 },
                  { label: "Satisfaction", value: `${healthReport.kpis.satisfaction_score}/5`, icon: TrendingUp },
                  { label: "Conversion CRM", value: `${healthReport.kpis.conversion_rate}%`, icon: Target },
                  { label: "Pipeline", value: `${healthReport.kpis.pipeline_value}€`, icon: Activity },
                ].map((kpi, i) => (
                  <Card key={i}>
                    <CardContent className="pt-4 pb-4 text-center">
                      <kpi.icon className="w-5 h-5 text-primary mx-auto mb-1" />
                      <p className="text-2xl font-bold">{kpi.value}</p>
                      <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Risks */}
              {healthReport.dropout_risks.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" /> Risques de décrochage
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {healthReport.dropout_risks.map((risk, i) => (
                      <div key={i} className={cn("p-3 rounded-lg border", priorityColor(risk.severity))}>
                        <p className="font-medium text-sm">{risk.description}</p>
                        <p className="text-xs text-muted-foreground mt-1">→ {risk.action}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" /> Recommandations
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {healthReport.recommendations.map((rec, i) => (
                    <div key={i} className={cn("p-3 rounded-lg border", priorityColor(rec.priority))}>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">{rec.category}</Badge>
                        <Badge variant={rec.priority === "high" ? "destructive" : "secondary"} className="text-xs">{rec.priority}</Badge>
                      </div>
                      <p className="font-medium text-sm">{rec.title}</p>
                      <p className="text-xs text-muted-foreground mt-1">{rec.description}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Strengths */}
              {healthReport.strengths.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Points forts
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {healthReport.strengths.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" /> {s}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </ModuleLayout>
  );
}
