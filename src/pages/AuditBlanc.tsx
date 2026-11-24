import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useAuditFacts, type AuditSample } from "@/hooks/useAuditFacts";
import { useAuditRuns } from "@/hooks/useAuditRuns";
import { useAuditEvidence } from "@/hooks/useAuditEvidence";
import { AuditEvidencePanel } from "@/components/audit/AuditEvidencePanel";
import { evidenceStatus, latestEvidence, mergeEvidenceAnswers } from "../../supabase/functions/_shared/audit-evidence";
import {
  auditPlan,
  evaluateIndicator,
  summarize,
  automaticAnswers,
  type AnswerValue,
  type AuditFacts,
  type Verdict,
} from "@/lib/auditChecks";
import { criterionLabel } from "@/lib/auditReferential";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskText } from "@/lib/demoMask";
import { auditEmailModel, auditFocusModel } from "../../supabase/functions/_shared/qualiopi-summary";

/**
 * Un passage manuel stocke des verdicts, un passage automatique des constats
 * en défaut : la nuit ne répond pas aux questions de l'auditeur et ne conclut
 * donc pas. Les deux formes se lisent différemment.
 */
function describeRun(findings: unknown): string {
  const rows = Array.isArray(findings) ? findings : [];
  const withVerdict = rows.filter((r) => r && typeof r === "object" && "verdict" in r);
  if (withVerdict.length > 0) {
    const majeures = withVerdict.filter((r) => (r as { verdict: Verdict }).verdict === "majeure").length;
    return `${majeures} non-conformité${majeures > 1 ? "s" : ""} majeure${majeures > 1 ? "s" : ""}`;
  }
  return `${rows.length} constat${rows.length > 1 ? "s" : ""} automatique${rows.length > 1 ? "s" : ""} en défaut`;
}

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
  const [searchParams] = useSearchParams();
  const requestedIndicator = searchParams.get('indicator');
  const { user } = useAuth();
  const { gather, loading: gathering } = useAuditFacts();
  const { runs, saveRun, loading: loadingRuns } = useAuditRuns();
  const { evidence, loading: loadingEvidence, recordHuman } = useAuditEvidence();
  const { isDemoMode } = useDemoMode();
  const { toast } = useToast();

  const [facts, setFacts] = useState<AuditFacts | null>(null);
  const [sample, setSample] = useState<AuditSample[]>([]);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (loadingRuns || loadingEvidence || initialized) return;
    const latest = runs[0];
    if (latest?.facts && typeof latest.facts === 'object' && 'sampleSize' in latest.facts) {
      const stored = latest.facts as AuditFacts;
      setFacts(stored);
      setSample(stored.sample ?? []);
      setAnswers(mergeEvidenceAnswers({ ...automaticAnswers(stored), ...(latest.answers as Record<string, AnswerValue> ?? {}) }, evidence));
      if (!stored.affectedItems) {
        gather().then(result => {
          const sameSample = JSON.stringify([...latest.sample_training_ids].sort()) === JSON.stringify(result.sample.map(s => s.trainingId).sort());
          if (sameSample) {
            setFacts(current => current ? { ...current, affectedItems: result.facts.affectedItems } : current);
            setSample(result.sample);
          }
        }).catch(error => toastError(toast, error instanceof Error ? error.message : 'Détails des dossiers indisponibles'));
      }
    }
    setInitialized(true);
  }, [runs, loadingRuns, loadingEvidence, evidence, initialized, gather, toast]);

  const plans = useMemo(() => auditPlan(), []);

  const findings = useMemo(
    () => (facts ? plans.map((p) => evaluateIndicator(p, facts, answers)) : []),
    [plans, facts, answers],
  );
  const summary = useMemo(() => summarize(findings), [findings]);
  const focusModel = useMemo(() => facts ? auditFocusModel(facts, answers, facts.auditFocus ?? []) : null, [facts, answers]);
  const focus = focusModel?.actions ?? [];
  const actions = useMemo(() => facts ? auditEmailModel(facts, answers).actions : [], [facts, answers]);

  useEffect(() => {
    if (!facts || !requestedIndicator) return;
    const frame = requestAnimationFrame(() => document.getElementById(`indicator-${requestedIndicator}`)?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [facts, requestedIndicator]);
  // Un verdict suspendu faute de matière ne se corrige pas en répondant à une
  // question : il se distingue de celui qui attend l'auditeur.
  const blockedCount = useMemo(() => findings.filter((f) => f.blocked.length > 0).length, [findings]);

  const start = async () => {
    try {
      const result = await gather();
      setFacts({ ...result.facts, auditFocus: facts?.auditFocus ?? focus.map(a => a.indicator) });
      setSample(result.sample);
      setAnswers(mergeEvidenceAnswers(automaticAnswers(result.facts), evidence));
    } catch (error: unknown) {
      // Sans ce garde, un échec de lecture laissait l'écran muet : le bouton
      // s'arrêtait de tourner et rien ne se passait.
      console.error("Error gathering audit facts:", error);
      toastError(toast, error instanceof Error ? error.message : "Audit impossible");
    }
  };

  const answer = (id: string, value: AnswerValue) =>
    setAnswers((a) => ({ ...a, [id]: a[id] === value ? null : value }));

  const evidenceByQuestion = useMemo(() => {
    const map = new Map<string, typeof evidence>();
    for (const e of evidence) map.set(e.question_id, [...(map.get(e.question_id) ?? []), e]);
    return map;
  }, [evidence]);

  const finish = async () => {
    if (!facts) return;
    setSaving(true);
    // Une réponse humaine devient une preuve datée, sauf si elle confirme déjà la dernière preuve valide.
    const auto = automaticAnswers(facts);
    const latest = latestEvidence(evidence);
    const humanRows = plans.flatMap((p) => p.questions
      .filter((q) => (answers[q.id] === "oui" || answers[q.id] === "non") && !(q.id in auto))
      .filter((q) => { const l = latest.get(q.id); return !l || evidenceStatus(l) !== "valide" || l.answer !== answers[q.id]; })
      .map((q) => ({ question_id: q.id, indicator: p.indicator.number, answer: answers[q.id] as "oui" | "non",
        summary: notes.trim() || "Réponse confirmée dans l'audit blanc.", sourceLabel: user?.email ?? "Saisie humaine" })));
    if (user && humanRows.length > 0) {
      try { await recordHuman(humanRows, user.id); }
      catch (error) { toastError(toast, error instanceof Error ? error.message : "Enregistrement des preuves impossible"); }
    }
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
              {facts ? "Relancer l’audit" : "Lancer l'audit"}
            </Button>
          }
        />

        {loadingRuns ? <Spinner className="h-6 w-6" /> : !facts ? (
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
                  Dernier passage : {new Date(runs[0].started_at).toLocaleDateString("fr-FR")},{" "}
                  {describeRun(runs[0].findings)}.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <>
            <section className="space-y-4 border-b border-border pb-6" aria-label="Focus du jour">
              <h2 className="text-xl font-semibold">Focus du jour</h2>
              <p className="text-sm text-muted-foreground">Dernier résultat : {runs[0] ? new Date(runs[0].started_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : 'passage manuel'}</p>
              {focus.length ? focus.map(action => (
                <article key={action.indicator} className="border-l-2 border-primary pl-4 space-y-3">
                  <h3 className="font-semibold">Indicateur {action.indicator} — {action.label}</h3>
                  <p className="text-sm">{action.problem}</p>
                  {action.tasks?.map((task, index) => (
                    <div key={index} className="space-y-2 text-sm">
                      <p><strong>Action : </strong>{task.recommendation}</p>
                      {task.items.length ? <ul className="space-y-2">{task.items.map((item, i) => <li key={`${item.href}-${i}`}><Link className="text-primary underline" to={item.href}>{isDemoMode ? maskText(item.label) : item.label}</Link><p className="text-muted-foreground">{item.missing}</p></li>)}</ul> : <Link className="text-primary underline" to={task.href}>Ouvrir le dossier concerné</Link>}
                    </div>
                  ))}
                  <Button asChild variant="outline" size="sm"><Link to={`/audit-blanc?indicator=${action.indicator}#indicator-${action.indicator}`}>Compléter cet indicateur<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                </article>
              )) : <p className="text-sm">Aucun contrôle restant à documenter sur ce passage.</p>}
            </section>
            {Boolean(focusModel?.corrections.length) && (
              <section className="space-y-4 border-b border-border pb-6" aria-label="Corrections ouvertes">
                <h2 className="text-xl font-semibold">Corrections ouvertes</h2>
                {focusModel?.corrections.map(action => (
                  <article key={action.indicator} className="border-l-2 border-destructive pl-4 space-y-2">
                    <h3 className="font-semibold">Indicateur {action.indicator} — {action.label}</h3>
                    {action.tasks?.map((task, index) => <p key={index} className="text-sm">{task.recommendation}</p>)}
                    <Button asChild variant="outline" size="sm"><Link to={`/audit-blanc?indicator=${action.indicator}#indicator-${action.indicator}`}>Revoir les corrections<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
                  </article>
                ))}
              </section>
            )}
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
                    {summary.aVerifier} indicateur{summary.aVerifier > 1 ? "s" : ""} sans verdict
                    {blockedCount > 0
                      ? `, dont ${blockedCount} faute de matière à contrôler`
                      : ""}
                    .
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
                    {sample.map((s) => (isDemoMode ? maskText(s.trainingName) : s.trainingName)).join(" · ")}
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
                  <Accordion key={requestedIndicator ?? 'all'} type="multiple" defaultValue={requestedIndicator ? [`i${requestedIndicator}`] : []} className="w-full">
                    {group.map((plan) => {
                      const finding = findings.find((f) => f.number === plan.indicator.number);
                      if (!finding) return null;
                      const style = VERDICT_STYLE[finding.verdict];
                      return (
                        <AccordionItem id={`indicator-${plan.indicator.number}`} key={plan.indicator.number} value={`i${plan.indicator.number}`}>
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
                                      className="flex flex-col gap-3 text-sm border border-border rounded-md p-3"
                                    >
                                      <div className="min-w-0">
                                        <p>{c.label}</p>
                                        <p className="text-xs text-muted-foreground">{c.detail}</p>
                                        {(c.status === 'ko' || finding.blocked.includes(c.id)) && (
                                          <div className="mt-2 space-y-2">
                                            {facts.affectedItems?.[c.id]?.map((item, index) => <div key={`${item.href}-${index}`}><Link className="text-primary underline" to={item.href}>{isDemoMode ? maskText(item.label) : item.label}</Link><p>{item.missing}</p></div>)}
                                            <p className="text-muted-foreground">{actions.find(a => a.indicator === finding.number)?.tasks?.find(t => t.problem === `${c.label} : ${c.detail}`)?.recommendation}</p>
                                          </div>
                                        )}
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
                                <p className="text-sm font-medium">Ce que l’auditeur vous demandera : confirmez avec vos preuves</p>
                                {plan.questions.map((q) => (
                                  <div key={q.id} className="border rounded-md p-2 space-y-2">
                                    <p className="text-sm">{q.label}</p>
                                    {q.hint && (
                                      <p className="text-xs text-muted-foreground">{q.hint}</p>
                                    )}
                                    <AuditEvidencePanel history={evidenceByQuestion.get(q.id) ?? []} />
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
