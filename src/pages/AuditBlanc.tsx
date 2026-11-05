import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Gavel, Play, CheckCircle2, AlertTriangle, XCircle, HelpCircle, ArrowRight } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAuth } from "@/hooks/useAuth";
import { useAuditFacts, type AuditSample } from "@/hooks/useAuditFacts";
import { useAuditRuns } from "@/hooks/useAuditRuns";
import {
  auditPlan,
  evaluateIndicator,
  summarize,
  type AnswerValue,
  type AuditFacts,
  type Verdict,
} from "@/lib/auditChecks";
import { criterionLabel } from "@/lib/auditReferential";

/**
 * Audit blanc : dérouler le référentiel comme un auditeur le ferait.
 *
 * Le guide décrit la conduite d'audit : échantillonnage d'actions, entretien,
 * vérification documentaire, appréciation de l'auditeur. L'écran suit cet
 * ordre. Les contrôles automatiques interrogent les données réelles ; ce
 * qu'aucune donnée ne peut établir est posé comme une question. Un indicateur
 * reste « à vérifier » tant qu'une question n'a pas de réponse : un audit ne
 * conclut pas sur ce qu'il n'a pas regardé.
 */

const VERDICT_STYLE: Record<Verdict, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  conforme: { label: "Conforme", className: "bg-primary/10 text-primary", icon: CheckCircle2 },
  mineure: { label: "NC mineure", className: "bg-amber-500/10 text-amber-700", icon: AlertTriangle },
  majeure: { label: "NC majeure", className: "bg-destructive/10 text-destructive", icon: XCircle },
  a_verifier: { label: "À vérifier", className: "bg-muted text-muted-foreground", icon: HelpCircle },
};

