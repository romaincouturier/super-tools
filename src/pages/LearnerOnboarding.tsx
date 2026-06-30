import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, Eye, EyeOff, CheckCircle2, AlertCircle, Lock, Mail, Shield, ArrowLeft } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import SupertiltLogo from "@/components/SupertiltLogo";
import { useLoginAttempts } from "@/hooks/useLoginAttempts";
import LoginAttemptFeedback from "@/components/LoginAttemptFeedback";

type Mode = "loading" | "error" | "create" | "login" | "forgot" | "success";

function checkPasswordStrength(pwd: string): { score: number; hints: string[] } {
  const hints: string[] = [];
  if (pwd.length < 8) hints.push("Au moins 8 caractères");
  if (!/[A-Z]/.test(pwd)) hints.push("Une majuscule");
  if (!/[a-z]/.test(pwd)) hints.push("Une minuscule");
  if (!/[0-9]/.test(pwd)) hints.push("Un chiffre");
  if (!/[^A-Za-z0-9]/.test(pwd)) hints.push("Un caractère spécial (!, @, #…)");
  return { score: 5 - hints.length, hints };
}

export default function LearnerOnboarding() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode, setMode] = useState<Mode>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [usedTokenBanner, setUsedTokenBanner] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);
  const [showAttemptFeedback, setShowAttemptFeedback] = useState(false);

  const { status, countdown, checkAttempt, logAttempt, formatTimeRemaining } = useLoginAttempts();

  const strength = checkPasswordStrength(password);
  const isStrongEnough = strength.score >= 4;

  useEffect(() => {
    if (!token) {
      setMode("error");
      setErrorMsg("Lien invalide. Veuillez utiliser le lien reçu par email.");
      return;
    }

    supabase.rpc("preview_learner_token", { p_token: token })
      .then(({ data, error }) => {
        if (error || !data) {
          setMode("error");
          setErrorMsg("Lien invalide ou expiré.");
          return;
        }
        const result = data as { status: string; email?: string; has_account?: boolean };
        if (result.status === "invalid") {
          setMode("error");
          setErrorMsg("Ce lien n'est pas valide.");
        } else if (result.status === "expired") {
          setMode("error");
          setErrorMsg("Ce lien a expiré. Connectez-vous directement depuis votre espace apprenant ou contactez votre formateur.");
        } else {
          setEmail(result.email ?? "");
          setHasAccount(!!result.has_account);
          if (result.status === "used" || result.has_account) {
            setUsedTokenBanner(result.status === "used");
            setMode("login");
          } else {
            setMode("create");
          }
        }
      });
  }, [token]);

  useEffect(() => () => {
    if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
  }, []);

  const redirectToPortal = () => {
    setMode("success");
    redirectTimerRef.current = setTimeout(() => navigate("/espace-apprenant"), 800);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStrongEnough || !token) return;
    setSubmitting(true);
    setErrorMsg(null);

    const { data: created, error: createErr } = await supabase.functions.invoke(
      "create-learner-account",
      { body: { token, password } },
    );

    if (createErr || (created && (created as { error?: string }).error)) {
      const errMsg =
        (created as { error?: string } | null)?.error ||
        createErr?.message ||
        "";
      if (errMsg === "already_exists" || errMsg.toLowerCase().includes("already")) {
        setErrorMsg("Ce compte existe déjà. Connectez-vous avec votre mot de passe.");
        setMode("login");
      } else {
        setErrorMsg(errMsg || "Impossible de créer le compte. Réessayez.");
      }
      setSubmitting(false);
      return;
    }

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      setErrorMsg(signInErr.message);
      setSubmitting(false);
      return;
    }

    supabase.rpc("consume_learner_token", { p_token: token });
    redirectToPortal();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setShowAttemptFeedback(false);

    const allowed = await checkAttempt(email);
    if (!allowed) {
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      await logAttempt(email, false);
      setShowAttemptFeedback(true);
      setErrorMsg("Mot de passe incorrect. Réessayez ou réinitialisez votre mot de passe.");
      setSubmitting(false);
      return;
    }

    logAttempt(email, true);
    redirectToPortal();
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    await supabase.functions.invoke("send-password-reset", {
      body: { email, redirectUrl: `${window.location.origin}/apprenant/reset-password` },
    });
    setForgotSent(true);
    setSubmitting(false);
  };

  const strengthColor = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-400", "bg-emerald-500"][strength.score] ?? "bg-gray-200";

  // ── Loading / success / error states ──────────────────────────────────────

  if (mode === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  if (mode === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <p className="text-lg font-medium">Connexion réussie — redirection…</p>
        </div>
      </div>
    );
  }

  if (mode === "error") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <SupertiltLogo className="h-10 mb-6" />
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 space-y-4 text-center">
            <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
            <p className="text-muted-foreground">{errorMsg}</p>
            <Button asChild variant="outline">
              <Link to="/espace-apprenant">Accéder à mon espace apprenant</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Forgot password — full 2-column layout ────────────────────────────────

  if (mode === "forgot") {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-between px-8 py-4">
          <SupertiltLogo className="h-8" />
          <button
            type="button"
            onClick={() => { setMode("login"); setForgotSent(false); setErrorMsg(null); }}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la connexion
          </button>
        </div>

        <div className="flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-lg overflow-hidden flex">

            {/* Left: form */}
            <div className="flex-1 p-10">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                <Lock className="w-7 h-7 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-1">Mot de passe oublié</h1>
              <p className="text-sm text-muted-foreground mb-8">
                Indiquez l'adresse e-mail utilisée pour votre compte.<br />
                Nous vous enverrons un lien pour définir un nouveau mot de passe.
              </p>

              <form onSubmit={handleForgot} className="space-y-5">
                <div className="space-y-1.5">
                  <Label htmlFor="forgot-email">Adresse e-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      placeholder="exemple@entreprise.com"
                    />
                  </div>
                </div>

                <Button type="submit" className="w-full font-semibold" disabled={submitting}>
                  {submitting ? <Spinner /> : "Envoyer le lien de réinitialisation"}
                </Button>
              </form>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={() => { setMode("login"); setForgotSent(false); setErrorMsg(null); }}
                  className="text-sm underline text-foreground hover:text-primary transition-colors"
                >
                  Je me souviens de mon mot de passe
                </button>
              </div>

              {forgotSent && (
                <div className="mt-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  Si cette adresse existe dans notre système, un e-mail vient d'être envoyé.
                </div>
              )}

              <div className="mt-6 text-center text-xs text-muted-foreground">
                Besoin d'aide ? Écrivez-nous à{" "}
                <a href="mailto:contact@supertilt.fr" className="underline hover:text-foreground transition-colors">
                  contact@supertilt.fr
                </a>
              </div>
            </div>

            {/* Right: info panel */}
            <div className="w-80 bg-gray-50 border-l p-8 flex flex-col gap-6 justify-center">
              <div className="flex items-center justify-center h-44 rounded-xl bg-white border">
                <div className="relative">
                  <div className="w-20 h-16 bg-gray-100 rounded border-2 border-gray-200 flex items-center justify-center">
                    <Mail className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Mail className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Vérifiez votre boîte mail</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Vous recevrez un e-mail contenant un lien valable pendant 24 h.
                  </p>
                </div>
              </div>

              <div className="bg-white rounded-xl border p-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Pas d'e-mail reçu ?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Si vous ne voyez rien, pensez à vérifier vos courriers indésirables.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ── Create / login — existing card layout ─────────────────────────────────

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-2 shadow-xl">
        <div className="text-center space-y-3 p-6 pb-0">
          <SupertiltLogo className="h-10 mx-auto" />
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">
            {mode === "create" ? "Créer mon compte" : "Se connecter"}
          </h2>
          <p className="text-sm text-muted-foreground pb-2">
            {mode === "create"
              ? "Choisissez un mot de passe pour accéder à votre formation"
              : "Connectez-vous avec votre email et votre mot de passe"}
          </p>
        </div>

        <CardContent className="space-y-4">
          {usedTokenBanner && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
              Ce lien d'accès a déjà été utilisé. Connectez-vous avec votre mot de passe.
            </div>
          )}

          <form onSubmit={mode === "create" ? handleCreate : handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                  autoFocus
                  autoComplete={mode === "create" ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {mode === "create" && password.length > 0 && (
              <div className="space-y-2">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        isStrongEnough
                          ? "bg-emerald-500"
                          : i < strength.score
                            ? strengthColor
                            : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                {strength.hints.length > 0 && (
                  <ul className="text-xs text-muted-foreground space-y-0.5">
                    {strength.hints.map((h) => (
                      <li key={h} className="flex items-center gap-1">
                        <span className="text-orange-400">·</span> {h}
                      </li>
                    ))}
                  </ul>
                )}
                {isStrongEnough && (
                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Mot de passe fort
                  </p>
                )}
              </div>
            )}

            {mode === "login" && (
              <LoginAttemptFeedback
                isBlocked={status.isBlocked}
                remainingAttempts={status.remainingAttempts}
                countdown={countdown}
                formatTimeRemaining={formatTimeRemaining}
                showRemaining={showAttemptFeedback}
              />
            )}

            {errorMsg && !status.isBlocked && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}

            <Button
              type="submit"
              className="w-full font-semibold"
              disabled={submitting || status.isBlocked || !password || (mode === "create" && !isStrongEnough)}
            >
              {submitting
                ? <Spinner />
                : mode === "create"
                  ? "Créer mon compte et accéder à ma formation"
                  : "Me connecter"}
            </Button>

            {!hasAccount && (
              <div className="text-center text-sm text-muted-foreground">
                {mode === "create" ? (
                  <>
                    Vous avez déjà un compte ?{" "}
                    <button
                      type="button"
                      onClick={() => { setMode("login"); setPassword(""); setErrorMsg(null); }}
                      className="text-primary hover:underline font-medium"
                    >
                      Se connecter
                    </button>
                  </>
                ) : (
                  <>
                    Vous n'avez pas encore de compte ?{" "}
                    <button
                      type="button"
                      onClick={() => { setMode("create"); setPassword(""); setErrorMsg(null); setUsedTokenBanner(false); }}
                      className="text-primary hover:underline font-medium"
                    >
                      Créer un compte
                    </button>
                  </>
                )}
              </div>
            )}

            {mode === "login" && (
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => { setMode("forgot"); setErrorMsg(null); setShowAttemptFeedback(false); }}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
