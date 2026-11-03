/**
 * Shared constants for reclamations (used by Reclamations admin + ReclamationPublic).
 * Aligned with Qualiopi Indicateur 30 terminology.
 */

export const NATURES = [
  { value: "reclamation", label: "Réclamation", description: "Expression formelle d'insatisfaction" },
  { value: "alea", label: "Aléa", description: "Événement imprévu survenu pendant la formation" },
  { value: "difficulte", label: "Difficulté rencontrée", description: "Obstacle ou problème identifié" },
] as const;

export const CANALS = [
  { value: "mail", label: "Email" },
  { value: "telephone", label: "Téléphone" },
  { value: "formulaire", label: "Formulaire" },
  { value: "autre", label: "Autre" },
] as const;

export const PROBLEM_TYPES = [
  { value: "contenu", label: "Contenu" },
  { value: "organisation", label: "Organisation" },
  { value: "logistique", label: "Logistique" },
  { value: "technique", label: "Technique" },
  { value: "facturation", label: "Facturation" },
  { value: "relationnel", label: "Relationnel" },
  { value: "autre", label: "Autre" },
] as const;

export const SEVERITIES = [
  { value: "mineure", label: "Mineure", description: "Gêne légère, sans impact significatif" },
  { value: "significative", label: "Significative", description: "Impact notable sur la qualité" },
  { value: "majeure", label: "Majeure", description: "Problème grave nécessitant une action urgente" },
] as const;

export const STATUS_LABELS: Record<string, string> = {
  open: "Ouverte",
  in_progress: "En cours",
  closed: "Clôturée",
  draft: "Brouillon",
};

export const STATUS_COLORS: Record<string, string> = {
  open: "bg-caution-surface text-caution-ink",
  in_progress: "bg-info-surface text-info-ink",
  closed: "bg-success-surface text-success",
  draft: "bg-gray-100 text-gray-600",
};

export const SEVERITY_COLORS: Record<string, string> = {
  mineure: "bg-caution-surface text-caution-ink",
  significative: "bg-caution-surface text-caution-ink",
  majeure: "bg-danger-surface text-danger-ink",
};

export const NATURE_LABELS: Record<string, string> = {
  reclamation: "Réclamation",
  alea: "Aléa",
  difficulte: "Difficulté",
};

export const NATURE_COLORS: Record<string, string> = {
  reclamation: "bg-danger-surface text-danger-ink",
  alea: "bg-caution-surface text-caution-ink",
  difficulte: "bg-purple-100 text-purple-800",
};
