import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import supertiltLogo from "@/assets/supertilt-logo-anthracite-transparent.png";

const CANALS = [
  { value: "mail", label: "Email" },
  { value: "telephone", label: "Téléphone" },
  { value: "formulaire", label: "Formulaire" },
  { value: "autre", label: "Autre" },
];

const PROBLEM_TYPES = [
  { value: "contenu", label: "Contenu" },
  { value: "organisation", label: "Organisation" },
  { value: "logistique", label: "Logistique" },
  { value: "technique", label: "Technique" },
  { value: "facturation", label: "Facturation" },
  { value: "relationnel", label: "Relationnel" },
  { value: "autre", label: "Autre" },
];

const SEVERITIES = [
  { value: "mineure", label: "Mineure", description: "Gêne légère, sans impact significatif" },
  { value: "significative", label: "Significative", description: "Impact notable sur la qualité" },
  { value: "majeure", label: "Majeure", description: "Problème grave nécessitant une action urgente" },
];

const ReclamationPublic = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [reclamationId, setReclamationId] = useState<string | null>(null);

  // Form state
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [canal, setCanal] = useState("formulaire");
  const [problemType, setProblemType] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Lien invalide : token manquant.");
      setLoading(false);
      return;
    }

    const fetchReclamation = async () => {
      try {
        const { data, error: fetchErr } = await supabase
          .from("reclamations")
          .select("*")
          .eq("token", token)
          .single();

        if (fetchErr || !data) {
          setError("Ce lien de réclamation est invalide ou a expiré.");
          setLoading(false);
          return;
        }

        const rec = data as any;
        setReclamationId(rec.id);

        // If already submitted (has description), show confirmation
        if (rec.description && rec.status !== "draft") {
          setSubmitted(true);
        } else {
          // Pre-fill if data exists
          if (rec.client_name) setClientName(rec.client_name);
          if (rec.client_email) setClientEmail(rec.client_email);
        }
      } catch (e) {
        console.error("Failed to load reclamation", e);
        setError("Impossible de charger ce formulaire.");
      } finally {
        setLoading(false);
      }
    };

    fetchReclamation();
  }, [token]);

  const handleSubmit = async () => {
    if (!reclamationId) return;

    if (!clientName.trim()) {
      toast({ title: "Nom requis", description: "Veuillez indiquer votre nom ou celui de votre structure.", variant: "destructive" });
      return;
    }
    if (!clientEmail.trim()) {
      toast({ title: "Email requis", description: "Veuillez indiquer votre adresse email.", variant: "destructive" });
      return;
    }
    if (!problemType) {
      toast({ title: "Type de problème requis", description: "Veuillez sélectionner le type de problème.", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Description requise", description: "Veuillez décrire le problème rencontré.", variant: "destructive" });
      return;
    }
    if (!severity) {
      toast({ title: "Gravité requise", description: "Veuillez estimer la gravité du problème.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateErr } = await supabase
        .from("reclamations")
        .update({
          client_name: clientName.trim(),
          client_email: clientEmail.trim(),
          canal,
          problem_type: problemType,
          description: description.trim(),
          severity,
          status: "open",
          date_reclamation: new Date().toISOString().split("T")[0],
        })
        .eq("id", reclamationId);

      if (updateErr) throw updateErr;

      setSubmitted(true);
      toast({ title: "Réclamation envoyée", description: "Votre réclamation a bien été enregistrée. Nous reviendrons vers vous rapidement." });
    } catch (e) {
      console.error("Failed to submit reclamation", e);
      toast({ title: "Erreur", description: "Impossible d'envoyer la réclamation. Veuillez réessayer.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <AlertTriangle className="w-12 h-12 text-destructive" />
            <p className="text-center text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-4 pt-6">
            <CheckCircle2 className="w-16 h-16 text-green-500" />
            <h2 className="text-xl font-semibold text-center">Réclamation enregistrée</h2>
            <p className="text-center text-muted-foreground">
              Merci pour votre retour. Nous avons bien reçu votre réclamation et nous reviendrons vers vous dans les meilleurs délais.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img src={supertiltLogo} alt="Supertilt" className="h-12" />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Formulaire de réclamation</CardTitle>
            <CardDescription>
              Vous pouvez nous faire part de tout mécontentement ou problème rencontré. Ce formulaire nous aidera à traiter votre demande rapidement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Client name */}
            <div className="space-y-2">
              <Label htmlFor="client_name">Nom / Structure *</Label>
              <Input
                id="client_name"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Votre nom ou celui de votre organisation"
              />
            </div>

            {/* Client email */}
            <div className="space-y-2">
              <Label htmlFor="client_email">Email *</Label>
              <Input
                id="client_email"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="votre@email.com"
              />
            </div>

            {/* Canal */}
            <div className="space-y-2">
              <Label>Canal de la réclamation</Label>
              <Select value={canal} onValueChange={setCanal}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CANALS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Problem type */}
            <div className="space-y-2">
              <Label>Type de problème *</Label>
              <Select value={problemType} onValueChange={setProblemType}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner..." />
                </SelectTrigger>
                <SelectContent>
                  {PROBLEM_TYPES.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description du problème *</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Décrivez le problème rencontré avec le plus de détails possible..."
                rows={5}
              />
            </div>

            {/* Severity */}
            <div className="space-y-3">
              <Label>Gravité estimée *</Label>
              <RadioGroup value={severity} onValueChange={setSeverity} className="space-y-2">
                {SEVERITIES.map((s) => (
                  <div key={s.value} className="flex items-start space-x-3">
                    <RadioGroupItem value={s.value} id={`severity-${s.value}`} className="mt-1" />
                    <div>
                      <Label htmlFor={`severity-${s.value}`} className="font-medium cursor-pointer">
                        {s.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{s.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

            {/* Submit */}
            <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Envoyer ma réclamation
            </Button>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center mt-6 text-xs text-muted-foreground">
          <Link to="/politique-confidentialite" className="underline hover:text-foreground">
            Politique de confidentialité
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ReclamationPublic;
