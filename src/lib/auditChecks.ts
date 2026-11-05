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

import { APPLICABLE_INDICATORS, type AuditIndicator } from "./auditReferential";

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
