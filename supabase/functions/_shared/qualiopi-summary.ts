import { auditPlan, automaticAnswers, evaluateIndicator, summarize, type AuditFacts, type AutomaticIssue, type AnswerValue, type AuditAffectedItem } from './qualiopi-checks.ts';

export function auditChanges(current: AutomaticIssue[], previous: AutomaticIssue[]) {
  const before = new Map(previous.map(i => [i.checkId, i]));
  const after = new Map(current.map(i => [i.checkId, i]));
  const added = current.filter(i => !before.has(i.checkId));
  const resolved = previous.filter(i => !after.has(i.checkId));
  const updated = current.filter(i => {
    const old = before.get(i.checkId);
    return old && (old.detail !== i.detail || old.kind !== i.kind || old.gradation !== i.gradation);
  });
  return { added, resolved, updated, changed: added.length + resolved.length + updated.length > 0 };
}

export function auditMailSummary(facts: AuditFacts, answers: Record<string, AnswerValue> = {}) {
  const plans = auditPlan();
  const findings = plans.map(p => evaluateIndicator(p, facts, answers));
  const effective = { ...automaticAnswers(facts), ...answers };
  return {
    ...summarize(findings),
    questions: plans.flatMap(p => p.questions.filter(q => !effective[q.id]).map(q => `Indicateur ${p.indicator.number} : ${q.label}`)),
    findings,
  };
}

export interface AuditAction {
  indicator: number;
  label: string;
  problem: string;
  recommendation: string;
  href: string;
  minutes: number;
  priority: number;
  tasks?: Array<{ problem: string; recommendation: string; href: string; items: AuditAffectedItem[] }>;
}

const destinations: Record<number, string> = {
  1: '/catalogue', 2: '/evaluations', 4: '/besoins', 5: '/evaluations', 6: '/formations', 8: '/besoins',
  9: '/formations', 10: '/formations', 11: '/evaluations', 12: '/signalements', 17: '/formations', 18: '/formations',
  19: '/lms', 21: '/parametres?find=tab%3Atrainers', 22: '/parametres?find=tab%3Atrainers',
  23: '/veille', 24: '/veille', 25: '/veille', 26: '/parametres?find=partenaires_handicap', 30: '/evaluations',
  31: '/reclamations', 32: '/ameliorations',
};
const recommendations: Record<string, [string, number]> = {
  '1.mentions': ['Complète les mentions manquantes des formations actives dans le catalogue.', 15],
  '2.calcul': ['Vérifie les évaluations recueillies et prépare le taux de satisfaction par formation.', 10],
  '2.methode': ['Ajoute la méthode de calcul au texte de diffusion des résultats.', 10],
  '4.recueil': ['Vérifie les dossiers des sessions terminées sans questionnaire reçu ; conserve aussi les comptes rendus de besoin recueillis hors formulaire.', 20],
  '5.evaluables': ['Vérifie les réponses objectif par objectif sur les sessions terminées et joins les évaluations externes si elles existent.', 15],
  '6.programme': ['Rattache le programme ou le parcours à chaque session concernée.', 10],
  '8.prerequis': ['Complète le positionnement manquant et documente séparément la vérification des prérequis applicables.', 15],
  '9.convocation': ['Vérifie les emails de bienvenue/convocation des sessions concernées ; joins une preuve si la convocation a été faite hors application.', 10],
  '9.reglement': ['Publie le règlement intérieur depuis les paramètres généraux.', 10],
  '11.evaluation': ['Vérifie les évaluations de fin manquantes sur les sessions terminées ; conserve une preuve des sollicitations sans réponse.', 15],
  '12.procedure': ['Renseigne une procédure active de prévention des violences.', 30],
  '12.diffusion': ['Vérifie que la procédure active est disponible sur la page d’information des formations.', 10],
  '18.intervenant': ['Rattache le formateur aux sessions concernées.', 5],
  '19.suivi': ['Vérifie les parcours publiés sans leçon obligatoire et documente les ressources proposées ; ne modifie pas les leçons pour satisfaire ce contrôle.', 15],
  '21.competences': ['Renseigne les compétences du formateur dans sa fiche.', 10],
  '21.justificatifs': ['Ajoute un CV ou un justificatif dans la fiche du formateur.', 10],
  '21.adequation': ['Dans chaque fiche formation concernée, ouvre l’adéquation formateur/session et conserve le nom du valideur et la date.', 15],
  '22.formation': ['Dans la fiche formateur, renseigne les formations réellement suivies avec dates et organismes, ou documente les autres démarches de professionnalisation dans l’audit.', 15],
  '23.veille': ['Ajoute les sources et les éléments de veille réellement consultés sur les douze derniers mois.', 15],
  '23.exploitation': ['Choisis une veille légale et documente la décision prise et son résultat ; un commentaire d’intérêt ne suffit pas. Réponds dans l’audit avec la référence de cette preuve.', 20],
  '24.exploitation': ['Documente une décision issue de la veille métiers/compétences et réponds dans l’audit avec sa référence.', 20],
  '25.exploitation': ['Documente une évolution pédagogique issue de la veille et réponds dans l’audit avec sa référence.', 20],
  '26.referent': ['Renseigne le nom et l’email du référent handicap.', 5],
  '26.reseau': ['Ajoute les partenaires handicap réellement mobilisables.', 15],
  '30.beneficiaires': ['Vérifie les appréciations de fin et les preuves de sollicitation sur les sessions terminées.', 15],
  '31.accuse': ['Vérifie les réclamations sans accusé de réception et documente leur prise en charge.', 10],
  '31.reponse': ['Renseigne la réponse et sa date sur les réclamations concernées.', 20],
  '32.risques': ['Complète le registre des risques avec les risques identifiés.', 20],
  '32.mesures': ['Documente les mesures de prévention des risques élevés.', 20],
  '32.ameliorations': ['Renseigne les actions d’amélioration réellement engagées et leur origine.', 20],
};

