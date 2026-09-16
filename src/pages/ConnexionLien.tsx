import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, Lock, CheckCircle2, Circle, ShieldCheck, Mail } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { AuthBadge, AuthCard, AuthInfoPanel, AuthShell, AuthSplitCard, AuthSupportLine, AuthTitle } from "@/components/auth/AuthShell";
import { AuthField, AuthButton } from "@/components/auth/AuthField";
import { validatePassword } from "@/lib/passwordValidation";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import { useLearnerTokenRedemption } from "@/hooks/useLearnerTokenRedemption";
import { useAuthActions } from "@/hooks/useAuthActions";
import { LEARNER_HOME, sanitizeRedirect, REDIRECT_PARAM } from "@/lib/authRouting";

/**
 * Ouverture d'un lien reçu par email (W5 et W10).
 * Le lien connecte : aucun mot de passe n'est demandé pour entrer. Un lien
 * expiré, déjà utilisé ou invalide porte l'action de reprise dans l'écran même.
 */
export default function ConnexionLien() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? "";
  const { stage, email, sessionEmail, destination, redeem, keepCurrentSession, switchAccount } = useLearnerTokenRedemption();
  const started = useRef(false);

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resendEmail, setResendEmail] = useState("");
  const [resent, setResent] = useState(false);

  const { updatePassword, markPasswordChanged } = useAuthActions();
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
    await sendLink({ email: target, purpose: "login" });
    setResent(true);
  };

  const rules = validatePassword(password);
  const matches = password.length > 0 && password === confirmation;

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rules.isValid || !matches) return;
    setSaving(true);
    setErrorMsg(null);
    const failure = await updatePassword(password);
    if (failure) {
      setErrorMsg(failure);
      setSaving(false);
      return;
    }
    await markPasswordChanged();
    goToSpace();
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

  if (stage === "password-offer") {
    return (
      <AuthShell backLabel="Aller à mon espace" onBack={goToSpace}>
        <AuthSplitCard
          left={
            <>
              <AuthBadge><KeyRound className="h-6 w-6" /></AuthBadge>
              <AuthTitle>
                Vous y êtes
              </AuthTitle>
              <p className="mb-5 max-w-[42ch] text-[15.5px] text-[#6b7686]">
                Souhaitez-vous définir un mot de passe ? Vous pourrez vous connecter directement,
                sans passer par votre boîte mail.
              </p>
              <form onSubmit={handleSavePassword}>
                <AuthField
                  id="offer-password"
                  label="Mot de passe"
                  type="password"
                  value={password}
                  onChange={setPassword}
                  autoComplete="new-password"
                  icon={<Lock className="h-[18px] w-[18px]" />}
                  required
                />
                <AuthField
                  id="offer-password-confirm"
                  label="Confirmer le mot de passe"
                  type="password"
                  value={confirmation}
                  onChange={setConfirmation}
                  autoComplete="new-password"
                  icon={<Lock className="h-[18px] w-[18px]" />}
                  required
                />
                <div className="mb-5 flex flex-col gap-1.5 rounded-[11px] bg-[#eaf6ee] px-4 py-3.5">
                  <Rule ok={rules.hasMinLength} label="Au moins 8 caractères" />
                  <Rule ok={rules.hasUppercase && rules.hasLowercase} label="Une majuscule et une minuscule" />
                  <Rule ok={rules.hasNumber} label="Un chiffre" />
                  <Rule ok={rules.hasSpecialChar} label="Un caractère spécial" />
                  <Rule ok={matches} label="Les deux saisies correspondent" />
                </div>
                {errorMsg && <p className="mb-4 text-sm text-destructive">{errorMsg}</p>}
                <AuthButton disabled={saving || !rules.isValid || !matches}>
                  {saving ? <Spinner /> : "Enregistrer et continuer"}
                </AuthButton>
              </form>
              <button
                type="button"
                onClick={goToSpace}
                className="mt-4 block w-full text-center text-[15px] underline underline-offset-[3px] text-[#6b7686]"
              >
                Plus tard, accéder directement à ma formation
              </button>
              <AuthSupportLine />
            </>
          }
          right={
            <AuthInfoPanel
              items={[
                {
                  icon: <Mail className="h-[21px] w-[21px]" />,
                  title: "Le mot de passe est facultatif",
                  text: "Vous pouvez toujours vous connecter avec un lien reçu par email, autant de fois que vous le souhaitez.",
                },
                {
                  icon: <ShieldCheck className="h-[21px] w-[21px]" />,
                  title: "Plus rapide au quotidien",
                  text: "Avec un mot de passe, vous entrez sans quitter la page de connexion.",
                },
              ]}
            />
          }
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

function Rule({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-2.5 text-[14.5px] ${ok ? "text-[#1a2230]" : "text-[#6b7686]"}`}>
      {ok
        ? <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-[#3f9c62]" />
        : <Circle className="h-[18px] w-[18px] shrink-0 text-[#9aa3b0]" />}
      {label}
    </div>
  );
}
