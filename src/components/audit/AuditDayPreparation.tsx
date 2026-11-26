import { ClipboardCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuditEvidencePanel } from "@/components/audit/AuditEvidencePanel";
import type { AuditEvidence } from "@/services/auditEvidence";
import { AUDIT_DAY_QUESTIONS, type AnswerValue } from "@/lib/auditChecks";

export function AuditDayPreparation({ answers, evidenceByQuestion, onAnswer, onValidate, validating }: {
  answers: Record<string, AnswerValue>;
  evidenceByQuestion: Map<string, AuditEvidence[]>;
  onAnswer: (id: string, value: AnswerValue) => void;
  onValidate: (evidence: AuditEvidence) => void;
  validating: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-4 w-4" />Préparation du jour d’audit</CardTitle>
        <p className="text-sm text-muted-foreground">Modalités administratives et humaines, distinctes du verdict des 22 indicateurs.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {AUDIT_DAY_QUESTIONS.map((q) => (
          <div key={q.id} className="border rounded-md p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm">{q.label}</p>
              <Badge variant="outline" className="shrink-0">Hors score</Badge>
            </div>
            {q.hint && <p className="text-xs text-muted-foreground">{q.hint}</p>}
            <AuditEvidencePanel history={evidenceByQuestion.get(q.id) ?? []} onValidate={onValidate} validating={validating} />
            <div className="flex gap-2">
              <Button size="sm" variant={answers[q.id] === "oui" ? "default" : "outline"} onClick={() => onAnswer(q.id, "oui")}>Oui</Button>
              <Button size="sm" variant={answers[q.id] === "non" ? "destructive" : "outline"} onClick={() => onAnswer(q.id, "non")}>Non</Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
