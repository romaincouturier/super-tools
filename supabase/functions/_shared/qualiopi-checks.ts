/**
 * Moteur de l'audit blanc : des faits vers un verdict.
 *
 * Chaque indicateur porte des **contrôles automatiques**, qui interrogent des
 * données réelles, et des **questions à l'auditeur**, pour ce qu'aucune donnée
 * ne peut établir. Un contrôle ne rend jamais « conforme » tout seul : il rend
 * un fait, et c'est la règle de gradation du guide qui en tire un verdict.
 *
 * La règle, citée du guide : « Les non-conformités mineures sont relevées en
 * cas de respect partiel de l'attendu afférent à l'indicateur tandis que des
 * non-conformités majeures peuvent être prononcées lorsque l'attendu n'est pas
 * du tout respecté. » Un indicateur hors de la liste graduée ne connaît que la
 * majeure, quel que soit le degré du manque.
 *
 * Les seuils utilisés ci-dessous sont des conventions internes destinées à
 * attirer l'œil, pas des exigences du référentiel : le guide ne fixe aucun
 * pourcentage. C'est l'auditeur qui apprécie.
 */

import { APPLICABLE_INDICATORS, type AuditIndicator, type Gradation } from "./qualiopi-referential.ts";

export type CheckStatus = "ok" | "ko" | "unknown";

export interface CheckOutcome {
  status: CheckStatus;
  /** Phrase chiffrée, destinée à être lue telle quelle par l'auditeur. */
  detail: string;
}

export interface AuditFacts {
  /** Indicateur 1 */
  activeFormations: number;
  formationsWithAllDisclosures: number;
  /** Indicateur 2 */
  formationsWithSatisfaction: number;
  satisfactionMethodAvailable: boolean;
  /** Échantillon de sessions tirées pour l'audit */
  sampleSize: number;
  sampleWithObjectives: number;
  sampleWithProgramme: number;
  sampleWithTrainer: number;
  sampleWithNeedsSurvey: number;
  sampleWithPrerequisiteCheck: number;
  sampleWithEvaluations: number;
  sampleWithConvocation: number;
  sampleWithTrainerAdequacy: number;
  /** Indicateur 9 */
  reglementInterieurPublished: boolean;
  /** Indicateur 12 */
  vhdProcedureActive: boolean;
  vhdProcedurePublished: boolean;
  /** Indicateur 19 */
  elearningCourses: number;
  elearningCoursesWithMandatoryLessons: number;
  distanceThresholdConfigured: boolean;
  /** Indicateurs 21 et 22 */
  trainers: number;
  trainersWithCompetences: number;
  trainersWithDocuments: number;
  trainersWithContinuingEducation: number;
  /** Indicateurs 23 à 25 */
  watchItemsLastYear: number;
  watchSourcesFollowed: number;
  watchItemsLinkedToAction: number;
  /** Indicateur 26 */
  handicapReferentDesignated: boolean;
  handicapPartnersActive: number;
  /** Indicateur 30 */
  coldEvaluationsSubmitted: number;
  sponsorEvaluationsSubmitted: number;
  funderAppreciations: number;
  /** Indicateur 31 */
  reclamations: number;
  reclamationsAcknowledged: number;
  reclamationsAnswered: number;
  /** Indicateur 32 */
  qualityRisks: number;
  highRisksWithoutMeasure: number;
  improvements: number;
}

export interface AuditCheckDef {
  id: string;
  label: string;
  run: (f: AuditFacts) => CheckOutcome;
  /** Où corriger, quand le contrôle échoue faute de donnée saisie. */
  fix?: { label: string; href: string };
}

export interface AuditQuestionDef {
  id: string;
  /** Question posée à l'auditeur, dans les termes du guide. */
  label: string;
  /** Ce qu'il faut pouvoir montrer si la réponse est oui. */
  hint?: string;
}

