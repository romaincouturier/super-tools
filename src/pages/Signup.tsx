import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2 } from "lucide-react";
import SupertiltLogo from "@/components/SupertiltLogo";
import PasswordStrengthIndicator from "@/components/PasswordStrengthIndicator";
import { validatePassword } from "@/lib/passwordValidation";

const plans = [
  { slug: "free", name: "Free", price: "0€/mois", desc: "1 formation, 5 participants" },
  { slug: "pro", name: "Pro", price: "49€/mois", desc: "Formations illimitées + CRM + IA" },
  { slug: "business", name: "Business", price: "149€/mois", desc: "Équipe + White-label + API" },
];

export default function Signup() {
  const [step, setStep] = useState<"plan" | "account">("plan");
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
  }, [navigate]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validatePassword(password);
    if (!validation.isValid) {
      toast({ title: "Mot de passe non conforme", description: "Le mot de passe ne respecte pas les critères de sécurité.", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/onboarding`,
          data: { full_name: fullName, plan: selectedPlan },
        },
      });
      if (error) throw error;
      toast({
        title: "Inscription réussie !",
        description: "Vérifiez votre email pour confirmer votre compte.",
      });
    } catch (error: any) {
      let message = error.message;
      if (error.message.includes("User already registered")) message = "Cet email est déjà utilisé";
      toast({ title: "Erreur", description: message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-foreground p-4">
      <Card className="w-full max-w-md border-2 shadow-xl bg-card">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <SupertiltLogo className="h-12 mx-auto" />
          </div>
          <CardTitle className="text-2xl font-bold">Créer un compte</CardTitle>
          <CardDescription>
            {step === "plan" ? "Choisissez votre plan" : "Créez votre compte"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "plan" ? (
            <div className="space-y-4">
              {plans.map((plan) => (
                <button
                  key={plan.slug}
                  type="button"
                  onClick={() => setSelectedPlan(plan.slug)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    selectedPlan === plan.slug
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">{plan.desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">{plan.price}</span>
                      {selectedPlan === plan.slug && <CheckCircle2 className="w-5 h-5 text-primary" />}
                    </div>
                  </div>
                </button>
              ))}
              <Button className="w-full font-semibold mt-4" onClick={() => setStep("account")}>
                Continuer
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Déjà un compte ?{" "}
                <Link to="/auth" className="text-primary hover:underline font-medium">Se connecter</Link>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nom complet</Label>
                <Input id="fullName" placeholder="Marie Dupont" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="votre@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                <PasswordStrengthIndicator password={password} />
              </div>
              <Button type="submit" className="w-full font-semibold" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer mon compte"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("plan")}>
                ← Retour au choix du plan
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
