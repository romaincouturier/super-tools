import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Lock, ShieldCheck, CheckCircle2, ArrowLeft } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { AuthCard, AuthShell, AuthTitle } from "@/components/auth/AuthShell";
import { AuthField, AuthButton } from "@/components/auth/AuthField";
import LoginAttemptFeedback from "@/components/LoginAttemptFeedback";
import { useLoginAttempts } from "@/hooks/useLoginAttempts";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import { useAuthActions } from "@/hooks/useAuthActions";
import { useIdentityResolution } from "@/hooks/useIdentityResolution";
import { useSession } from "@/hooks/useSession";
import { resolvePostLoginPath, REDIRECT_PARAM } from "@/lib/authRouting";

/**
 * Porte de connexion apprenant (W1 à W6, W9).
 * Identifiant d'abord : l'adresse décide de l'étape suivante. Si le service de
 * résolution ne répond pas, l'écran bascule en mode dégradé (chapitre 6.4).
 */
type Step = "email" | "password" | "link" | "activation" | "unknown" | "throttled" | "degraded";

/** Délai avant de pouvoir redemander un lien. */
const RESEND_COOLDOWN_S = 60;

export default function Connexion() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const next = searchParams.get(REDIRECT_PARAM);
  const { status, isStaff, mustChangePassword } = useSession();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAttemptFeedback, setShowAttemptFeedback] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const { status: attempts, countdown, checkAttempt, logAttempt, formatTimeRemaining } = useLoginAttempts();
  const { signIn } = useAuthActions();
  const { resolve, resolving } = useIdentityResolution();
  const { loading: sendingLink, invoke: sendLink } = useEdgeFunction("send-learner-magic-link", {
    silentOnError: true,
  });

  // Session déjà ouverte : le formulaire ne s'affiche jamais (W9).
  useEffect(() => {
    if (status === "staff" || status === "learner" || status === "none") {
      navigate(
        resolvePostLoginPath({ isStaff, mustChangePassword, next, hasAccess: status !== "none" }),
        { replace: true },
      );
    }
  }, [status, isStaff, mustChangePassword, next, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const normalizedEmail = email.trim().toLowerCase();

  /**
   * Un lien demandé depuis cette page est un lien de connexion (30 minutes).
   * Un compte encore à créer reçoit un lien d'activation (7 jours).
   */
  const requestLink = async (purpose: "login" | "activation" = "login") => {
    if (cooldown > 0) return;
    await sendLink({ email: normalizedEmail, purpose });
    setCooldown(RESEND_COOLDOWN_S);
  };

  const handleEmailStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedEmail.includes("@")) return;
    setErrorMsg(null);

    const state = await resolve(normalizedEmail);
    if (state === null) {
      setStep("degraded");
      return;
    }
    if (state === "password") { setStep("password"); return; }
    if (state === "throttled") { setStep("throttled"); return; }
    if (state === "unknown") { setStep("unknown"); return; }

    await requestLink(state === "link" ? "login" : "activation");
    setStep(state === "link" ? "link" : "activation");
  };

  const handlePasswordStep = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setShowAttemptFeedback(false);

    const allowed = await checkAttempt(normalizedEmail);
    if (!allowed) {
      setSubmitting(false);
      return;
    }

    const outcome = await signIn(normalizedEmail, password);
    if (!outcome.ok) {
      await logAttempt(normalizedEmail, false);
      setShowAttemptFeedback(true);
      setErrorMsg("Email ou mot de passe incorrect. Vous pouvez réessayer, ou réinitialiser votre mot de passe.");
      setSubmitting(false);
      return;
    }

    void logAttempt(normalizedEmail, true);
    navigate(
      resolvePostLoginPath({
        isStaff: outcome.isStaff,
        mustChangePassword: outcome.mustChangePassword,
        hasAccess: outcome.hasAccess,
        next,
      }),
      { replace: true },
    );
  };

  const backToEmail = () => {
    setStep("email");
    setPassword("");
    setErrorMsg(null);
    setShowAttemptFeedback(false);
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f6f7]">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  return (
    <AuthShell>
      <AuthCard>
        {step === "email" && (
          <>
            <Title>Se connecter</Title>
            <Subtitle>Indiquez l'adresse email utilisée lors de votre inscription.</Subtitle>
            <form onSubmit={handleEmailStep}>
              <EmailField value={email} onChange={setEmail} autoFocus />
              <AuthButton disabled={resolving || !normalizedEmail.includes("@")}>
                {resolving ? <Spinner /> : "Continuer"}
              </AuthButton>
            </form>
            <p className="mt-5 text-[15px] text-[#6b7686]">
              Vous n'avez pas encore de compte&nbsp;?{" "}
              <a href="/#formations" className="font-bold text-[#1a2230] underline underline-offset-[3px]">
                Créer un compte gratuitement
              </a>
            </p>
          </>
        )}

        {step === "password" && (
          <>
            <Title>Content de vous revoir</Title>
            <Subtitle>Saisissez votre mot de passe pour accéder à vos formations.</Subtitle>
            <form onSubmit={handlePasswordStep}>
              {/* L'adresse reste dans le formulaire pour que les gestionnaires de
                  mots de passe enregistrent le couple (RG-20). */}
              <EmailField value={email} onChange={setEmail} readOnly />
              <AuthField
                id="connexion-password"
                label="Mot de passe"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="Votre mot de passe"
                autoComplete="current-password"
                icon={<Lock className="h-[18px] w-[18px]" />}
                autoFocus
                required
              />

              <div className="mb-6 flex flex-wrap items-center justify-between gap-4 text-[15px]">
                <button type="button" onClick={backToEmail} className="flex items-center gap-2 text-[#6b7686] hover:text-[#1a2230]">
                  <ArrowLeft className="h-4 w-4" /> Revenir à la page de connexion
                </button>
                <Link to="/connexion/mot-de-passe-oublie" className="underline underline-offset-[3px]">
                  Mot de passe oublié&nbsp;?
                </Link>
              </div>

              <LoginAttemptFeedback
                isBlocked={attempts.isBlocked}
                remainingAttempts={attempts.remainingAttempts}
                countdown={countdown}
                formatTimeRemaining={formatTimeRemaining}
                showRemaining={showAttemptFeedback}
              />
              {errorMsg && !attempts.isBlocked && (
                <p className="mb-4 text-left text-sm text-destructive">{errorMsg}</p>
              )}

              <AuthButton disabled={submitting || attempts.isBlocked || !password}>
                {submitting ? <Spinner /> : "Me connecter"}
              </AuthButton>
            </form>
          </>
        )}

        {(step === "link" || step === "activation") && (
          <Confirmation
            title={step === "link" ? "Vérifiez votre boîte mail" : "Votre accès est prêt"}
            body={
              step === "link"
                ? `Nous venons d'envoyer un lien de connexion à ${normalizedEmail}. Il est valable 30 minutes. Pensez à regarder vos courriers indésirables.`
                : `Vous êtes bien inscrit. Nous venons d'envoyer à ${normalizedEmail} un lien pour activer votre accès. Il est valable 7 jours.`
            }
            busy={sendingLink}
            cooldown={cooldown}
            onResend={() => void requestLink(step === "link" ? "login" : "activation")}
            onChangeEmail={backToEmail}
          />
        )}

        {step === "unknown" && (
          <>
            <Title>Nous n'avons pas trouvé de compte</Title>
            <Subtitle>
              Aucun compte n'est associé à {normalizedEmail}. Si vous avez suivi une formation avec
              nous, essayez l'adresse utilisée lors de votre inscription, souvent votre adresse
              professionnelle. Sinon, créez un compte gratuit pour commencer.
            </Subtitle>
            <div className="flex flex-col gap-3">
              <a
                href="/#formations"
                className="flex h-14 w-full items-center justify-center rounded-[11px] bg-[#fdc500] text-base font-semibold text-[#1a2230] transition-colors hover:bg-[#ffd100] active:translate-y-px"
              >
                Créer un compte gratuitement
              </a>
              <button type="button" onClick={backToEmail} className="text-[15px] underline underline-offset-[3px] text-[#6b7686]">
                Essayer une autre adresse
              </button>
              <a
                href={`mailto:contact@supertilt.fr?subject=${encodeURIComponent("Accès à mon espace apprenant")}&body=${encodeURIComponent(`Bonjour,\n\nJe n'arrive pas à accéder à mon espace apprenant avec l'adresse ${normalizedEmail}.\n\nMerci de votre aide.`)}`}
                className="text-[15px] underline underline-offset-[3px] text-[#6b7686]"
              >
                Écrire au support
              </a>
            </div>
          </>
        )}

        {step === "throttled" && (
          <>
            <Title>Trop de tentatives</Title>
            <Subtitle>
              Vous avez fait plusieurs demandes coup sur coup. Réessayez dans quelques minutes.
            </Subtitle>
            <AuthButton type="button" onClick={backToEmail}>Revenir à la connexion</AuthButton>
          </>
        )}

        {step === "degraded" && (
          <>
            <Title>Se connecter</Title>
            <Subtitle>
              Nous n'avons pas pu identifier votre compte pour l'instant. Saisissez votre mot de
              passe, ou demandez un lien de connexion.
            </Subtitle>
            <form onSubmit={handlePasswordStep}>
              <EmailField value={email} onChange={setEmail} />
              <AuthField
                id="connexion-password-degraded"
                label="Mot de passe"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="Votre mot de passe"
                autoComplete="current-password"
                icon={<Lock className="h-[18px] w-[18px]" />}
                required
              />
              <div className="mb-6 flex justify-end text-[15px]">
                <Link to="/connexion/mot-de-passe-oublie" className="underline underline-offset-[3px]">
                  Mot de passe oublié&nbsp;?
                </Link>
              </div>
              {errorMsg && <p className="mb-4 text-left text-sm text-destructive">{errorMsg}</p>}
              <AuthButton disabled={submitting || !password || !normalizedEmail.includes("@")}>
                {submitting ? <Spinner /> : "Me connecter"}
              </AuthButton>
            </form>
            <LinkFallback
              busy={sendingLink}
              cooldown={cooldown}
              disabled={!normalizedEmail.includes("@")}
              onClick={async () => { await requestLink("login"); setStep("link"); }}
            />
          </>
        )}

        <div className="mt-6 flex items-center justify-center gap-2.5 border-t border-[#eceef1] pt-6 text-[14.5px] text-[#9aa3b0]">
          <ShieldCheck className="h-[18px] w-[18px]" />
          Connexion sécurisée
        </div>
      </AuthCard>
    </AuthShell>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return (
    <AuthTitle>
      {children}
    </AuthTitle>
  );
}