export interface IndicatorPlan {
  indicator: AuditIndicator;
  checks: AuditCheckDef[];
  questions: AuditQuestionDef[];
}

const ok = (detail: string): CheckOutcome => ({ status: "ok", detail });
const ko = (detail: string): CheckOutcome => ({ status: "ko", detail });

/** Contrôle de couverture : tout ou rien, avec le compte en clair. */
function ratio(done: number, total: number, noun: string, zeroDetail?: string): CheckOutcome {
  if (total === 0) return { status: "unknown", detail: zeroDetail ?? `Aucun ${noun} à contrôler` };
  const detail = `${done}/${total} ${noun}`;
  return done >= total ? ok(detail) : ko(detail);
}

const PLANS: Record<number, Omit<IndicatorPlan, "indicator">> = {
  1: {
    checks: [
      {
        id: "1.mentions",
        label: "Mentions obligatoires renseignées sur chaque formation active",
        run: (f) =>
          ratio(f.formationsWithAllDisclosures, f.activeFormations, "formations complètes"),
        fix: { label: "Compléter le catalogue", href: "/catalogue" },
      },
    ],
    questions: [
      {
        id: "1.publie",
        label: "Ces informations sont-elles accessibles au public, hors de l'application ?",
        hint: "Page produit du site, plaquette, conditions générales. L'information doit être à jour.",
      },
      {
        id: "1.trompeuse",
        label: "La communication est-elle exempte de mention pouvant induire le public en erreur ?",
        hint: "Conditions d'accès, contenu, financement, droits conférés par la formation.",
      },
    ],
  },
  2: {
    checks: [
      {
        id: "2.calcul",
        label: "Un indicateur de résultat est calculé par formation",
        run: (f) =>
          f.formationsWithSatisfaction > 0
            ? ok(`${f.formationsWithSatisfaction} formations avec un résultat mesuré`)
            : ko("Aucun résultat calculé"),
      },
      {
        id: "2.methode",
        label: "La méthode de calcul accompagne le résultat",
        run: (f) =>
          f.satisfactionMethodAvailable
            ? ok("Texte de diffusion avec méthode disponible")
            : ko("Aucun texte de méthode"),
      },
    ],
    questions: [
      {
        id: "2.publie",
        label: "Les résultats sont-ils diffusés au public avec leur méthode de calcul ?",
        hint: "Le décret ajoute la transparence de la méthode : un taux seul ne suffit plus.",
      },
    ],
  },
  4: {
    checks: [
      {
        id: "4.recueil",
        label: "Recueil des besoins rempli sur les sessions échantillonnées",
        run: (f) => ratio(f.sampleWithNeedsSurvey, f.sampleSize, "sessions"),
      },
    ],
    questions: [
      {
        id: "4.entreprise",
        label: "Le besoin est-il analysé en lien avec l'entreprise et/ou le financeur ?",
        hint: "Compte rendu d'entretien, cahier des charges, synthèse partagée avec le commanditaire.",
      },
    ],
  },
  5: {
    checks: [
      {
        id: "5.objectifs",
        label: "Objectifs définis sur les sessions échantillonnées",
        run: (f) => ratio(f.sampleWithObjectives, f.sampleSize, "sessions"),
      },
      {
        id: "5.evaluables",
        label: "Les objectifs sont notés un à un par les participants",
        run: (f) => ratio(f.sampleWithEvaluations, f.sampleSize, "sessions évaluées"),
      },
    ],
    questions: [],
  },
  6: {
    checks: [
      {
        id: "6.programme",
        label: "Programme ou parcours rattaché aux sessions échantillonnées",
        run: (f) => ratio(f.sampleWithProgramme, f.sampleSize, "sessions"),
      },
    ],
    questions: [
      {
        id: "6.adaptation",
        label: "Les contenus sont-ils adaptés aux objectifs et aux publics accueillis ?",
        hint: "Déroulés, séquences, modalités techniques et pédagogiques.",
      },
    ],
  },
  8: {
    checks: [
      {
        id: "8.prerequis",
        label: "Validation des prérequis recueillie à l'entrée",
        run: (f) => ratio(f.sampleWithPrerequisiteCheck, f.sampleSize, "sessions"),
      },
    ],
    questions: [
      {
        id: "8.suite",
        label: "Un prérequis non validé donne-t-il lieu à une décision tracée ?",
        hint: "Validation formateur du dossier, repositionnement, refus motivé.",
      },
    ],
  },
  9: {
    checks: [
      {
        id: "9.convocation",
        label: "Convocation envoyée sur les sessions échantillonnées",
        run: (f) => ratio(f.sampleWithConvocation, f.sampleSize, "sessions"),
      },
      {
        id: "9.reglement",
        label: "Règlement intérieur publié et accessible",
        run: (f) =>
          f.reglementInterieurPublished ? ok("Publié") : ko("Aucun règlement publié"),
        fix: { label: "Publier le règlement intérieur", href: "/parametres#reglement-interieur" },
      },
    ],
    questions: [
      {
        id: "9.referents",
        label: "Les noms des référents pédagogique et administratif sont-ils communiqués ?",
      },
    ],
  },
  10: {
    checks: [],
    questions: [
      {
        id: "10.adaptation",
        label: "La prestation est-elle adaptée quand l'analyse du besoin l'établit ?",
        hint: "Durées, contenus, groupes de niveaux, rythmes.",
      },
      {
        id: "10.handicap",
        label: "Les aménagements décidés pour une personne en situation de handicap sont-ils tracés ?",
        hint: "Plan de compensation, fiche de suivi, trace de ce qui a été mis en place.",
      },
    ],
  },
  11: {
    checks: [
      {
        id: "11.evaluation",
        label: "Évaluation de fin recueillie sur les sessions échantillonnées",
        run: (f) => ratio(f.sampleWithEvaluations, f.sampleSize, "sessions"),
      },
    ],
    questions: [],
  },
  12: {
    checks: [
      {
        id: "12.procedure",
        label: "Procédure de prévention des violences en vigueur",
        run: (f) => (f.vhdProcedureActive ? ok("Une version active") : ko("Aucune version active")),
        fix: { label: "Rédiger la procédure", href: "/signalements" },
      },
      {
        id: "12.diffusion",
        label: "Procédure portée à la connaissance des apprenants",
        run: (f) =>
          f.vhdProcedurePublished
            ? ok("Publiée sur la page de session")
            : ko("Non diffusée"),
      },
    ],
    questions: [
      {
        id: "12.abandons",
        label: "Des mesures de prévention des ruptures de parcours sont-elles mises en œuvre ?",
        hint: "Relances, gestion des abandons, contacts individuels.",
      },
    ],
  },
  17: {
    checks: [],
    questions: [
      {
        id: "17.moyens",
        label: "Les locaux, équipements et moyens humains sont-ils adaptés aux objectifs ?",
        hint: "Matériel, plateforme LMS, aides à la connexion à distance.",
      },
    ],
  },
  18: {
    checks: [
      {
        id: "18.intervenant",
        label: "Intervenant identifié sur les sessions échantillonnées",
        run: (f) => ratio(f.sampleWithTrainer, f.sampleSize, "sessions"),
      },
    ],
    questions: [],
  },
  19: {
    checks: [
      {
        id: "19.suivi",
        label: "Parcours à distance dotés de modules obligatoires, donc d'un attendu vérifiable",
        run: (f) =>
          ratio(
            f.elearningCoursesWithMandatoryLessons,
            f.elearningCourses,
            "parcours",
            "Aucun parcours à distance",
          ),
      },
    ],
    questions: [
      {
        id: "19.ressources",
        label: "Les ressources pédagogiques sont-elles disponibles et appropriables ?",
      },
    ],
  },
  21: {
    checks: [
      {
        id: "21.competences",
        label: "Compétences définies pour chaque intervenant",
        run: (f) => ratio(f.trainersWithCompetences, f.trainers, "intervenants"),
        fix: { label: "Renseigner les compétences", href: "/parametres#trainers" },
      },
      {
        id: "21.justificatifs",
        label: "Justificatifs disponibles : CV, diplômes, certifications",
        run: (f) => ratio(f.trainersWithDocuments, f.trainers, "intervenants"),
        fix: { label: "Charger CV et diplômes", href: "/parametres#trainers" },
      },
      {
        id: "21.adequation",
        label: "Adéquation intervenant/session validée sur l'échantillon",
        run: (f) => ratio(f.sampleWithTrainerAdequacy, f.sampleSize, "sessions"),
      },
    ],
    questions: [],
  },
  22: {
    checks: [
      {
        id: "22.formation",
        label: "Formation continue renseignée pour chaque intervenant",
        run: (f) => ratio(f.trainersWithContinuingEducation, f.trainers, "intervenants"),
        fix: { label: "Renseigner les formations suivies", href: "/parametres#trainers" },
      },
    ],
    questions: [
      {
        id: "22.leviers",
        label: "Quels leviers de professionnalisation sont mobilisés ?",
        hint: "Communauté de pairs, analyse de pratiques, formations suivies.",
      },
    ],
  },
  23: {
    checks: [
      {
        id: "23.veille",
        label: "Veille alimentée sur les douze derniers mois",
        run: (f) =>
          f.watchItemsLastYear > 0
            ? ok(`${f.watchItemsLastYear} éléments captés`)
            : ko("Aucun élément sur douze mois"),
      },
      {
        id: "23.exploitation",
        label: "Veille exploitée : un élément au moins a produit une décision tracée",
        run: (f) =>
          f.watchItemsLinkedToAction > 0
            ? ok(`${f.watchItemsLinkedToAction} éléments rattachés à une action`)
            : ko("Aucun lien entre un élément de veille et une décision"),
      },
    ],
    questions: [
      {
        id: "23.legale",
        label: "La veille couvre-t-elle le champ légal et réglementaire de la formation ?",
      },
    ],
  },
  24: {
    checks: [
      {
        id: "24.exploitation",
        label: "Veille exploitée : un élément au moins a produit une décision tracée",
        run: (f) =>
          f.watchItemsLinkedToAction > 0
            ? ok(`${f.watchItemsLinkedToAction} éléments rattachés à une action`)
            : ko("Aucun lien entre un élément de veille et une décision"),
      },
    ],
    questions: [
      {
        id: "24.metiers",
        label: "La veille couvre-t-elle les évolutions des compétences, métiers et emplois ?",
      },
    ],
  },
  25: {
    checks: [
      {
        id: "25.exploitation",
        label: "Veille exploitée : un élément au moins a produit une décision tracée",
        run: (f) =>
          f.watchItemsLinkedToAction > 0
            ? ok(`${f.watchItemsLinkedToAction} éléments rattachés à une action`)
            : ko("Aucun lien entre un élément de veille et une décision"),
      },
    ],
    questions: [
      {
        id: "25.innovation",
        label: "La veille couvre-t-elle les innovations pédagogiques et technologiques ?",
      },
    ],
  },
  26: {
    checks: [
      {
        id: "26.referent",
        label: "Référent handicap désigné et joignable",
        run: (f) =>
          f.handicapReferentDesignated ? ok("Désigné") : ko("Aucun référent désigné"),
        fix: { label: "Désigner le référent", href: "/parametres#referent-handicap" },
      },
      {
        id: "26.reseau",
        label: "Réseau de partenaires du handicap identifié",
        run: (f) =>
          f.handicapPartnersActive > 0
            ? ok(`${f.handicapPartnersActive} partenaires actifs`)
            : ko("Aucun partenaire enregistré"),
        fix: { label: "Alimenter le réseau", href: "/parametres#partenaires-handicap" },
      },
    ],
    questions: [
      {
        id: "26.recours",
        label: "Les modalités de recours à ce réseau sont-elles connues des personnels ?",
      },
    ],
  },
  30: {
    checks: [
      {
        id: "30.beneficiaires",
        label: "Appréciations des bénéficiaires recueillies",
        run: (f) => ratio(f.sampleWithEvaluations, f.sampleSize, "sessions"),
      },
      {
        id: "30.froid",
        label: "Appréciations recueillies à froid",
        run: (f) =>
          f.coldEvaluationsSubmitted > 0
            ? ok(`${f.coldEvaluationsSubmitted} retours à froid`)
            : ko("Aucun retour à froid"),
      },
      {
        id: "30.commanditaire",
        label: "Appréciations des entreprises clientes recueillies",
        run: (f) =>
          f.sponsorEvaluationsSubmitted > 0
            ? ok(`${f.sponsorEvaluationsSubmitted} retours commanditaires`)
            : ko("Aucun retour commanditaire"),
      },
      {
        id: "30.financeur",
        label: "Financeurs sollicités au moins une fois dans l'année",
        run: (f) =>
          f.funderAppreciations > 0
            ? ok(`${f.funderAppreciations} appréciations financeur`)
            : ko("Aucune appréciation financeur"),
      },
    ],
    questions: [
      {
        id: "30.pedagogique",
        label: "L'équipe pédagogique est-elle sollicitée ?",
        hint: "Auto-évaluation du formateur, comptes rendus de réunions d'équipe.",
      },
    ],
  },
  31: {
    checks: [
      {
        id: "31.accuse",
        label: "Accusé de réception envoyé à chaque réclamant",
        run: (f) =>
          ratio(
            f.reclamationsAcknowledged,
            f.reclamations,
            "réclamations",
            "Aucune réclamation reçue à ce jour",
          ),
        fix: { label: "Ouvrir le registre", href: "/reclamations" },
      },
      {
        id: "31.reponse",
        label: "Réponse apportée à chaque réclamation",
        run: (f) =>
          ratio(
            f.reclamationsAnswered,
            f.reclamations,
            "réclamations",
            "Aucune réclamation reçue à ce jour",
          ),
        fix: { label: "Ouvrir le registre", href: "/reclamations" },
      },
    ],
    questions: [
      {
        id: "31.modalites",
        label: "Les modalités de traitement des aléas et difficultés sont-elles formalisées ?",
        hint: "Le registre distingue réclamation, aléa et difficulté. Montrer la procédure.",
      },
    ],
  },
  32: {
    checks: [
      {
        id: "32.risques",
        label: "Analyse des risques sur la qualité des formations",
        run: (f) =>
          f.qualityRisks > 0 ? ok(`${f.qualityRisks} risques analysés`) : ko("Registre vide"),
        fix: { label: "Alimenter le registre des risques", href: "/risques" },
      },
      {
        id: "32.mesures",
        label: "Risques élevés ou critiques couverts par une mesure de prévention",
        run: (f) =>
          f.highRisksWithoutMeasure === 0
            ? ok("Tous couverts")
            : ko(`${f.highRisksWithoutMeasure} sans mesure`),
        fix: { label: "Opposer une mesure", href: "/risques" },
      },
      {
        id: "32.ameliorations",
        label: "Mesures d'amélioration engagées",
        run: (f) =>
          f.improvements > 0 ? ok(`${f.improvements} actions`) : ko("Aucune action d'amélioration"),
        fix: { label: "Ouvrir le plan d'amélioration", href: "/ameliorations" },
      },
    ],
    questions: [
      {
        id: "32.origine",
        label: "Les actions d'amélioration sont-elles reliées aux appréciations et réclamations ?",
      },
    ],
  },
};

