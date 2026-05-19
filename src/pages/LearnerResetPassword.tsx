import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Lock, CheckCircle2, Shield, User } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import SupertiltLogo from "@/components/SupertiltLogo";
import PasswordStrengthIndicator from "@/components/PasswordStrengthIndicator";
import { validatePassword } from "@/lib/passwordValidation";

const LearnerResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [saved, setSaved] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const type = hashParams.get("type");

      if (session || type === "recovery") {
        setIsValidSession(true);
      } else {
        toast({
          title: "Session invalide",
          description: "Le lien de réinitialisation a expiré ou est invalide. Veuillez redemander un lien.",
          variant: "destructive",
        });
        navigate("/apprenant");
      }
      setCheckingSession(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsValidSession(true);
        setCheckingSession(false);
      }
    });

    checkSession();
    return () => subscription.unsubscribe();
  }, [navigate, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = validatePassword(password);
    if (!validation.isValid) {
      toast({
        title: "Mot de passe non conforme",
        description: "Le mot de passe ne respecte pas tous les critères de sécurité.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Erreur",
        description: "Les mots de passe ne correspondent pas.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSaved(true);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" className="text-primary" />
      </div>
    );
  }

  if (!isValidSession) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="flex items-center px-8 py-4">
        <SupertiltLogo className="h-8" />
      </div>

      {/* Main content */}
      <div className="flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-4xl bg-white rounded-2xl shadow-lg overflow-hidden flex">

          {/* Left: form */}
          <div className="flex-1 p-10">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <Lock className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-1">Nouveau mot de passe</h1>
            <p className="text-sm text-muted-foreground mb-8">
              Choisissez un nouveau mot de passe pour sécuriser votre compte.
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">Nouveau mot de passe</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <PasswordStrengthIndicator password={password} />
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full font-semibold"
                disabled={isLoading || !validatePassword(password).isValid}
              >
                {isLoading ? <Spinner /> : "Enregistrer mon nouveau mot de passe"}
              </Button>
            </form>

            {saved && (
              <div className="mt-4 flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Votre nouveau mot de passe a bien été enregistré.
              </div>
            )}

            <div className="mt-6 text-center text-xs text-muted-foreground">
              Besoin d'aide ? Écrivez-nous à{" "}
              <a href="mailto:contact@supertilt.fr" className="underline hover:text-foreground transition-colors">
                contact@supertilt.fr
              </a>
            </div>
          </div>

          {/* Right: illustration + info cards */}
          <div className="w-80 bg-gray-50 border-l p-8 flex flex-col gap-6 justify-center">
            {/* Illustration placeholder */}
            <div className="flex items-center justify-center h-44 rounded-xl bg-white border">
              <div className="relative">
                <div className="w-24 h-18 bg-gray-100 rounded-lg border-2 border-gray-200 flex items-center justify-center">
                  <Lock className="w-10 h-10 text-gray-400" />
                </div>
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-white" />
                </div>
              </div>
            </div>

            {/* Info card 1 */}
            <div className="bg-white rounded-xl border p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Mot de passe sécurisé</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Utilisez un mot de passe unique que vous n'utilisez pas ailleurs.
                </p>
              </div>
            </div>

            {/* Info card 2 */}
            <div className="bg-white rounded-xl border p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <User className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Connexion ensuite</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Une fois enregistré, vous pourrez vous reconnecter à votre espace.
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default LearnerResetPassword;
