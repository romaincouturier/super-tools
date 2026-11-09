/**
 * Référentiel national qualité V10 — les indicateurs tels qu'un auditeur les
 * déroule.
 *
 * Source : guide de lecture V10, novembre 2026 (DGEFP). Chaque entrée porte ce
 * que le guide en dit : le niveau attendu, les preuves qu'il cite en exemple,
 * et la gradation de la non-conformité.
 *
 * Deux règles du guide sont encodées ici parce qu'elles décident du verdict :
 *
 * 1. **La gradation.** Le guide liste les indicateurs pouvant donner lieu à une
 *    non-conformité mineure : 1, 2, 3, 8, 9, 12, 13, 17, 18, 19, 23, 24, 25,
 *    28, 30 et 33. Tous les autres ne connaissent que la majeure. Un manque
 *    partiel sur l'indicateur 4 est donc majeur, alors que le même manque sur
 *    l'indicateur 9 est mineur.
 *
 * 2. **Le périmètre.** Un indicateur hors champ ne se juge pas. SuperTilt est
 *    certifié au titre des actions de formation, n'est ni CFA ni certificateur,
 *    ne propose pas de formation certifiante ni d'alternance, et ne sous-traite
 *    pas.
 *
 * Ce fichier ne contient aucune règle d'audit absente du guide. Les seuils
 * d'alerte des contrôles automatiques vivent dans auditChecks.ts et sont des
 * conventions internes, pas des exigences du référentiel.
 */

export type Gradation = "mineure_possible" | "majeure_seule";

export interface AuditIndicator {
  /** Numéro au référentiel, 1 à 33. */
  number: number;
  /** Critère auquel il appartient, 1 à 7. */
  criterion: number;
  label: string;
  /** « Niveau attendu » du guide, cité. */
  expected: string;
  gradation: Gradation;
  /** Exemples de preuves cités par le guide, abrégés. */
  evidence: string[];
  /** Renseigné quand l'indicateur ne s'applique pas, avec le motif. */
  notApplicable?: string;
  /** Restriction de champ énoncée par le guide. */
  scopeNote?: string;
}

/** Indicateurs que le guide autorise à ne dégrader qu'en non-conformité mineure. */
const MINOR_ALLOWED = new Set([1, 2, 3, 8, 9, 12, 13, 17, 18, 19, 23, 24, 25, 28, 30, 33]);

export function gradationOf(number: number): Gradation {
  return MINOR_ALLOWED.has(number) ? "mineure_possible" : "majeure_seule";
}

const CRITERION_LABELS: Record<number, string> = {
  1: "Information du public",
  2: "Objectifs et conception",
  3: "Adaptation aux publics",
  4: "Moyens pédagogiques et encadrement",
  5: "Qualification des personnels",
  6: "Investissement dans l'environnement professionnel",
  7: "Appréciations et réclamations",
};

export function criterionLabel(criterion: number): string {
  return CRITERION_LABELS[criterion] ?? `Critère ${criterion}`;
}