export function auditPlan(): IndicatorPlan[] {
  return APPLICABLE_INDICATORS.map((indicator) => ({
    indicator,
    checks: PLANS[indicator.number]?.checks ?? [],
    questions: PLANS[indicator.number]?.questions ?? [],
  }));
}

export type Verdict = "conforme" | "mineure" | "majeure" | "a_verifier";

export type AnswerValue = "oui" | "non" | null;

export interface IndicatorFinding {
  number: number;
  verdict: Verdict;
  checks: Array<{ id: string; label: string } & CheckOutcome>;
  /** Questions restées sans réponse. */
  pending: string[];
  /** Ce qui fonde le verdict, en une phrase. */
  rationale: string;
}

/**
 * Verdict d'un indicateur.
 *
 * Un contrôle `unknown` ne compte ni pour ni contre : il n'y avait rien à
 * contrôler. Une question sans réponse suspend le verdict, parce qu'un audit
 * ne conclut pas sur ce qu'il n'a pas regardé.
 */
export function evaluateIndicator(
  plan: IndicatorPlan,
  facts: AuditFacts,
  answers: Record<string, AnswerValue>,
): IndicatorFinding {
  const checks = plan.checks.map((c) => ({ id: c.id, label: c.label, ...c.run(facts) }));
  const pending = plan.questions.filter((q) => !answers[q.id]).map((q) => q.id);

  const failed = checks.filter((c) => c.status === "ko").length;
  const passed = checks.filter((c) => c.status === "ok").length;
  const answeredNo = plan.questions.filter((q) => answers[q.id] === "non").length;
  const answeredYes = plan.questions.filter((q) => answers[q.id] === "oui").length;

  if (pending.length > 0) {
    return {
      number: plan.indicator.number,
      verdict: "a_verifier",
      checks,
      pending,
      rationale: `${pending.length} question${pending.length > 1 ? "s" : ""} sans réponse`,
    };
  }

  const problems = failed + answeredNo;
  if (problems === 0) {
    return {
      number: plan.indicator.number,
      verdict: "conforme",
      checks,
      pending,
      rationale: "Attendu respecté",
    };
  }

  // Respect partiel contre attendu pas du tout respecté : c'est la distinction
  // que le guide pose entre mineure et majeure.
  const satisfied = passed + answeredYes;
  const minorAllowed = plan.indicator.gradation === "mineure_possible";
  const verdict: Verdict = minorAllowed && satisfied > 0 ? "mineure" : "majeure";

  return {
    number: plan.indicator.number,
    verdict,
    checks,
    pending,
    rationale:
      verdict === "mineure"
        ? `Respect partiel : ${problems} point${problems > 1 ? "s" : ""} en défaut sur ${problems + satisfied}`
        : minorAllowed
          ? "Attendu non respecté"
          : "Cet indicateur ne connaît que la non-conformité majeure",
  };
}

