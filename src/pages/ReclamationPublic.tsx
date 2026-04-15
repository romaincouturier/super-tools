import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { rpc } from "@/lib/supabase-rpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import supertiltLogo from "@/assets/supertilt-logo-anthracite-transparent.png";
import { NATURES, CANALS, PROBLEM_TYPES, SEVERITIES } from "@/lib/reclamationConstants";

const ReclamationPublic = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [reclamationId, setReclamationId] = useState<string | null>(null);

  // Form state
  const [nature, setNature] = useState("reclamation");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [canal, setCanal] = useState("formulaire");
  const [problemType, setProblemType] = useState("");
  const [attenduInitial, setAttenduInitial] = useState("");
  const [resultatConstate, setResultatConstate] = useState("");
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
        const { data, error: fetchErr } = await rpc.getReclamationByToken(token);

        if (fetchErr || !data) {
          setError("Ce lien de réclamation est invalide ou a expiré.");
          setLoading(false);
          return;
        }

        const rec = data;
        setReclamationId(rec.id);

        if (rec.description && rec.status !== "draft") {
          setSubmitted(true);
        } else {
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
      const { error: updateErr } = await rpc.updateReclamationByToken(token!, {
        client_name: clientName.trim(),
        client_email: clientEmail.trim(),
        canal,
        nature,
        problem_type: problemType,
        attendu_initial: attenduInitial.trim() || null,
        resultat_constate: resultatConstate.trim() || null,
        description: description.trim(),
        severity,
        status: "open",
        date_reclamation: new Date().toISOString().split("T")[0],
      });

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
        <Spinner size="lg" className="text-primary" />
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
              Vous pouvez nous faire part de tout mécontentement, aléa ou difficulté rencontré. Ce formulaire nous aidera à traiter votre demande rapidement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Nature (Indicateur 30) */}
            <div className="space-y-3">
              <Label>Nature du signalement *</Label>
              <RadioGroup value={nature} onValueChange={setNature} className="space-y-2">
                {NATURES.map((n) => (
                  <div key={n.value} className="flex items-start space-x-3">
                    <RadioGroupItem value={n.value} id={`nature-${n.value}`} className="mt-1" />
                    <div>
                      <Label htmlFor={`nature-${n.value}`} className="font-medium cursor-pointer">
                        {n.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{n.description}</p>
                    </div>
                  </div>
                ))}
              </RadioGroup>
            </div>

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
                <SelectTrigger><SelectValue /></SelectTrigger>
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
                <SelectTrigger><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                <SelectContent>
                  {PROBLEM_TYPES.map((pt) => (
                    <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Attendu initial (Indicateur 30) */}
            <div className="space-y-2">
              <Label htmlFor="attendu_initial">Attendu initial</Label>
              <VoiceTextarea
                id="attendu_initial"
                value={attenduInitial}
                onValueChange={setAttenduInitial}
                onChange={(e) => setAttenduInitial(e.target.value)}
                placeholder="Ce que vous attendiez de la formation ou de la prestation..."
                rows={3}
              />
            </div>

            {/* Résultat constaté (Indicateur 30) */}
            <div className="space-y-2">
              <Label htmlFor="resultat_constate">Résultat constaté</Label>
              <VoiceTextarea
                id="resultat_constate"
                value={resultatConstate}
                onValueChange={setResultatConstate}
                onChange={(e) => setResultatConstate(e.target.value)}
                placeholder="Ce qui s'est réellement passé..."
                rows={3}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description détaillée *</Label>
              <VoiceTextarea
                id="description"
                value={description}
                onValueChange={setDescription}
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
              {submitting && <Spinner className="mr-2" />}
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