export const AUDIT_INDICATORS: AuditIndicator[] = [
  {
    number: 1,
    criterion: 1,
    label: "Information accessible, détaillée et vérifiable sur les prestations",
    expected:
      "Donner une information accessible, exhaustive sur la prestation et sur l'intégralité des items mentionnés. Cette information doit être à jour.",
    gradation: gradationOf(1),
    evidence: [
      "Supports et outils d'information : site, plaquette, réseaux sociaux, conditions générales",
      "Prérequis, objectifs, reconnaissance délivrée, durée, modalités pédagogiques et de financement",
      "Délais d'accès, tarifs, contacts, méthodes mobilisées, modalités d'évaluation",
      "Conditions d'accès et politique d'accessibilité aux personnes en situation de handicap",
    ],
  },
  {
    number: 2,
    criterion: 1,
    label: "Diffusion d'indicateurs de résultats",
    expected:
      "Donner une information chiffrée permettant de suivre les résultats de la prestation au regard des objectifs, en précisant sa méthode de calcul.",
    gradation: gradationOf(2),
    evidence: [
      "Taux de satisfaction, nombre de stagiaires, taux et causes des abandons",
      "Taux de retour des enquêtes, taux de réalisation des heures contractualisées",
      "Rapports d'activité, bilans, résultats d'enquêtes",
    ],
  },
  {
    number: 3,
    criterion: 1,
    label: "Information sur les taux d'obtention des certifications",
    expected: "Sans objet : l'organisme ne prépare à aucune certification professionnelle.",
    gradation: gradationOf(3),
    evidence: [],
    notApplicable: "Aucune prestation conduisant à une certification professionnelle.",
  },
  {
    number: 4,
    criterion: 2,
    label: "Analyse du besoin du bénéficiaire",
    expected:
      "Démontrer comment le besoin du bénéficiaire est analysé en fonction de la finalité de la prestation, en lien avec l'entreprise et/ou le financeur.",
    gradation: gradationOf(4),
    evidence: [
      "Support synthétisant les besoins identifiés, grilles d'analyse, diagnostics préalables",
      "Comptes rendus d'entretiens, critères de détermination de l'opportunité",
      "Pour un public en situation de handicap : analyse concertée des besoins de compensation",
    ],
  },
  {
    number: 5,
    criterion: 2,
    label: "Objectifs opérationnels et évaluables",
    expected:
      "Démontrer que les objectifs spécifiques à la prestation ont été définis et peuvent faire l'objet d'une évaluation.",
    gradation: gradationOf(5),
    evidence: [
      "Indicateurs de suivi et de résultats, supports de contractualisation",
      "Objectifs pédagogiques intermédiaires et finaux",
    ],
  },
  {
    number: 6,
    criterion: 2,
    label: "Contenus et modalités adaptés aux objectifs et aux publics",
    expected:
      "Démontrer que les contenus et modalités de mise en œuvre des prestations sont adaptés aux objectifs définis en fonction des bénéficiaires.",
    gradation: gradationOf(6),
    evidence: [
      "Parcours, déroulés et séquences, grilles et modalités d'évaluation",
      "Modalités techniques et pédagogiques d'accompagnement, en présentiel ou à distance",
    ],
  },
  {
    number: 7,
    criterion: 2,
    label: "Adéquation du contenu à la certification visée",
    expected: "Sans objet : aucune prestation ne conduit à une certification professionnelle.",
    gradation: gradationOf(7),
    evidence: [],
    notApplicable: "Aucune prestation certifiante.",
  },
  {
    number: 8,
    criterion: 2,
    label: "Positionnement et évaluation des acquis à l'entrée",
    expected:
      "Démontrer l'existence de procédures de positionnement et d'évaluation des acquis à l'entrée de la prestation, adaptées aux publics et aux modalités.",
    gradation: gradationOf(8),
    evidence: [
      "Diagnostic préalable, entretien, quiz, auto-positionnement",
      "Procédures de positionnement et conditions d'accès",
      "Le positionnement peut se limiter à la prise en compte des titres exigés",
    ],
  },
  {
    number: 9,
    criterion: 3,
    label: "Information sur les conditions de déroulement",
    expected: "Les modalités d'accueil et les conditions de déroulement sont formalisées et diffusées.",
    gradation: gradationOf(9),
    evidence: [
      "Règlement intérieur, livret d'accueil, convocation",
      "Noms des référents pédagogiques et administratifs",
      "Pour la formation à distance : modalités d'accès au LMS, assistance technique et pédagogique",
    ],
  },
  {
    number: 10,
    criterion: 3,
    label: "Adaptation de la prestation, de l'accompagnement et du suivi",
    expected:
      "La prestation est adaptée aux situations et profils des bénéficiaires lorsque l'analyse du besoin en établit la nécessité : contenus, accompagnement, suivi.",
    gradation: gradationOf(10),
    evidence: [
      "Durées et contenus adaptés, groupes de niveaux, entretiens",
      "Traçabilité de l'accompagnement technique et pédagogique",
      "Plans individuels de compensation du handicap, fiches de suivi",
    ],
  },
  {
    number: 11,
    criterion: 3,
    label: "Évaluation de l'atteinte des objectifs",
    expected:
      "Démontrer qu'un processus d'évaluation existe, est formalisé et mis en œuvre, et qu'il permet d'apprécier l'atteinte des objectifs.",
    gradation: gradationOf(11),
    evidence: [
      "Outils d'évaluation des acquis en cours et en fin de prestation",
      "Bilans intermédiaires, comptes rendus, auto-évaluation",
    ],
  },
  {
    number: 12,
    criterion: 3,
    label: "Engagement, prévention des ruptures, violences et discriminations",
    expected: "Démontrer que des mesures formalisées existent et sont mises en œuvre.",
    gradation: gradationOf(12),
    scopeNote: "Cet indicateur s'applique aux formations d'une durée supérieure à 2 jours.",
    evidence: [
      "Procédure de gestion des abandons et de relance",
      "Procédure de prévention et de traitement des violences sexistes et sexuelles portée à la connaissance des apprenants",
      "Référent chargé du traitement des signalements, traçabilité des signalements et des suites",
    ],
  },
  {
    number: 17,
    criterion: 4,
    label: "Moyens humains et techniques adaptés",
    expected:
      "Démontrer que les locaux, les équipements et les moyens humains sont en adéquation avec les objectifs des prestations.",
    gradation: gradationOf(17),
    evidence: [
      "Matériel adéquat, plateformes LMS, aides à la connexion à distance",
      "Planning d'intervention, espace documentaire, plateforme pédagogique",
    ],
  },
  {
    number: 18,
    criterion: 4,
    label: "Mobilisation et coordination des intervenants",
    expected:
      "Le prestataire identifie, selon les fonctions nécessaires aux prestations, les intervenants dont il assure la coordination.",
    gradation: gradationOf(18),
    evidence: [
      "Organigramme fonctionnel, liste des intervenants, fiches de poste",
      "Un prestataire indépendant peut assurer seul les différentes fonctions",
    ],
  },
  {
    number: 19,
    criterion: 4,
    label: "Ressources pédagogiques et effectivité du suivi à distance",
    expected:
      "Démontrer que les ressources pédagogiques sont cohérentes, disponibles, et que des dispositions permettent aux bénéficiaires de se les approprier. Vérifier l'effectivité du suivi des modules à distance.",
    gradation: gradationOf(19),
    scopeNote:
      "Le référent pédagogique n'est exigé qu'au-delà d'un nombre d'intervenants fixé par arrêté, non paru à ce jour.",
    evidence: [
      "Supports de cours, ressources documentaires, modalités d'accès",
      "Suivi de l'assiduité et de la progression à distance : relances en cas d'inactivité, alertes de décrochage",
    ],
  },
  {
    number: 21,
    criterion: 5,
    label: "Compétences des intervenants",
    expected:
      "Démontrer que les compétences requises ont été définies en amont et sont adaptées aux prestations. La maîtrise de ces compétences est vérifiée par le prestataire.",
    gradation: gradationOf(21),
    evidence: [
      "CV des intervenants, formations initiales et continues",
      "Analyse des besoins de compétences, modalités de recrutement",
      "Sensibilisation à l'accueil du public en situation de handicap",
    ],
  },
  {
    number: 22,
    criterion: 5,
    label: "Développement des compétences des personnels",
    expected:
      "Démontrer la mobilisation des différents leviers de formation et de professionnalisation pour l'ensemble de son personnel.",
    gradation: gradationOf(22),
    evidence: [
      "Plan de développement des compétences, entretiens professionnels",
      "Communauté de pairs, groupes d'analyse de pratiques",
      "Les prestataires indépendants démontrent leur démarche de formation continue",
    ],
  },
  {
    number: 23,
    criterion: 6,
    label: "Veille légale et réglementaire",
    expected:
      "Démontrer la mise en place d'une veille légale et réglementaire, sa prise en compte et sa communication en interne.",
    gradation: gradationOf(23),
    evidence: [
      "Abonnements, adhésions, participation à des salons et conférences",
      "Actualisation des supports d'information et de contractualisation",
      "Consultation et diffusion de la documentation institutionnelle",
    ],
  },
  {
    number: 24,
    criterion: 6,
    label: "Veille sur les compétences, métiers et emplois",
    expected:
      "Démontrer la mise en place d'une veille sur les thèmes de l'indicateur et son impact éventuel sur les prestations.",
    gradation: gradationOf(24),
    evidence: [
      "Veille sur les évolutions des compétences, des métiers et des emplois",
      "Diffusion au personnel, évolutions apportées au contenu des prestations",
    ],
  },
  {
    number: 25,
    criterion: 6,
    label: "Veille sur les innovations pédagogiques et technologiques",
    expected:
      "Démontrer la mise en place d'une veille sur les thèmes de l'indicateur et son impact éventuel sur les prestations.",
    gradation: gradationOf(25),
    evidence: [
      "Veille sur les innovations pédagogiques et technologiques",
      "Analyse d'opportunité et de faisabilité sur leur mise en œuvre",
    ],
  },
  {
    number: 26,
    criterion: 6,
    label: "Réseau et expertises du champ du handicap",
    expected:
      "Démontrer l'identification d'un réseau de partenaires, experts et acteurs du champ du handicap, mobilisable par les personnels. En cas d'accueil, préciser les modalités de recours et les mesures mises en œuvre.",
    gradation: gradationOf(26),
    evidence: [
      "Liste des partenaires du handicap : Agefiph, Fiphfp, Cap emploi, MDPH",
      "Compétences et connaissances actualisées du référent handicap",
      "Recours à la Ressource Handicap Formation",
    ],
  },
  {
    number: 27,
    criterion: 6,
    label: "Conformité des sous-traitants",
    expected: "Sans objet : l'organisme ne recourt ni à la sous-traitance ni au portage salarial.",
    gradation: gradationOf(27),
    evidence: [],
    notApplicable:
      "L'organisme ne sous-traite pas. Le formateur externe hébergé sur la plateforme facture ses propres clients.",
  },
  {
    number: 30,
    criterion: 7,
    label: "Recueil des appréciations des parties prenantes",
    expected:
      "Démontrer la sollicitation des appréciations à une fréquence pertinente, incluant des dispositifs de relance et permettant une libre expression.",
    gradation: gradationOf(30),
    evidence: [
      "Enquêtes de satisfaction, évaluations à chaud et à froid",
      "Sollicitation des financeurs, au moins une fois par an",
      "Les évaluations des acquis ne sont pas un élément de preuve probant pour cet indicateur",
    ],
  },
  {
    number: 31,
    criterion: 7,
    label: "Traitement des difficultés, réclamations et aléas",
    expected: "Démontrer la mise en place de modalités de traitement des aléas, difficultés et réclamations.",
    gradation: gradationOf(31),
    evidence: [
      "Accusé de réception des réclamations et réponses apportées aux réclamants",
      "Analyse et traitement des réclamations, traitement des difficultés et des aléas",
      "Tableau de suivi des réclamations et de leur traitement",
    ],
  },
  {
    number: 32,
    criterion: 7,
    label: "Amélioration continue et analyse des risques",
    expected: "Démontrer la mise en place d'une démarche d'amélioration continue.",
    gradation: gradationOf(32),
    evidence: [
      "Identification des causes d'abandon ou d'insatisfaction, plans d'action",
      "Tableau de suivi des mesures d'amélioration issues des réclamations, aléas et difficultés",
      "Analyse des risques sur la qualité des formations délivrées",
      "Organisation de l'audit interne",
    ],
  },
];

/** Indicateurs réellement audités, dans l'ordre du référentiel. */
export const APPLICABLE_INDICATORS = AUDIT_INDICATORS.filter((i) => !i.notApplicable);

export function findIndicator(number: number): AuditIndicator | null {
  return AUDIT_INDICATORS.find((i) => i.number === number) ?? null;
}