export interface AuditSummary {
  conforme: number;
  mineure: number;
  majeure: number;
  aVerifier: number;
  total: number;
  /** Vrai dès qu'une majeure est prononcée. */
  blocking: boolean;
}

export function summarize(findings: IndicatorFinding[]): AuditSummary {
  const count = (v: Verdict) => findings.filter((f) => f.verdict === v).length;
  const majeure = count("majeure");
  return {
    conforme: count("conforme"),
    mineure: count("mineure"),
    majeure,
    aVerifier: count("a_verifier"),
    total: findings.length,
    blocking: majeure > 0,
  };
}

/* ────────────────────────────────────────────────────────────────────────
 * Construction des faits
 *
 * Le navigateur et la tâche de nuit lisent les mêmes tables avec deux clients
 * différents. L'arithmétique, elle, ne doit exister qu'une fois : sinon
 * l'écran et le cron finiraient par prononcer des verdicts divergents sur la
 * même base.
 * ──────────────────────────────────────────────────────────────────────── */

export interface RawAuditData {
  sampleIds: string[];
  sampleTrainings: Array<{
    id: string;
    objectives: string[] | null;
    program_file_url: string | null;
    supports_lms_course_id: string | null;
    trainer_id: string | null;
  }>;
  activeFormations: Array<{
    recognition_type: string | null;
    funding_terms: string | null;
    access_delay: string | null;
    accessibility_terms: string | null;
  }>;
  submittedEvaluations: Array<{ training_id: string }>;
  submittedSurveys: Array<{ training_id: string; prerequis_validation: string | null }>;
  participants: Array<{ training_id: string; needs_survey_sent_at: string | null }>;
  adequacy: Array<{ training_id: string }>;
  reglementUrl: string | null;
  activeVhdProcedures: number;
  /** Modules des parcours, pour rattacher chaque leçon à son cours. */
  lmsModules: Array<{ id: string; course_id: string }>;
  lmsLessons: Array<{ module_id: string | null; is_mandatory: boolean | null }>;
  lmsCourseIds: string[];
  trainers: Array<{ id: string; competences: string[] | null; formations_suivies: unknown }>;
  trainerDocumentOwners: string[];
  watchItemsLastYear: number;
  watchSourcesFollowed: number;
  watchItemsLinkedToAction: number;
  referentName: string | null;
  referentEmail: string | null;
  handicapPartnersActive: number;
  coldEvaluationsSubmitted: number;
  sponsorEvaluationsSubmitted: number;
  funderAppreciations: number;
  reclamations: Array<{ acknowledgement_sent_at: string | null; response_date: string | null }>;
  risks: Array<{ criticality: number | null; preventive_measure: string | null; status: string }>;
  improvements: number;
}