export function auditEmailModel(facts: AuditFacts, answers: Record<string, AnswerValue> = {}, unchanged = false) {
  const summary = auditMailSummary(facts, answers);
  const plans = auditPlan();
  const effective = { ...automaticAnswers(facts), ...answers };
  const actions: AuditAction[] = summary.findings.flatMap(finding => {
    const plan = plans.find(p => p.indicator.number === finding.number);
    if (!plan) return [];
    const priority = finding.verdict === 'majeure' ? 0 : finding.verdict === 'mineure' ? 1 : finding.checks.some(c => c.status === 'ko') ? 2 : 3;
    const base = { indicator: finding.number, label: plan.indicator.label, priority };
    const failed = finding.checks.filter(c => c.status === 'ko' || finding.blocked.includes(c.id)).map(c => {
      const def = plan.checks.find(d => d.id === c.id);
      const [recommendation, minutes] = recommendations[c.id] ?? [`Vérifie « ${c.label} » et conserve la preuve dans l’audit.`, 15];
      return { ...base, problem: `${c.label} : ${c.detail}`, recommendation, minutes, href: def?.fix?.href ?? destinations[finding.number] ?? '/audit-blanc', tasks: [{ problem: `${c.label} : ${c.detail}`, recommendation, href: def?.fix?.href ?? destinations[finding.number] ?? '/audit-blanc', items: facts.affectedItems?.[c.id] ?? [] }] };
    });
    const manual = plan.questions.filter(q => !effective[q.id] || effective[q.id] === 'non');
    if (manual.length) failed.push({
      ...base,
      problem: effective[manual[0].id] === 'non' ? 'Une réponse manuelle indique un attendu non respecté.' : 'Les preuves disponibles ne permettent pas de vérifier ce point sans ton complément.',
      recommendation: manual.map(q => `Réponds dans l’audit : ${q.label}${q.hint ? ` Preuve : ${q.hint}` : ''}`).join(' '),
      href: `/audit-blanc?indicator=${finding.number}`, minutes: manual.length * 5, tasks: manual.map(q => ({ problem: 'Preuve à confirmer dans cet audit.', recommendation: `Confirme avec une preuve : ${q.label}`, href: `/audit-blanc?indicator=${finding.number}`, items: [] })),
    });
    return failed;
  }).sort((a, b) => a.priority - b.priority || a.indicator - b.indicator);
  const nc = summary.mineure + summary.majeure;
  const globalState = `${summary.conforme} OK / ${summary.aVerifier} à compléter / ${nc} non conforme${nc > 1 ? 's' : ''} (${summary.majeure} majeur${summary.majeure > 1 ? 's' : ''})`;
  const grouped = new Map<number, AuditAction>();
  for (const action of actions) {
    const existing = grouped.get(action.indicator);
    if (!existing) grouped.set(action.indicator, { ...action });
    else {
      existing.tasks = [...(existing.tasks ?? []), ...(action.tasks ?? [])];
      existing.problem += ` ${action.problem}`;
      existing.recommendation += ` ${action.recommendation}`;
      existing.minutes += action.minutes;
    }
  }
  const prioritized = [...grouped.values()];
  return { summary, globalState, changeNote: unchanged ? 'Aucun changement depuis le dernier envoi. Voici les trois actions prioritaires encore à traiter.' : 'Les contrôles portent sur les cinq dernières sessions terminées non annulées. Les preuves non détectables restent à compléter, pas à déclarer absentes.', actions: unchanged ? prioritized.slice(0, 3) : prioritized };
}

