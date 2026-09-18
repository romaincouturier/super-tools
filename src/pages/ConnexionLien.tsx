import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, Mail } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { AuthCard, AuthShell, AuthSupportLine, AuthTitle } from "@/components/auth/AuthShell";
import { AuthField, AuthButton } from "@/components/auth/AuthField";
import { PasswordCreationCard } from "@/components/auth/PasswordCreationCard";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import { useIdentityResolution } from "@/hooks/useIdentityResolution";
import { useLearnerTokenRedemption } from "@/hooks/useLearnerTokenRedemption";
import { useSession } from "@/hooks/useSession";
import { LEARNER_HOME, sanitizeRedirect, REDIRECT_PARAM } from "@/lib/authRouting";

/**
 * Ouverture d'un lien reçu par email (W5 et W10).
 * Le lien ouvre la session, puis la création du mot de passe est imposée à qui
 * n'en a pas encore : plus aucun accès durable sans mot de passe. Un lien
 * expiré, déjà utilisé ou invalide porte l'action de reprise dans l'écran même.
 */
export default function ConnexionLien() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const { stage, email, sessionEmail, destination, redeem, keepCurrentSession, switchAccount } = useLearnerTokenRedemption();
  const started = useRef(false);

  const [resendEmail, setResendEmail] = useState("");
  const [resent, setResent] = useState(false);

  const { refresh } = useSession();
  const { resolve } = useIdentityResolution();
  const { loading: sendingLink, invoke: sendLink } = useEdgeFunction("send-learner-magic-link", {
    silentOnError: true,
  });

  // Sans jeton, inutile d'attendre une action : l'écran de reprise s'affiche.
  useEffect(() => {
    if (started.current || token) return;
    started.current = true;
    void redeem("");
  }, [token, redeem]);

  // Destination : celle portée par l'URL, sinon celle rendue par le lien,
  // sinon le tableau de bord (critères 8 et 14).
  const target =
    sanitizeRedirect(searchParams.get(REDIRECT_PARAM)) ?? sanitizeRedirect(destination) ?? LEARNER_HOME;
  const goToSpace = useCallback(() => navigate(target, { replace: true }), [navigate, target]);

  useEffect(() => {
    if (stage === "connected") goToSpace();
  }, [stage, goToSpace]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = (resendEmail || email).trim().toLowerCase();
    if (!target.includes("@")) return;
    // Un lien mort ne dit plus s'il s'agissait d'une connexion ou d'une
    // activation (learner_magic_links ne garde pas ce champ) : on le
    // redemande. Un compte déjà là reçoit un lien de connexion (30
    // minutes), un participant sans compte un lien d'activation (7 jours).
    // Sans réponse du service, on retient l'activation, la durée la plus
    // longue (RG-06) — forcer "login" enverrait un lien deux fois plus
    // court à qui en a le plus besoin.
    const state = await resolve(target);
    const purpose = state === "password" || state === "link" ? "login" : "activation";
    await sendLink({ email: target, purpose });
    setResent(true);
  };

  if (stage === "confirm") {
    return (
      <AuthShell backLabel="Aller à la connexion" onBack={() => navigate("/connexion")}>
        <AuthCard>
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#fdf6e4]">
            <KeyRound className="h-7 w-7 text-[#1a2230]" />
          </div>
          <AuthTitle>
            Accéder à mon espace
          </AuthTitle>
          <p className="mb-8 text-base text-[#6b7686]">
            Cliquez pour ouvrir votre espace apprenant. Votre lien reste valable tant que vous ne
            l'avez pas utilisé, même si votre messagerie l'a ouvert avant vous.
          </p>
          <AuthButton type="button" onClick={() => { started.current = true; void redeem(token); }}>
            Ouvrir mon espace
          </AuthButton>
        </AuthCard>
      </AuthShell>
    );
  }

  if (stage === "redeeming" || stage === "connected") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#f5f6f7]">
        <Spinner size="lg" className="text-primary" />
        <p className="text-[15px] text-[#6b7686]">Un instant, nous ouvrons votre espace.</p>
      </div>
    );
  }

  if (stage === "other-session") {
    return (
      <AuthShell backLabel="Aller à la connexion" onBack={() => navigate("/connexion")}>
        <AuthCard>
          <AuthTitle>
            Vous êtes déjà connecté
          </AuthTitle>
          <p className="mb-8 text-base text-[#6b7686]">
            Vous êtes connecté en tant que {sessionEmail}. Ce lien concerne {email}.
          </p>
          <div className="flex flex-col gap-3">
            <AuthButton type="button" onClick={keepCurrentSession}>
              Continuer en tant que {sessionEmail}
            </AuthButton>
            <button
              type="button"
              onClick={() => void switchAccount()}
              className="text-[15px] font-bold underline underline-offset-[3px]"
            >
              Me connecter en tant que {email}
            </button>
          </div>
        </AuthCard>
      </AuthShell>
    );
  }

  // Étape obligatoire : aucun retour d'en-tête, aucune sortie vers l'espace
  // tant que le mot de passe n'est pas enregistré.
  if (stage === "password-required") {
    return (
      <AuthShell>
        <PasswordCreationCard
          onDone={async () => {
            await refresh();
            goToSpace();
          }}
        />
      </AuthShell>
    );
  }

  if (stage === "unavailable") {
    return (
      <AuthShell backLabel="Aller à la connexion" onBack={() => navigate("/connexion")}>
        <AuthCard>
          <AuthTitle>
            Nous n'arrivons pas à ouvrir votre espace
          </AuthTitle>
          <p className="mb-8 text-base text-[#6b7686]">
            Votre lien est bon, c'est de notre côté que quelque chose coince. Réessayez dans un
            instant. Si vous avez un mot de passe, la page de connexion reste ouverte.
          </p>
          <div className="flex flex-col gap-3">
            <AuthButton type="button" onClick={() => void redeem(token)}>
              Réessayer
            </AuthButton>
            <button
              type="button"
              onClick={() => navigate("/connexion")}
              className="text-[15px] font-bold underline underline-offset-[3px]"
            >
              Me connecter avec mon mot de passe
            </button>
          </div>
          <AuthSupportLine />
        </AuthCard>
      </AuthShell>
    );
  }

  const messages: Record<string, { title: string; body: string }> = {
    expired: {
      title: "Ce lien a expiré",
      body: "Les liens de connexion sont valables 30 minutes, les liens d'activation 7 jours. Nous pouvons vous en envoyer un nouveau tout de suite.",
    },
    used: {
      title: "Ce lien a déjà servi",
      body: "Un lien ne fonctionne qu'une fois, pour votre sécurité. Nous pouvons vous en envoyer un nouveau.",
    },
    invalid: {
      title: "Ce lien n'est pas valide",
      body: "Il a peut-être été coupé par votre logiciel de messagerie. Indiquez votre adresse, nous vous en envoyons un nouveau.",
    },
  };
  const message = messages[stage] ?? messages.invalid;

  return (
    <AuthShell backLabel="Aller à la connexion" onBack={() => navigate("/connexion")}>
      <AuthCard>
        <AuthTitle>
          {message.title}
        </AuthTitle>
        <p className="mb-8 text-base text-[#6b7686]">{message.body}</p>

        {resent ? (
          <div className="rounded-[11px] bg-[#eaf6ee] px-4 py-3.5 text-left text-[14.5px] text-[#1a2230]">
            Si un accès existe pour cette adresse, un nouveau lien vient de partir.
            Pensez à regarder vos courriers indésirables.
          </div>
        ) : (
          <form onSubmit={handleResend}>
            <AuthField
              id="resend-email"
              label="Votre adresse e-mail"
              type="email"
              value={resendEmail || email}
              onChange={setResendEmail}
              placeholder="votre.email@exemple.com"
              autoComplete="email"
              icon={<Mail className="h-[18px] w-[18px]" />}
              autoFocus
              required
            />
            <AuthButton disabled={sendingLink || !(resendEmail || email).includes("@")}>
              {sendingLink ? <Spinner /> : "Recevoir un nouveau lien"}
            </AuthButton>
          </form>
        )}

        <button
          type="button"
          onClick={() => navigate("/connexion")}
          className="mt-4 text-[15px] underline underline-offset-[3px] text-[#6b7686]"
        >
          J'ai un mot de passe, aller à la connexion
        </button>
      </AuthCard>
    </AuthShell>
  );
}