function Subtitle({ children }: { children: React.ReactNode }) {
  return <p className="mb-8 text-base text-[#6b7686]">{children}</p>;
}

function EmailField({
  value, onChange, readOnly, autoFocus,
}: { value: string; onChange: (v: string) => void; readOnly?: boolean; autoFocus?: boolean }) {
  return (
    <AuthField
      id="connexion-email"
      label="Adresse e-mail"
      type="email"
      value={value}
      onChange={onChange}
      placeholder="votre.email@exemple.com"
      autoComplete="email"
      icon={<Mail className="h-[18px] w-[18px]" />}
      autoFocus={autoFocus}
      readOnly={readOnly}
      required
    />
  );
}

function LinkFallback({
  busy, cooldown, onClick, disabled,
}: { busy: boolean; cooldown: number; onClick: () => void; disabled?: boolean }) {
  return (
    <div className="mt-5 text-[15px] text-[#6b7686]">
      <button
        type="button"
        onClick={onClick}
        disabled={busy || cooldown > 0 || disabled}
        className="font-bold underline underline-offset-[3px] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy
          ? "Envoi en cours…"
          : cooldown > 0
            ? `Renvoyer un lien dans ${cooldown}s`
            : "Recevoir un lien de connexion par email"}
      </button>
    </div>
  );
}

function Confirmation({
  title, body, busy, cooldown, onResend, onChangeEmail,
}: {
  title: string;
  body: string;
  busy: boolean;
  cooldown: number;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  return (
    <>
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-[#eaf6ee]">
        <CheckCircle2 className="h-7 w-7 text-[#3f9c62]" />
      </div>
      <Title>{title}</Title>
      <Subtitle>{body}</Subtitle>
      <AuthButton type="button" onClick={onResend} disabled={busy || cooldown > 0}>
        {busy ? <Spinner /> : cooldown > 0 ? `Renvoyer dans ${cooldown}s` : "Renvoyer le lien"}
      </AuthButton>
      <button
        type="button"
        onClick={onChangeEmail}
        className="mt-4 text-[15px] underline underline-offset-[3px] text-[#6b7686]"
      >
        Utiliser une autre adresse
      </button>
    </>
  );
}
