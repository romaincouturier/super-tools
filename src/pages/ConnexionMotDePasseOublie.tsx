import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, CheckCircle2, ShieldCheck } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { AuthBadge, AuthInfoPanel, AuthShell, AuthSplitCard, AuthSupportLine, AuthTitle } from "@/components/auth/AuthShell";
import { AuthField, AuthButton } from "@/components/auth/AuthField";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";

export default function ConnexionMotDePasseOublie() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const { loading, invoke } = useEdgeFunction("send-password-reset", {
    errorMessage: "Envoi impossible pour le moment.",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) return;
    // Message identique que l'adresse existe ou non (RG-07) : on affiche la
    // confirmation quelle que soit la réponse.
    await invoke({
      email: normalized,
      redirectUrl: `${window.location.origin}/connexion/reinitialisation`,
    });
    setSent(true);
  };

  return (
    <AuthShell
      backLabel="Retour à la connexion"
      onBack={() => navigate("/connexion")}
    >
      <AuthSplitCard
        left={
          <>
            <AuthBadge>
              <Lock className="h-6 w-6" />
            </AuthBadge>
            <AuthTitle>
              Mot de passe oublié
            </AuthTitle>
            <p className="mb-7 max-w-[42ch] text-[15.5px] text-muted-foreground">
              Indiquez l'adresse e-mail utilisée pour votre compte. Nous vous enverrons un lien
              pour définir un nouveau mot de passe.
            </p>

            <form onSubmit={handleSubmit}>
              <AuthField
                id="forgot-email"
                label="Adresse e-mail"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="exemple@entreprise.com"
                autoComplete="email"
                icon={<Mail className="h-[18px] w-[18px]" />}
                autoFocus
                required
              />
              <AuthButton disabled={loading || !email.includes("@")}>
                {loading ? <Spinner /> : "Envoyer le lien de réinitialisation"}
              </AuthButton>
            </form>

            <Link
              to="/connexion"
              className="mt-5 block text-center text-[15px] font-bold underline underline-offset-[3px]"
            >
              Je me souviens de mon mot de passe
            </Link>

            {sent && (
              <div className="mt-6 flex items-center gap-3 rounded-[11px] bg-primary/10 px-4 py-3.5 text-[14.5px] text-foreground">
                <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-primary" />
                Si un compte existe pour cette adresse, un e-mail vient d'être envoyé.
                Le lien est valable 1 heure.
              </div>
            )}

            <AuthSupportLine />
          </>
        }
        right={
          <AuthInfoPanel
            items={[
              {
                icon: <Mail className="h-[21px] w-[21px]" />,
                title: "Vérifiez votre boîte mail",
                text: "Vous recevrez un e-mail contenant un lien valable 1 heure, utilisable une seule fois.",
              },
              {
                icon: <ShieldCheck className="h-[21px] w-[21px]" />,
                title: "Pas d'e-mail reçu ?",
                text: "Si vous ne voyez rien, pensez à vérifier vos courriers indésirables.",
              },
            ]}
          />
        }
      />
    </AuthShell>
  );
}
