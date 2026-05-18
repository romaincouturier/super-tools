import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Eye, EyeOff, CheckCircle2, AlertCircle, Lock } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import SupertiltLogo from "@/components/SupertiltLogo";

type Mode = "loading" | "error" | "create" | "login" | "success";

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

  const [mode, setMode] = useState<Mode>("loading");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // "used" token: show a contextual banner so the user knows why they're in login mode
  const [usedTokenBanner, setUsedTokenBanner] = useState(false);

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
          if (result.status === "used") {
            // Token already consumed: show login form with an explanatory banner
            setUsedTokenBanner(true);
            setMode("login");
          } else {
            // A valid fresh magic link should always let the learner choose a password
            // and be signed in automatically, even if a previous interrupted attempt
            // already created an unconfirmed auth account for this email.
            setMode("create");
          }
        }
      });
  }, [token]);

  const redirectToPortal = () => {
    setMode("success");
    // Brief success state so the user sees confirmation before the page changes
    setTimeout(() => navigate("/espace-apprenant"), 800);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStrongEnough || !token) return;
    setSubmitting(true);
    setErrorMsg(null);

    // Create the account via service-role edge function (public signups are disabled)
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

    // Sign in with the freshly created credentials
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
    if (signInErr) {
      setErrorMsg(signInErr.message);
      setSubmitting(false);
      return;
    }

    await supabase.rpc("consume_learner_token", { p_token: token });

    redirectToPortal();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErrorMsg("Mot de passe incorrect. Réessayez ou réinitialisez votre mot de passe.");
      setSubmitting(false);
      return;
    }

    redirectToPortal();
  };

  const strengthColor = ["bg-red-400", "bg-orange-400", "bg-yellow-400", "bg-green-400", "bg-emerald-500"][strength.score] ?? "bg-gray-200";

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-2 shadow-xl">
        <CardHeader className="text-center space-y-3">
          <SupertiltLogo className="h-10 mx-auto" />
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <GraduationCap className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">
            {mode === "create" ? "Créer mon compte" : "Se connecter"}
          </CardTitle>
          <CardDescription>
            {mode === "create"
              ? "Choisissez un mot de passe pour accéder à votre formation"
              : "Connectez-vous avec votre email et votre mot de passe"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Banner for already-used token */}
          {usedTokenBanner && (
            <div className="rounded-md bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">
              Ce lien d'accès a déjà été utilisé. Connectez-vous avec votre mot de passe.
            </div>
          )}

          <form onSubmit={mode === "create" ? handleCreate : handleLogin} className="space-y-4">
            {/* Email (read-only, pre-filled from token) */}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                readOnly
                className="bg-muted/50 cursor-not-allowed"
                autoComplete="email"
              />
            </div>

            {/* Password */}
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

            {/* Password strength indicator (create mode only) */}
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

            {/* Error */}
            {errorMsg && (
              <p className="text-sm text-destructive">{errorMsg}</p>
            )}

            {/* Submit */}
            <Button
              type="submit"
              className="w-full font-semibold"
              disabled={submitting || !password || (mode === "create" && !isStrongEnough)}
            >
              {submitting
                ? <Spinner />
                : mode === "create"
                  ? "Créer mon compte et accéder à ma formation"
                  : "Me connecter"}
            </Button>

            {/* Mode switcher */}
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

            {mode === "login" && (
              <div className="text-center">
                <Link to="/reset-password" className="text-xs text-muted-foreground hover:underline">
                  Mot de passe oublié ?
                </Link>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
