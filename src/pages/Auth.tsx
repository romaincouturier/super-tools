import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import SupertiltLogo from "@/components/SupertiltLogo";
import ForgotPasswordDialog from "@/components/ForgotPasswordDialog";
import PasswordStrengthIndicator from "@/components/PasswordStrengthIndicator";
import LoginAttemptFeedback from "@/components/LoginAttemptFeedback";
import { validatePassword } from "@/lib/passwordValidation";
import { useLoginAttempts } from "@/hooks/useLoginAttempts";
import { cn } from "@/lib/utils";

// Admin email - has full access to all modules
const ADMIN_EMAIL = "romain@supertilt.fr";

const Auth = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [showAttemptFeedback, setShowAttemptFeedback] = useState(false);
  const [shakeForm, setShakeForm] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { status, countdown, checkAttempt, logAttempt, formatTimeRemaining } = useLoginAttempts();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          // Check if user must change password
          const { data: metadata } = await supabase
            .from("user_security_metadata")
            .select("must_change_password")
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (metadata?.must_change_password) {
            navigate("/force-password-change");
          } else {
            navigate("/");
          }
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // Check if user must change password
        const { data: metadata } = await supabase
          .from("user_security_metadata")
          .select("must_change_password")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (metadata?.must_change_password) {
          navigate("/force-password-change");
        } else {
          navigate("/");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        // Vérifier si la connexion est autorisée (anti-brute force)
        const isAllowed = await checkAttempt(email);
        if (!isAllowed) {
          setIsLoading(false);
          return;
        }

        // Appliquer le délai progressif si nécessaire
        if (status.delaySeconds > 0) {
          await new Promise((resolve) => setTimeout(resolve, status.delaySeconds * 1000));
        }

        // Note: Login is now allowed for all users created via onboarding
        // Access control is handled per-module via has_module_access()

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          // Logger l'échec
          await logAttempt(email, false);
          setShowAttemptFeedback(true);
          setShakeForm(true);
          setTimeout(() => setShakeForm(false), 500);
          throw error;
        }

        // Logger le succès
        await logAttempt(email, true);
        setShowAttemptFeedback(false);
        
        // Check if user must change password (from onboarding)
        if (data.user) {
          const { data: metadata } = await supabase
            .from("user_security_metadata")
            .select("must_change_password")
            .eq("user_id", data.user.id)
            .maybeSingle();

          if (metadata?.must_change_password) {
            navigate("/force-password-change");
            return;
          }

          // Check if current password is weak - if so, force password change
          const passwordValidation = validatePassword(password);
          if (!passwordValidation.isValid) {
            // Set flag to force password change
            await supabase
              .from("user_security_metadata")
              .upsert({
                user_id: data.user.id,
                must_change_password: true,
              }, { onConflict: "user_id" });

            toast({
              title: "Mot de passe trop faible",
              description: "Votre mot de passe ne respecte pas les critères de sécurité. Veuillez le modifier.",
              variant: "destructive",
            });
            navigate("/force-password-change");
            return;
          }
        }

        toast({
          title: "Connexion réussie",
          description: "Bienvenue !",
        });
      } else {
        // Only admin can create accounts via signup form
        // Other users are created via onboarding process
        if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
          toast({
            title: "Inscription non autorisée",
            description: "Les nouveaux utilisateurs doivent être ajoutés via l'interface d'administration.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        // Validate password strength
        const validation = validatePassword(password);
        if (!validation.isValid) {
          toast({
            title: "Mot de passe non conforme",
            description: "Le mot de passe ne respecte pas tous les critères de sécurité.",
            variant: "destructive",
          });
          setIsLoading(false);
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        toast({
          title: "Inscription réussie",
          description: "Vous pouvez maintenant vous connecter.",
        });
        setIsLogin(true);
      }
    } catch (error: any) {
      let message = error.message;
      if (error.message.includes("Invalid login credentials")) {
        message = "Email ou mot de passe incorrect";
      } else if (error.message.includes("User already registered")) {
        message = "Cet email est déjà utilisé";
      } else if (error.message.includes("Password should be at least")) {
        message = "Le mot de passe doit contenir au moins 6 caractères";
      }
      toast({
        title: "Erreur",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card 
        className={cn(
          "w-full max-w-md border-2 shadow-xl transition-transform",
          shakeForm && "animate-shake"
        )}
      >
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <SupertiltLogo className="h-12 mx-auto" />
          </div>
          <CardTitle className="text-2xl font-bold">
            SuperTools
          </CardTitle>
          {!isLogin && (
            <CardDescription>
              Créez votre compte
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Feedback anti-brute force */}
          {isLogin && (
            <LoginAttemptFeedback
              isBlocked={status.isBlocked}
              remainingAttempts={status.remainingAttempts}
              countdown={countdown}
              formatTimeRemaining={formatTimeRemaining}
              showRemaining={showAttemptFeedback}
            />
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="votre@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={status.isBlocked}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={status.isBlocked}
              />
              {!isLogin && <PasswordStrengthIndicator password={password} />}
            </div>
            <Button
              type="submit"
              className="w-full font-semibold"
              disabled={isLoading || status.isBlocked}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : status.isBlocked ? (
                "Connexion bloquée"
              ) : isLogin ? (
                "Se connecter"
              ) : (
                "S'inscrire"
              )}
            </Button>
          </form>
          {isLogin && (
            <div className="mt-4 text-center">
              <ForgotPasswordDialog />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