export function selectAuditFocus(actions: AuditAction[], previous: number[] = []): number[] {
  const unresolved = previous.filter((n, i) => previous.indexOf(n) === i && actions.some(a => a.indicator === n));
  if (unresolved.length) return unresolved.slice(0, 2);
  return [...actions].sort((a, b) => a.priority - b.priority || a.indicator - b.indicator).slice(0, 2).map(a => a.indicator);
}

export function auditFocusModel(facts: AuditFacts, answers: Record<string, AnswerValue> = {}, previous: number[] = []) {
  const model = auditEmailModel(facts, answers);
  const focus = selectAuditFocus(model.actions, previous);
  return { ...model, focus, actions: focus.flatMap(n => model.actions.filter(a => a.indicator === n)), remaining: model.actions.length };
}

export function renderAuditActions(actions: AuditAction[]) {
  if (!actions.length) return '<p>Aucun indicateur à corriger.</p>';
  return actions.map(a => `<section style="margin-bottom:24px"><p><strong>Indicateur ${a.indicator} — ${escapeAuditHtml(a.label)}</strong></p><p>${escapeAuditHtml(a.problem)}</p>${(a.tasks ?? [{ problem: a.problem, recommendation: a.recommendation, href: a.href, items: [] }]).map(t => `<p>Action : ${escapeAuditHtml(t.recommendation)}</p>${t.items.length ? `<ul>${t.items.map(i => `<li><a href="https://academy.supertilt.fr${escapeAuditHtml(i.href)}">${escapeAuditHtml(i.label)}</a> : ${escapeAuditHtml(i.missing)}</li>`).join('')}</ul>` : `<p><a href="https://academy.supertilt.fr${escapeAuditHtml(t.href)}">${escapeAuditHtml(t.recommendation.startsWith('Confirme') ? 'Confirmer cette preuve dans l’audit' : 'Ouvrir le dossier concerné')}</a></p>`}`).join('')}<p><a href="https://academy.supertilt.fr/audit-blanc?indicator=${a.indicator}#indicator-${a.indicator}">Compléter cet indicateur</a> · Temps estimé : ${a.minutes} min.</p></section>`).join('');
}

export function escapeAuditHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] ?? c));
}

export function shouldSendAuditSummary(changed: boolean, lastSentAt: string | null | undefined, now = new Date()) {
  if (changed || !lastSentAt) return true;
  const day = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  return day(new Date(lastSentAt)) !== day(now);
}