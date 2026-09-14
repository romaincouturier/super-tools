import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Lock, ShieldCheck } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { AuthShell, AuthCard } from "@/components/auth/AuthShell";
import { AuthField, AuthButton } from "@/components/auth/AuthField";
import LoginAttemptFeedback from "@/components/LoginAttemptFeedback";
import { useLoginAttempts } from "@/hooks/useLoginAttempts";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import { useAuthActions } from "@/hooks/useAuthActions";
import { useSession } from "@/hooks/useSession";
import { resolvePostLoginPath, REDIRECT_PARAM } from "@/lib/authRouting";

/** Délai avant de pouvoir redemander un lien, garde-fou côté écran. */
const RESEND_COOLDOWN_S = 60;

export default function Connexion() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const next = searchParams.get(REDIRECT_PARAM);
  const { status, isStaff, mustChangePassword } = useSession();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAttemptFeedback, setShowAttemptFeedback] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const { status: attempts, countdown, checkAttempt, logAttempt, formatTimeRemaining } = useLoginAttempts();
  const { signIn } = useAuthActions();
  const { loading: sendingLink, invoke: sendLink } = useEdgeFunction("send-learner-magic-link", {
    errorMessage: "Envoi impossible pour le moment.",
  });

  // Session déjà ouverte : on ne montre jamais le formulaire (W9).
  useEffect(() => {
    if (status === "staff" || status === "learner") {
      navigate(resolvePostLoginPath({ isStaff, mustChangePassword, next }), { replace: true });
    }
  }, [status, isStaff, mustChangePassword, next, navigate]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setShowAttemptFeedback(false);

    const normalized = email.trim().toLowerCase();
    const allowed = await checkAttempt(normalized);
    if (!allowed) {
      setSubmitting(false);
      return;
    }

    const outcome = await signIn(normalized, password);
    if (!outcome.ok) {
      await logAttempt(normalized, false);
      setShowAttemptFeedback(true);
      setErrorMsg("Email ou mot de passe incorrect. Vous pouvez réessayer, ou recevoir un lien de connexion par email.");
      setSubmitting(false);
      return;
    }

    void logAttempt(normalized, true);
    navigate(
      resolvePostLoginPath({
        isStaff: outcome.isStaff,
        mustChangePassword: outcome.mustChangePassword,
        next,
      }),
      { replace: true },
    );
  };

  const handleSendLink = async () => {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@") || cooldown > 0) return;
    setErrorMsg(null);
    const result = await sendLink({ email: normalized });
    if (result !== null) {
      setLinkSent(true);
      setCooldown(RESEND_COOLDOWN_S);
    }
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
        <h1 className="mb-2.5 text-[26px] font-semibold leading-tight tracking-[-0.7px] sm:text-[31px]">
          Connexion à votre espace de formation
        </h1>
        <p className="mb-8 text-base text-[#6b7686]">
          Retrouvez vos formations, vos ressources et votre progression.
        </p>

        <form onSubmit={handleSubmit}>
          <AuthField
            id="connexion-email"
            label="Adresse e-mail"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="votre.email@exemple.com"
            autoComplete="email"
            icon={<Mail className="h-[18px] w-[18px]" />}
            autoFocus
            required
          />
          <AuthField
            id="connexion-password"
            label="Mot de passe"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="Votre mot de passe"
            autoComplete="current-password"
            icon={<Lock className="h-[18px] w-[18px]" />}
            required
          />

          <div className="mb-6 flex flex-wrap items-center justify-end gap-4 text-[15px]">
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

          <AuthButton disabled={submitting || attempts.isBlocked || !email.trim() || !password}>
            {submitting ? <Spinner /> : "Se connecter"}
          </AuthButton>
        </form>

        <div className="mt-5 text-[15px] text-[#6b7686]">
          {linkSent ? (
            <p className="rounded-[11px] bg-[#eaf6ee] px-4 py-3 text-left text-[14.5px] text-[#1a2230]">
              Si un accès existe pour cette adresse, un lien de connexion vient d'être envoyé.
              Pensez à regarder vos courriers indésirables.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleSendLink}
              disabled={sendingLink || cooldown > 0 || !email.includes("@")}
              className="font-bold underline underline-offset-[3px] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sendingLink
                ? "Envoi en cours…"
                : cooldown > 0
                  ? `Renvoyer un lien dans ${cooldown}s`
                  : "Recevoir un lien de connexion par email"}
            </button>
          )}
        </div>

        <p className="mt-5 text-[15px] text-[#6b7686]">
          Vous n'avez pas encore de compte&nbsp;?{" "}
          <button
            type="button"
            onClick={handleSendLink}
            disabled={sendingLink || cooldown > 0 || !email.includes("@")}
            className="font-bold text-[#1a2230] underline underline-offset-[3px] disabled:opacity-50"
          >
            Activer mon accès
          </button>
        </p>

        <div className="mt-6 flex items-center justify-center gap-2.5 border-t border-[#eceef1] pt-6 text-[14.5px] text-[#9aa3b0]">
          <ShieldCheck className="h-[18px] w-[18px]" />
          Connexion sécurisée
        </div>
      </AuthCard>
    </AuthShell>
  );
}
