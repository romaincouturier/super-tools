import { useState } from "react";
import { BarChart3, ChevronDown, ChevronUp, Download, Send } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";
import {
  useTrainingSurveysList, useTrainingSurveyQuestions, useTrainingSurveyResponses,
  useTrainingSurveyRecipients, useSendTrainingSurvey,
  type TrainingSurvey, type TrainingSurveyQuestion, type TrainingSurveyResponseRow,
} from "@/hooks/useTrainingSurveys";

const CHART_COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a78bfa", "#fb923c"];

function QuestionResults({ question, responses }: { question: TrainingSurveyQuestion; responses: TrainingSurveyResponseRow[] }) {
  const answers = responses.flatMap((r) => r.training_survey_answers.filter((a) => a.question_id === question.id));
  if (answers.length === 0) return <p className="text-sm text-muted-foreground italic">Aucune réponse</p>;

  if (question.type === "text" || question.type === "textarea" || question.type === "date") {
    return (
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {answers.map((a, i) => (
          <div key={i} className="text-sm bg-muted/50 rounded px-3 py-2">{a.value || "—"}</div>
        ))}
      </div>
    );
  }
  if (question.type === "rating" || question.type === "nps") {
    const max = question.type === "nps" ? 10 : 5;
    const nums = answers.map((a) => Number(a.value)).filter((n) => !isNaN(n));
    const avg = nums.length > 0 ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
    const distribution = Array.from({ length: max + 1 }, (_, i) => ({
      label: String(i), count: nums.filter((n) => n === i).length,
    })).filter((_, i) => question.type !== "nps" || i > 0);
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl font-bold">{avg.toFixed(1)}</span>
          <span className="text-sm text-muted-foreground">/ {max} · {nums.length} réponse(s)</span>
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={distribution}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
  const counts: Record<string, number> = {};
  answers.forEach((a) => {
    const vals = a.values ?? (a.value ? [a.value] : []);
    vals.forEach((v) => { counts[v] = (counts[v] ?? 0) + 1; });
  });
  const chartData = Object.entries(counts).map(([name, value]) => ({ name, value }));
  const total = chartData.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex gap-6 items-start flex-wrap">
      <ResponsiveContainer width={180} height={180}>
        <PieChart>
          <Pie data={chartData} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={false}>
            {chartData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={(v: number) => [`${v} (${Math.round((v / total) * 100)}%)`, ""]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1 mt-4">
        {chartData.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span>{d.name}</span><span className="text-muted-foreground">({d.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function exportCsv(questions: TrainingSurveyQuestion[], responses: TrainingSurveyResponseRow[], filename: string) {
  const headers = ["Répondu le", "Nom", "Email", ...questions.map((q) => q.label || "Question")];
  const rows = responses.map((r) => {
    const base = [
      new Date(r.submitted_at).toLocaleString("fr-FR"),
      r.respondent_name ?? "",
      r.respondent_email ?? "",
    ];
    const answerCols = questions.map((q) => {
      const a = r.training_survey_answers.find((ans) => ans.question_id === q.id);
      if (!a) return "";
      if (a.values && a.values.length) return a.values.join(", ");
      return a.value ?? "";
    });
    return [...base, ...answerCols];
  });
  const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function SurveyResultsCard({ survey, waveLabel, defaultOpen }: { survey: TrainingSurvey; waveLabel: string; defaultOpen: boolean }) {
  const { data: questions = [] } = useTrainingSurveyQuestions(survey.id);
  const { data: responses = [] } = useTrainingSurveyResponses(survey.id);
  const { data: recipients = [] } = useTrainingSurveyRecipients(survey.id);
  const sendSurvey = useSendTrainingSurvey();
  const [open, setOpen] = useState(defaultOpen);

  const sentCount = recipients.filter((r: any) => r.sent_at).length;
  const responseRate = sentCount > 0 ? Math.round((responses.length / sentCount) * 100) : 0;
  const isClosed = !!survey.closes_at && new Date(survey.closes_at) < new Date();

  const handleResend = async () => {
    try {
      const res = await sendSurvey.mutateAsync(survey.id);
      toast.success(`Envoi terminé : ${res.sent} envoi(s), ${res.failed} échec(s)`);
    } catch (e: any) {
      toast.error(e?.message || "Erreur");
    }
  };

  return (
    <Card>
      <CardHeader className="px-3 md:px-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 flex-wrap">
              <BarChart3 className="h-5 w-5" />
              <span>{waveLabel}</span>
              {isClosed && <Badge variant="outline" className="text-xs">Clôturé</Badge>}
            </CardTitle>
            <CardDescription>
              {survey.title}
              {survey.sent_at && <> · envoyé le {format(parseISO(survey.sent_at), "d MMM yyyy 'à' HH:mm", { locale: fr })}</>}
              {survey.closes_at && <> · clôture {format(parseISO(survey.closes_at), "d MMM yyyy", { locale: fr })}</>}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!isClosed && (
              <Button variant="outline" size="sm" onClick={handleResend} disabled={sendSurvey.isPending}>
                {sendSurvey.isPending ? <Spinner className="mr-2" /> : <Send className="h-3.5 w-3.5 mr-2" />}
                Renvoyer aux nouveaux
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)}>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-3 pt-2 text-sm">
          <Badge variant="secondary">{responses.length} réponse(s)</Badge>
          <Badge variant="outline">{sentCount} envoyé(s)</Badge>
          <Badge variant="outline">Taux : {responseRate}%</Badge>
          <Badge variant="outline">{questions.length} question(s)</Badge>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4 px-3 md:px-6">
          {responses.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">Aucune réponse reçue pour l'instant.</div>
          ) : (
            <>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => exportCsv(questions, responses, `sondage-${waveLabel.toLowerCase().replace(/\s+/g, "-")}.csv`)}>
                  <Download className="h-4 w-4 mr-2" />Exporter CSV
                </Button>
              </div>
              {questions.map((q) => (
                <Card key={q.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">{q.label || "Question sans titre"}</CardTitle>
                  </CardHeader>
                  <CardContent><QuestionResults question={q} responses={responses} /></CardContent>
                </Card>
              ))}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function TrainingSurveyResults({ trainingId }: { trainingId: string }) {
  const { data: surveys = [] } = useTrainingSurveysList(trainingId);
  if (surveys.length === 0) return null;
  const total = surveys.length;
  return (
    <div className="space-y-4">
      {surveys.map((s, idx) => (
        <SurveyResultsCard
          key={s.id}
          survey={s}
          waveLabel={total > 1 ? `Sondage — Vague ${total - idx}` : "Sondage de formation"}
          defaultOpen={idx === 0}
        />
      ))}
    </div>
  );
}