const filled = (v: unknown): boolean => typeof v === "string" && v.trim().length > 0;

/**
 * Parcours dotés d'au moins une leçon obligatoire, donc d'un attendu
 * vérifiable. Le compte est fait **par cours** : une seule leçon obligatoire
 * quelque part ne rend pas tous les parcours contrôlables.
 *
 * Une leçon dont `is_mandatory` est nul compte comme obligatoire, même
 * convention que le suivi distanciel, pour que les deux écrans comptent
 * pareil.
 */
function coursesWithMandatoryLessons(raw: RawAuditData): number {
  const courseOfModule = new Map(raw.lmsModules.map((m) => [m.id, m.course_id]));
  const covered = new Set<string>();
  for (const lesson of raw.lmsLessons) {
    if (lesson.is_mandatory === false) continue;
    const courseId = lesson.module_id ? courseOfModule.get(lesson.module_id) : undefined;
    if (courseId) covered.add(courseId);
  }
  return raw.lmsCourseIds.filter((id) => covered.has(id)).length;
}

export function buildFacts(raw: RawAuditData): AuditFacts {
  const withEvaluation = new Set(raw.submittedEvaluations.map((e) => e.training_id));
  const withSurvey = new Set(raw.submittedSurveys.map((s) => s.training_id));
  const withPrerequisite = new Set(
    raw.submittedSurveys.filter((s) => filled(s.prerequis_validation)).map((s) => s.training_id),
  );
  const withConvocation = new Set(
    raw.participants.filter((p) => p.needs_survey_sent_at).map((p) => p.training_id),
  );
  const withAdequacy = new Set(raw.adequacy.map((a) => a.training_id));
  const docOwners = new Set(raw.trainerDocumentOwners);

  return {
    activeFormations: raw.activeFormations.length,
    formationsWithAllDisclosures: raw.activeFormations.filter(
      (f) =>
        filled(f.recognition_type) &&
        filled(f.funding_terms) &&
        filled(f.access_delay) &&
        filled(f.accessibility_terms),
    ).length,
    formationsWithSatisfaction: withEvaluation.size,
    satisfactionMethodAvailable: true,
    sampleSize: raw.sampleTrainings.length,
    sampleWithObjectives: raw.sampleTrainings.filter((t) => (t.objectives ?? []).length > 0).length,
    sampleWithProgramme: raw.sampleTrainings.filter(
      (t) => t.program_file_url || t.supports_lms_course_id,
    ).length,
    sampleWithTrainer: raw.sampleTrainings.filter((t) => t.trainer_id).length,
    sampleWithNeedsSurvey: raw.sampleIds.filter((id) => withSurvey.has(id)).length,
    sampleWithPrerequisiteCheck: raw.sampleIds.filter((id) => withPrerequisite.has(id)).length,
    sampleWithEvaluations: raw.sampleIds.filter((id) => withEvaluation.has(id)).length,
    sampleWithConvocation: raw.sampleIds.filter((id) => withConvocation.has(id)).length,
    sampleWithTrainerAdequacy: raw.sampleIds.filter((id) => withAdequacy.has(id)).length,
    reglementInterieurPublished: filled(raw.reglementUrl),
    vhdProcedureActive: raw.activeVhdProcedures > 0,
    vhdProcedurePublished: raw.activeVhdProcedures > 0,
    elearningCourses: raw.lmsCourseIds.length,
    elearningCoursesWithMandatoryLessons: coursesWithMandatoryLessons(raw),
    distanceThresholdConfigured: false,
    trainers: raw.trainers.length,
    trainersWithCompetences: raw.trainers.filter((t) => (t.competences ?? []).length > 0).length,
    trainersWithDocuments: raw.trainers.filter((t) => docOwners.has(t.id)).length,
    trainersWithContinuingEducation: raw.trainers.filter(
      (t) => Array.isArray(t.formations_suivies) && t.formations_suivies.length > 0,
    ).length,
    watchItemsLastYear: raw.watchItemsLastYear,
    watchSourcesFollowed: raw.watchSourcesFollowed,
    watchItemsLinkedToAction: raw.watchItemsLinkedToAction,
    handicapReferentDesignated: filled(raw.referentName) && filled(raw.referentEmail),
    handicapPartnersActive: raw.handicapPartnersActive,
    coldEvaluationsSubmitted: raw.coldEvaluationsSubmitted,
    sponsorEvaluationsSubmitted: raw.sponsorEvaluationsSubmitted,
    funderAppreciations: raw.funderAppreciations,
    reclamations: raw.reclamations.length,
    reclamationsAcknowledged: raw.reclamations.filter((r) => r.acknowledgement_sent_at).length,
    reclamationsAnswered: raw.reclamations.filter((r) => r.response_date).length,
    qualityRisks: raw.risks.length,
    highRisksWithoutMeasure: raw.risks.filter(
      (r) => (r.criticality ?? 0) >= 8 && r.status !== "closed" && !filled(r.preventive_measure),
    ).length,
    improvements: raw.improvements,
  };
}

/**
 * Constats automatiques en défaut, indépendamment des questions posées à
 * l'auditeur. C'est ce que la tâche de nuit peut affirmer seule.
 */
export interface AutomaticIssue {
  indicator: number;
  indicatorLabel: string;
  checkId: string;
  label: string;
  detail: string;
  gradation: Gradation;
  fixHref?: string;
}

export function automaticIssues(facts: AuditFacts): AutomaticIssue[] {
  const issues: AutomaticIssue[] = [];
  for (const plan of auditPlan()) {
    for (const check of plan.checks) {
      const outcome = check.run(facts);
      if (outcome.status !== "ko") continue;
      issues.push({
        indicator: plan.indicator.number,
        indicatorLabel: plan.indicator.label,
        checkId: check.id,
        label: check.label,
        detail: outcome.detail,
        gradation: plan.indicator.gradation,
        fixHref: check.fix?.href,
      });
    }
  }
  return issues;
}
