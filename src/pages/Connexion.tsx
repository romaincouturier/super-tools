import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Lock, ShieldCheck, ArrowLeft } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { AuthCard, AuthShell, AuthTitle } from "@/components/auth/AuthShell";
import { AuthField, AuthButton } from "@/components/auth/AuthField";
import LoginAttemptFeedback from "@/components/LoginAttemptFeedback";
import { useLoginAttempts } from "@/hooks/useLoginAttempts";
import { useAuthActions } from "@/hooks/useAuthActions";
import { useIdentityResolution } from "@/hooks/useIdentityResolution";
import { useSession } from "@/hooks/useSession";
import { resolvePostLoginPath, REDIRECT_PARAM } from "@/lib/authRouting";
import { normalizeEmail } from "@/lib/stringUtils";

/**
 * Porte de connexion apprenant (W1 à W6, W9).
 * Identifiant d'abord : l'adresse décide de l'étape suivante. Si le service de
 * résolution ne répond pas, l'écran bascule en mode dégradé (chapitre 6.4).
 * Aucune étape n'ouvre de session sans mot de passe saisi : plus de lien
 * magique.
 */
type Step = "email" | "password" | "unknown" | "throttled" | "degraded";

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

  const { status: attempts, countdown, checkAttempt, logAttempt, formatTimeRemaining } = useLoginAttempts();
  const { signIn } = useAuthActions();
  const { resolve, resolving } = useIdentityResolution();

  // Session déjà ouverte : le formulaire ne s'affiche jamais (W9).
  useEffect(() => {
    if (status === "staff" || status === "learner" || status === "none") {
      navigate(
        resolvePostLoginPath({ isStaff, mustChangePassword, next, hasAccess: status !== "none" }),
        { replace: true },
      );
    }
  }, [status, isStaff, mustChangePassword, next, navigate]);

  const normalizedEmail = email.trim().toLowerCase();

  const resolveAndRoute = async (target: string) => {
    setErrorMsg(null);
    const state = await resolve(target);
    if (state === null) { setStep("degraded"); return; }
    if (state === "throttled") { setStep("throttled"); return; }
    if (state === "unknown") { setStep("unknown"); return; }
    setStep("password");
  };

  const handleEmailStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedEmail.includes("@")) return;
    await resolveAndRoute(normalizedEmail);
  };

  // Lien reçu par email (Flux A, W12) : préremplit seulement l'adresse et
  // enchaîne sur la résolution d'identité habituelle. N'ouvre jamais de
  // session automatiquement — contrairement à l'ancien lien magique.
  const emailPrefillHandled = useRef(false);
  useEffect(() => {
    if (emailPrefillHandled.current) return;
    const prefill = normalizeEmail(searchParams.get("email"));
    if (!prefill || !prefill.includes("@")) return;
    emailPrefillHandled.current = true;
    setEmail(prefill);
    void resolveAndRoute(prefill);
  }, [searchParams]);

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
      <div className="flex min-h-screen items-center justify-center bg-background">
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
            <p className="mt-5 text-[15px] text-muted-foreground">
              Vous n'avez pas encore de compte&nbsp;?{" "}
              <Link to="/academy/inscription" className="font-bold text-foreground underline underline-offset-[3px]">
                Créer un compte gratuitement
              </Link>
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
                <button type="button" onClick={backToEmail} className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
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

        {step === "unknown" && (
          <>
            <Title>Nous n'avons pas trouvé de compte</Title>
            <Subtitle>
              Aucun compte n'est associé à {normalizedEmail}. Si vous avez suivi une formation avec
              nous, essayez l'adresse utilisée lors de votre inscription, souvent votre adresse
              professionnelle. Sinon, créez un compte gratuit pour commencer.
            </Subtitle>
            <div className="flex flex-col gap-3">
              <Link
                to="/academy/inscription"
                className="flex h-14 w-full items-center justify-center rounded-[11px] bg-primary text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90 active:translate-y-px"
              >
                Créer un compte gratuitement
              </Link>
              <button type="button" onClick={backToEmail} className="text-[15px] underline underline-offset-[3px] text-muted-foreground">
                Essayer une autre adresse
              </button>
              <a
                href={`mailto:contact@supertilt.fr?subject=${encodeURIComponent("Accès à mon espace apprenant")}&body=${encodeURIComponent(`Bonjour,\n\nJe n'arrive pas à accéder à mon espace apprenant avec l'adresse ${normalizedEmail}.\n\nMerci de votre aide.`)}`}
                className="text-[15px] underline underline-offset-[3px] text-muted-foreground"
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
              Nous n'avons pas pu identifier votre compte pour l'instant. Saisissez votre adresse et
              votre mot de passe.
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
          </>
        )}

        <div className="mt-6 flex items-center justify-center gap-2.5 border-t pt-6 text-[14.5px] text-muted-foreground">
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
  return <p className="mb-8 text-base text-muted-foreground">{children}</p>;
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
