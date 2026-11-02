import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { VoiceTextarea } from "@/components/ui/voice-textarea";
import { CheckCircle2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { rpc } from "@/lib/supabase-rpc";
import { formatTrainingDates } from "@/lib/dateFormatters";
import {
  BESOINS,
  FREINS,
  FREQUENCE_UTILISATION,
  MISE_EN_PRATIQUE,
  OBJECTIFS_ATTEINTS,
  RECOMMANDATION,
} from "@/lib/coldEvaluationOptions";
import supertiltLogo from "@/assets/supertilt-logo-anthracite-transparent.png";

type Record_ = {
  etat: string;
  first_name: string | null;
  training_name: string | null;
  training_start_date: string | null;
  training_end_date: string | null;
};

const Choice = ({ options, value, onChange, name }: { options: { value: string; label: string }[]; value: string; onChange: (v: string) => void; name: string }) => (
  <RadioGroup value={value} onValueChange={onChange} className="space-y-2">
    {options.map((o) => (
      <div key={o.value} className="flex items-center gap-2">
        <RadioGroupItem value={o.value} id={`${name}-${o.value}`} />
        <Label htmlFor={`${name}-${o.value}`} className="font-normal">{o.label}</Label>
      </div>
    ))}
  </RadioGroup>
);

const Multi = ({ options, value, onChange, name }: { options: { value: string; label: string }[]; value: string[]; onChange: (v: string[]) => void; name: string }) => (
  <div className="space-y-2">
    {options.map((o) => (
      <div key={o.value} className="flex items-center gap-2">
        <Checkbox
          id={`${name}-${o.value}`}
          checked={value.includes(o.value)}
          onCheckedChange={(c) => onChange(c ? [...value, o.value] : value.filter((v) => v !== o.value))}
        />
        <Label htmlFor={`${name}-${o.value}`} className="font-normal">{o.label}</Label>
      </div>
    ))}
  </div>
);

const ParticipantColdEvaluation = () => {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [record, setRecord] = useState<Record_ | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [miseEnPratique, setMiseEnPratique] = useState("");
  const [frequence, setFrequence] = useState("");
  const [exemple, setExemple] = useState("");
  const [niveau, setNiveau] = useState<number | null>(null);
  const [freins, setFreins] = useState<string[]>([]);
  const [freinsDetails, setFreinsDetails] = useState("");
  const [effets, setEffets] = useState("");
  const [objectifs, setObjectifs] = useState("");
  const [besoins, setBesoins] = useState<string[]>([]);
  const [recommandation, setRecommandation] = useState("");
  const [temoignage, setTemoignage] = useState("");
  const [consent, setConsent] = useState(false);
  const [commentaires, setCommentaires] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!token) return;
      const { data, error: err } = await rpc.getParticipantColdEvaluationByToken(token);
      if (err || !data) {
        setError("Impossible d'ouvrir ce questionnaire (lien invalide ou expiré).");
      } else {
        setRecord(data as unknown as Record_);
        if ((data as unknown as Record_).etat !== "soumis") await rpc.markParticipantColdEvaluationOpened(token);
      }
      setLoading(false);
    };
    load();
  }, [token]);

  const submit = async () => {
    if (!miseEnPratique || !objectifs || !recommandation) {
      toast({ title: "Champs requis", description: "Merci de répondre aux questions marquées d'un astérisque.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error: err } = await rpc.submitParticipantColdEvaluation(token!, {
      mise_en_pratique: miseEnPratique,
      frequence_utilisation: frequence,
      exemple_application: exemple,
      niveau_maitrise: niveau,
      freins,
      freins_details: freinsDetails,
      effets_constates: effets,
      objectifs_atteints: objectifs,
      besoins_complementaires: besoins,
      recommandation,
      temoignage,
      consent_publication: temoignage.trim() ? consent : false,
      commentaires_libres: commentaires,
    });
    setSubmitting(false);
    if (err) {
      toast({ title: "Erreur", description: "Votre réponse n'a pas pu être enregistrée. Merci de réessayer.", variant: "destructive" });
      return;
    }
    setRecord((r) => (r ? { ...r, etat: "soumis" } : r));
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Spinner size="lg" /></div>;
  }

  if (error || !record) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <img src={supertiltLogo} alt="SuperTilt" className="h-12 mx-auto mb-4" />
            <CardTitle className="text-destructive">Accès impossible</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">{error}</CardContent>
        </Card>
      </div>
    );
  }

  if (record.etat === "soumis") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <img src={supertiltLogo} alt="SuperTilt" className="h-12 mx-auto mb-4" />
            <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-2" />
            <CardTitle>Merci pour votre retour !</CardTitle>
            <CardDescription>Vos réponses nous aident à améliorer nos formations.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const dates = record.training_start_date ? formatTrainingDates(record.training_start_date, record.training_end_date) : "";

  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center space-y-3">
          <img src={supertiltLogo} alt="SuperTilt" className="h-14 mx-auto" />
          <h1 className="text-2xl font-bold">Et depuis la formation ?</h1>
          <p className="text-muted-foreground">
            {record.training_name}{dates ? ` · ${dates}` : ""}
          </p>
          <p className="text-sm text-muted-foreground">
            {record.first_name ? `${record.first_name}, q` : "Q"}uelques questions sur ce que vous avez pu mettre en pratique. Comptez 3 minutes. {/* demo-safe: page publique vue par le participant lui-meme */}
          </p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-lg">Mise en pratique</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Avez-vous mis en pratique ce que vous avez appris ?<span className="text-destructive ml-1">*</span></Label>
              <Choice name="mep" options={MISE_EN_PRATIQUE} value={miseEnPratique} onChange={setMiseEnPratique} />
            </div>
            <div className="space-y-2">
              <Label>À quelle fréquence l'utilisez-vous ?</Label>
              <Choice name="freq" options={FREQUENCE_UTILISATION} value={frequence} onChange={setFrequence} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exemple">Un exemple concret de mise en pratique ?</Label>
              <VoiceTextarea id="exemple" value={exemple} onChange={(e) => setExemple(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Aujourd'hui, vous sentez-vous à l'aise avec ce que vous avez appris ?</Label>
              <p className="text-xs text-muted-foreground">5 : très à l'aise, 1 : pas du tout</p>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Button key={n} type="button" variant={niveau === n ? "default" : "outline"} className="w-12 h-12" onClick={() => setNiveau(n)}>{n}</Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Freins et effets</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Qu'est-ce qui vous a freiné ?</Label>
              <Multi name="freins" options={FREINS} value={freins} onChange={setFreins} />
              {freins.length > 0 && (
                <VoiceTextarea value={freinsDetails} onChange={(e) => setFreinsDetails(e.target.value)} rows={2} placeholder="Précisions (facultatif)" />
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="effets">Quels effets avez-vous constatés dans votre travail ?</Label>
              <VoiceTextarea id="effets" value={effets} onChange={(e) => setEffets(e.target.value)} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Avec le recul, la formation a-t-elle atteint vos objectifs ?<span className="text-destructive ml-1">*</span></Label>
              <Choice name="obj" options={OBJECTIFS_ATTEINTS} value={objectifs} onChange={setObjectifs} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-lg">Pour la suite</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>De quoi auriez-vous besoin pour aller plus loin ?</Label>
              <Multi name="besoins" options={BESOINS} value={besoins} onChange={setBesoins} />
            </div>
            <div className="space-y-2">
              <Label>Recommanderiez-vous cette formation à un collègue ?<span className="text-destructive ml-1">*</span></Label>
              <Choice name="reco" options={RECOMMANDATION} value={recommandation} onChange={setRecommandation} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="temoignage">En une ou deux phrases, que diriez-vous de cette formation ?</Label>
              <VoiceTextarea id="temoignage" value={temoignage} onChange={(e) => setTemoignage(e.target.value)} rows={3} />
              {temoignage.trim() && (
                <div className="flex items-start gap-2 pt-1">
                  <Checkbox id="consent" checked={consent} onCheckedChange={(c) => setConsent(c === true)} />
                  <Label htmlFor="consent" className="font-normal text-sm">
                    J'accepte que cette phrase soit publiée comme témoignage, avec mon prénom et mon entreprise.
                  </Label>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="commentaires">Autre chose à partager ?</Label>
              <VoiceTextarea id="commentaires" value={commentaires} onChange={(e) => setCommentaires(e.target.value)} rows={3} />
            </div>
          </CardContent>
        </Card>

        <Button className="w-full" size="lg" onClick={submit} disabled={submitting}>
          {submitting && <Spinner className="mr-2" />}Envoyer mes réponses
        </Button>
      </div>
    </div>
  );
};

export default ParticipantColdEvaluation;
