import { HelpCircle, Mail, MailCheck, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface StatusConfig {
  label: string;
  icon: LucideIcon;
  variant: "default" | "secondary" | "outline" | "destructive";
  tooltip: string;
}

export const getStatusConfig = (status: string): StatusConfig => {
  switch (status) {
    case "non_envoye":
      return {
        label: "Non envoyé",
        icon: Mail,
        variant: "secondary",
        tooltip: "Le questionnaire n'a pas encore été envoyé",
      };
    case "programme":
      return {
        label: "Recueil programmé",
        icon: Clock,
        variant: "outline",
        tooltip: "Le mail d'accueil a été envoyé, l'envoi du questionnaire de recueil est programmé",
      };
    case "manuel":
      return {
        label: "Mode manuel",
        icon: AlertTriangle,
        variant: "secondary",
        tooltip: "Formation trop proche, envoi manuel requis",
      };
    case "envoye":
      return {
        label: "Envoyé",
        icon: MailCheck,
        variant: "outline",
        tooltip: "Le questionnaire a été envoyé, en attente de réponse",
      };
    case "accueil_envoye":
      return {
        label: "Accueil envoyé",
        icon: MailCheck,
        variant: "outline",
        tooltip: "Le mail d'accueil a été envoyé (J-7)",
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
