import { HelpCircle, Mail, MailCheck, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface StatusConfig {
  label: string;
  icon: LucideIcon;
  variant: "default" | "secondary" | "outline" | "destructive";
  tooltip: string;
  /** Tailwind color class that overrides the variant-based default. */
  colorClass?: string;
}

export const getStatusConfig = (status: string): StatusConfig => {
  switch (status) {
    case "non_envoye":
      return {
        label: "Non envoyé",
        icon: Mail,
        variant: "secondary",
        tooltip: "Le recueil des besoins n'a pas été programmé",
      };
    case "programme":
      return {
        label: "Recueil programmé",
        icon: Mail,
        variant: "outline",
        tooltip: "Le recueil des besoins a été programmé à J-7",
        colorClass: "text-amber-500",
      };
    case "manuel":
      return {
        label: "Mode manuel",
        icon: AlertTriangle,
        variant: "secondary",
        tooltip: "Formation trop proche, envoi du recueil requis manuellement",
      };
    case "envoye":
      return {
        label: "Envoyé",
        icon: MailCheck,
        variant: "outline",
        tooltip: "Le recueil des besoins a été envoyé, en attente de réponse",
        colorClass: "text-amber-500",
      };
    case "accueil_envoye":
      return {
        label: "Recueil programmé",
        icon: Mail,
        variant: "outline",
        tooltip: "Le recueil des besoins a été programmé (formation proche, envoi immédiat)",
        colorClass: "text-amber-500",
      };
    case "en_cours":
      return {
        label: "En cours",
        icon: Clock,
        variant: "default",
        tooltip: "Le participant a commencé à remplir le questionnaire",
      };
    case "complete":
      return {
        label: "Complété",
        icon: CheckCircle,
        variant: "default",
        tooltip: "Le questionnaire a été complété",
      };
    case "valide_formateur":
      return {
        label: "Validé",
        icon: CheckCircle,
        variant: "default",
        tooltip: "Le formateur a validé les réponses",
      };
    case "expire":
      return {
        label: "Expiré",
        icon: AlertTriangle,
        variant: "destructive",
        tooltip: "Le lien du questionnaire a expiré",
      };
    default:
      return {
        label: status,
        icon: HelpCircle,
        variant: "secondary",
        tooltip: "Statut inconnu",
      };
  }
};
