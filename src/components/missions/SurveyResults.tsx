import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Survey, SurveyQuestion, SurveyResponse, SurveyAnswer } from "@/hooks/useMissionSurvey";

type ResponseWithAnswers = SurveyResponse & { mission_survey_answers: SurveyAnswer[] };

const CHART_COLORS = ["#6366f1", "#22d3ee", "#f59e0b", "#10b981", "#f43f5e", "#a78bfa", "#fb923c"];

function QuestionResults({ question, responses }: { question: SurveyQuestion; responses: ResponseWithAnswers[] }) {
  const answers = responses.flatMap((r) =>
    r.mission_survey_answers.filter((a) => a.question_id === question.id)
  );

  if (answers.length === 0) {
    return <p className="text-sm text-muted-foreground italic">Aucune réponse</p>;
  }

  if (question.type === "text" || question.type === "textarea") {
    return (
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {answers.map((a, i) => (
          <div key={i} className="text-sm bg-muted/50 rounded px-3 py-2">{a.value || "—"}</div>
        ))}
      </div>
    );
  }

  if (question.type === "date") {
    return (
      <div className="space-y-1">
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
      label: String(i === 0 && question.type === "nps" ? 0 : i),
      count: nums.filter((n) => n === (question.type === "nps" ? i : i)).length,
    })).filter((d, i) => question.type !== "nps" || i > 0);

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

  // single_choice / multiple_choice
  const counts: Record<string, number> = {};
  answers.forEach((a) => {
    const vals = a.values ?? (a.value ? [a.value] : []);
    vals.forEach((v) => { counts[v] = (counts[v] ?? 0) + 1; });
  });
  const chartData = Object.entries(counts).map(([name, value]) => ({ name, value }));
  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex gap-6 items-start">
      <ResponsiveContainer width={180} height={180}>
        <PieChart>
          <Pie data={chartData} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={false}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v: number) => [`${v} (${Math.round((v / total) * 100)}%)`, ""]} />
        </PieChart>
      </ResponsiveContainer>
      <div className="space-y-1 mt-4">
        {chartData.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span>{d.name}</span>
            <span className="text-muted-foreground">({d.value})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function exportCsv(questions: SurveyQuestion[], responses: ResponseWithAnswers[]) {
  const headers = ["Répondu le", "Nom", "Email", ...questions.map((q) => q.label)];
  const rows = responses.map((r) => {
    const base = [
      new Date(r.submitted_at).toLocaleDateString("fr-FR"),
      r.respondent_name ?? "",
      r.respondent_email ?? "",
    ];
    const answerCols = questions.map((q) => {
      const a = r.mission_survey_answers.find((ans) => ans.question_id === q.id);
      if (!a) return "";
      if (a.values) return a.values.join(", ");
      return a.value ?? "";
    });
    return [...base, ...answerCols];
  });

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sondage-resultats.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function SurveyResults({
  survey: _survey,
  questions,
  responses,
}: {
  survey: Survey;
  questions: SurveyQuestion[];
  responses: ResponseWithAnswers[];
}) {
  if (responses.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground text-sm">
        Aucune réponse reçue pour l'instant.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{responses.length} réponse(s)</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => exportCsv(questions, responses)}>
          <Download className="h-4 w-4 mr-2" /> Exporter CSV
        </Button>
      </div>

      {questions.map((q) => (
        <Card key={q.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{q.label || "Question sans titre"}</CardTitle>
          </CardHeader>
          <CardContent>
            <QuestionResults question={q} responses={responses} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