export default function AuditBlanc() {
  useAuth();
  const { gather, loading: gathering } = useAuditFacts();
  const { runs, saveRun, loading: loadingRuns } = useAuditRuns();

  const [facts, setFacts] = useState<AuditFacts | null>(null);
  const [sample, setSample] = useState<AuditSample[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const plans = useMemo(() => auditPlan(), []);

  const findings = useMemo(
    () => (facts ? plans.map((p) => evaluateIndicator(p, facts, answers)) : []),
    [plans, facts, answers],
  );
  const summary = useMemo(() => summarize(findings), [findings]);

  const start = async () => {
    const result = await gather();
    setFacts(result.facts);
    setSample(result.sample);
    setAnswers({});
  };

  const answer = (id: string, value: AnswerValue) =>
    setAnswers((a) => ({ ...a, [id]: a[id] === value ? null : value }));

  const finish = async () => {
    if (!facts) return;
    setSaving(true);
    await saveRun({
      facts,
      answers,
      findings,
      notes,
      sampleTrainingIds: sample.map((s) => s.trainingId),
    });
    setSaving(false);
  };

  const byCriterion = useMemo(() => {
    const groups = new Map<number, typeof plans>();
    for (const p of plans) {
      const list = groups.get(p.indicator.criterion) ?? [];
      list.push(p);
      groups.set(p.indicator.criterion, list);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [plans]);

  return (
    <ModuleLayout>
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <PageHeader
          icon={Gavel}
          title="Audit blanc"
          subtitle="Référentiel national qualité V10 — 22 indicateurs applicables"
          actions={
            <Button onClick={start} disabled={gathering}>
              {gathering ? <Spinner className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              {facts ? "Recommencer" : "Lancer l'audit"}
            </Button>
          }
        />

        {!facts ? (
          <Card>
            <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
              <p>
                L'audit tire un échantillon de sessions récentes, passe les contrôles automatiques
                sur les données réelles, puis vous pose les questions qu'aucune donnée ne peut
                trancher.
              </p>
              <p>
                Les verdicts suivent la gradation du guide : certains indicateurs ne connaissent que
                la non-conformité majeure, un respect partiel y suffit à la déclencher.
              </p>
              {!loadingRuns && runs.length > 0 && (
                <p>
                  Dernier passage : {new Date(runs[0].started_at).toLocaleDateString("fr-FR")}, {" "}
                  {(runs[0].findings as { verdict: Verdict }[]).filter((f) => f.verdict === "majeure").length}{" "}
                  non-conformité(s) majeure(s).
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Synthèse */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Synthèse</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {([
                    ["conforme", summary.conforme],
                    ["mineure", summary.mineure],
                    ["majeure", summary.majeure],
                    ["a_verifier", summary.aVerifier],
                  ] as [Verdict, number][]).map(([v, n]) => (
                    <div key={v} className="text-center border rounded-lg py-3">
                      <p className="text-2xl font-bold">{n}</p>
                      <p className="text-xs text-muted-foreground">{VERDICT_STYLE[v].label}</p>
                    </div>
                  ))}
                </div>
                {summary.aVerifier > 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {summary.aVerifier} indicateur{summary.aVerifier > 1 ? "s" : ""} attend
                    {summary.aVerifier > 1 ? "ent" : ""} encore vos réponses.
                  </p>
                ) : summary.blocking ? (
                  <p className="text-sm text-destructive">
                    {summary.majeure} non-conformité{summary.majeure > 1 ? "s" : ""} majeure
                    {summary.majeure > 1 ? "s" : ""} : la certification ne serait pas délivrée en
                    l'état.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Aucune non-conformité majeure sur ce passage.
                  </p>
                )}

                {sample.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    <span className="font-medium">Échantillon audité : </span>
                    {sample.map((s) => s.trainingName).join(" · ")}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Déroulé par critère */}
            {byCriterion.map(([criterion, group]) => (
              <Card key={criterion}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    Critère {criterion} — {criterionLabel(criterion)}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="w-full">
                    {group.map((plan) => {
                      const finding = findings.find((f) => f.number === plan.indicator.number);
                      if (!finding) return null;
                      const style = VERDICT_STYLE[finding.verdict];
                      return (
                        <AccordionItem key={plan.indicator.number} value={`i${plan.indicator.number}`}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3 text-left flex-1 pr-3">
                              <Badge variant="outline" className="shrink-0">
                                {plan.indicator.number}
                              </Badge>
                              <span className="text-sm flex-1">{plan.indicator.label}</span>
                              <Badge className={`shrink-0 ${style.className}`}>{style.label}</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4">
                            <div className="text-sm">
                              <p className="font-medium">Niveau attendu</p>
                              <p className="text-muted-foreground">{plan.indicator.expected}</p>
                              {plan.indicator.scopeNote && (
                                <p className="text-xs text-muted-foreground mt-1 border-l-2 border-primary pl-2">
                                  {plan.indicator.scopeNote}
                                </p>
                              )}
                            </div>

                            {finding.checks.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Contrôles sur les données</p>
                                {finding.checks.map((c) => {
                                  const def = plan.checks.find((d) => d.id === c.id);
                                  return (
                                    <div
                                      key={c.id}
                                      className="flex items-start justify-between gap-3 text-sm border rounded-md p-2"
                                    >
                                      <div className="min-w-0">
                                        <p>{c.label}</p>
                                        <p className="text-xs text-muted-foreground">{c.detail}</p>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {c.status === "ko" && def?.fix && (
                                          <Button asChild variant="ghost" size="sm">
                                            <Link to={def.fix.href}>
                                              {def.fix.label}
                                              <ArrowRight className="h-3 w-3 ml-1" />
                                            </Link>
                                          </Button>
                                        )}
                                        <Badge
                                          variant={c.status === "ok" ? "outline" : "secondary"}
                                          className={
                                            c.status === "ko" ? "bg-destructive/10 text-destructive" : ""
                                          }
                                        >
                                          {c.status === "ok" ? "OK" : c.status === "ko" ? "En défaut" : "Sans objet"}
                                        </Badge>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {plan.questions.length > 0 && (
                              <div className="space-y-2">
                                <p className="text-sm font-medium">Questions à l'auditeur</p>
                                {plan.questions.map((q) => (
                                  <div key={q.id} className="border rounded-md p-2 space-y-2">
                                    <p className="text-sm">{q.label}</p>
                                    {q.hint && (
                                      <p className="text-xs text-muted-foreground">{q.hint}</p>
                                    )}
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant={answers[q.id] === "oui" ? "default" : "outline"}
                                        onClick={() => answer(q.id, "oui")}
                                      >
                                        Oui
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant={answers[q.id] === "non" ? "destructive" : "outline"}
                                        onClick={() => answer(q.id, "non")}
                                      >
                                        Non
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {plan.indicator.evidence.length > 0 && (
                              <div className="text-xs text-muted-foreground">
                                <p className="font-medium">Preuves citées par le guide</p>
                                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                                  {plan.indicator.evidence.map((e) => (
                                    <li key={e}>{e}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <p className="text-xs text-muted-foreground">{finding.rationale}</p>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </CardContent>
              </Card>
            ))}

            {/* Clôture */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Clôturer le passage</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Observations, points à reprendre, engagements pris..."
                />
                <Button onClick={finish} disabled={saving}>
                  {saving ? <Spinner className="h-4 w-4 mr-2" /> : null}
                  Enregistrer ce passage
                </Button>
                <p className="text-xs text-muted-foreground">
                  Les faits constatés sont figés avec le rapport : relu dans six mois, il dira ce qui
                  était vrai aujourd'hui, pas ce qui le sera alors.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </ModuleLayout>
  );
}
