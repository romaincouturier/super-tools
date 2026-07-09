import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, Info } from "lucide-react";

type StatusMeta = {
  title: string;
  message: string;
  variant: "success" | "error" | "info";
};

const STATUSES: Record<string, StatusMeta> = {
  confirmed: {
    title: "Envoi confirmé",
    message: "Merci ! L'envoi a bien été enregistré côté SuperTilt.",
    variant: "success",
  },
  already: {
    title: "Déjà confirmé",
    message: "Cet envoi a déjà été confirmé. Merci !",
    variant: "info",
  },
  invalid_link: {
    title: "Lien invalide",
    message: "Le lien de confirmation est incomplet.",
    variant: "error",
  },
  invalid_signature: {
    title: "Lien invalide",
    message: "La signature du lien ne correspond pas.",
    variant: "error",
  },
  not_found: {
    title: "Commande introuvable",
    message: "Impossible de retrouver cette commande.",
    variant: "error",
  },
  update_error: {
    title: "Erreur",
    message: "Impossible d'enregistrer la confirmation. Réessaie ou préviens-moi.",
    variant: "error",
  },
  unexpected_error: {
    title: "Erreur",
    message: "Une erreur inattendue s'est produite.",
    variant: "error",
  },
};

const FALLBACK: StatusMeta = {
  title: "Statut inconnu",
  message: "Impossible d'interpréter la réponse.",
  variant: "error",
};

export default function SupertiltConfirmationEnvoi() {
  const [params] = useSearchParams();
  const status = params.get("status") ?? "";
  const at = params.get("at");

  const meta = STATUSES[status] ?? FALLBACK;

  const displayMessage = useMemo(() => {
    if (status === "already" && at) {
      const d = new Date(at);
      if (!Number.isNaN(d.getTime())) {
        return `Cet envoi a déjà été confirmé le ${d.toLocaleDateString("fr-FR")}. Merci !`;
      }
    }
    return meta.message;
  }, [status, at, meta.message]);

  useEffect(() => {
    document.title = `${meta.title} — SuperTilt`;
  }, [meta.title]);

  const iconColor =
    meta.variant === "success"
      ? "bg-green-600"
      : meta.variant === "error"
      ? "bg-red-600"
      : "bg-blue-600";

  const Icon =
    meta.variant === "success" ? CheckCircle2 : meta.variant === "error" ? XCircle : Info;

  return (
    <main className="min-h-screen bg-muted/40 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-card text-card-foreground rounded-xl shadow-sm border p-10 text-center">
        <div
          className={`w-16 h-16 rounded-full ${iconColor} text-white flex items-center justify-center mx-auto mb-6`}
        >
          <Icon className="w-8 h-8" strokeWidth={2.5} />
        </div>
        <h1 className="text-xl font-semibold mb-3">{meta.title}</h1>
        <p className="text-muted-foreground leading-relaxed">{displayMessage}</p>
      </div>
    </main>
  );
}
