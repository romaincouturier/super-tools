import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Building2, ArrowRight, CheckCircle2 } from "lucide-react";
import SupertiltLogo from "@/components/SupertiltLogo";

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleOrgNameChange = (value: string) => {
    setOrgName(value);
    if (!orgSlug || orgSlug === generateSlug(orgName)) {
      setOrgSlug(generateSlug(value));
    }
  };

  const handleCreateOrganization = async () => {
    if (!orgName || !orgSlug) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Check if slug is available
      const { data: existingOrg } = await supabase
        .from("organizations")
        .select("id")
        .eq("slug", orgSlug)
        .single();

      if (existingOrg) {
        toast({
          title: "Identifiant déjà utilisé",
          description: "Cet identifiant est déjà pris. Veuillez en choisir un autre.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Create organization with defaults
      const { data: orgId, error } = await supabase.rpc("setup_new_organization", {
        p_org_name: orgName,
        p_org_slug: orgSlug,
        p_owner_id: user.id,
        p_owner_email: user.email || "",
      });

      if (error) throw error;

      // Update user profile with name if provided
      if (firstName || lastName) {
        await supabase
          .from("user_profiles")
          .update({
            first_name: firstName || null,
            last_name: lastName || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", user.id);
      }

      // Update default trainer name
      if (firstName && lastName) {
        await supabase
          .from("trainers")
          .update({ name: `${firstName} ${lastName}` })
          .eq("organization_id", orgId)
          .eq("is_default", true);
      }

      setStep(3);

      toast({
        title: "Organisation créée !",
        description: "Votre espace de travail est prêt.",
      });
    } catch (error) {
      console.error("Error creating organization:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer l'organisation.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <SupertiltLogo className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Bienvenue sur SuperTools</h1>
          <p className="text-muted-foreground mt-1">
            Configurons votre espace de travail
          </p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full transition-colors ${
                s === step
                  ? "bg-primary"
                  : s < step
                  ? "bg-primary/50"
                  : "bg-muted"
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Votre organisation
              </CardTitle>
              <CardDescription>
                Commençons par créer votre organisme de formation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Nom de l'organisation *</Label>
                <Input
                  id="orgName"
                  value={orgName}
                  onChange={(e) => handleOrgNameChange(e.target.value)}
                  placeholder="Mon organisme de formation"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgSlug">Identifiant unique *</Label>
                <Input
                  id="orgSlug"
                  value={orgSlug}
                  onChange={(e) => setOrgSlug(generateSlug(e.target.value))}
                  placeholder="mon-organisme"
                />
                <p className="text-xs text-muted-foreground">
                  Utilisé dans les URLs. Lettres minuscules et tirets uniquement.
                </p>
              </div>
              <Button
                className="w-full"
                onClick={() => setStep(2)}
                disabled={!orgName || !orgSlug}
              >
                Continuer
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Vos informations</CardTitle>
              <CardDescription>
                Comment devons-nous vous appeler ?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jean"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dupont"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)}>
                  Retour
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateOrganization}
                  disabled={loading}
                >
                  {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Créer mon espace
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardContent className="pt-6 text-center space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold">Tout est prêt !</h3>
                <p className="text-muted-foreground mt-1">
                  Votre organisation <strong>{orgName}</strong> a été créée avec succès.
                </p>
              </div>
              <div className="pt-2 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Vous bénéficiez du plan gratuit avec 2 formations par mois.
                  Passez à un forfait supérieur à tout moment dans les paramètres.
                </p>
                <Button className="w-full" onClick={() => navigate("/")}>
                  Commencer à utiliser SuperTools
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-center text-muted-foreground">
          En créant une organisation, vous acceptez nos{" "}
          <a href="/politique-confidentialite" className="underline">
            conditions d'utilisation
          </a>
          .
        </p>
      </div>
    </div>
  );
};

export default Onboarding;
