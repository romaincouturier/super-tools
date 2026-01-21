import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, FileText, ArrowLeft, Send } from "lucide-react";
import SupertiltLogo from "@/components/SupertiltLogo";
import UserMenu from "@/components/UserMenu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

const FORMATIONS = [
  "Formation facilitation graphique, communiquer avec le visuel",
  "Formation facilitation graphique, communiquer avec le visuel (individuel)",
  "Formation facilitation graphique, communiquer avec le visuel (indépendant)",
  "Formation faciliter l'intelligence collective",
  "Formation en ligne Facilitation graphique (Offre facilitateur graphique)",
  "Formation en ligne Facilitation graphique (Offre facilitateur graphique coaché)",
  "Formation en ligne Facilitation graphique (Offre Solo)",
  "Produire des vidéos dessinées",
  "Produire des vidéos dessinées (coaché)",
  "Sketchnoter sur tablette avec ProCreate et Concepts",
  "Sketchnoter sur tablette avec ProCreate et Concepts (pack coaché)",
];

const DATES_FORMATION = [
  "A la demande du participant",
  "26 et 27 janvier 2026",
  "30 et 31 mars 2026",
  "4 au 8 avril 2026",
  "4 et 5 mai 2026",
];

const LIEUX = [
  "En ligne en accédant à son compte sur supertilt.fr",
  "Espace Gailleton, 2 Pl. Gailleton, 69002 Lyon",
  "Agile Tribu, 4ter Pass. de la Main d'Or, 75011 Paris",
  "Chez le client",
];

const MicroDevis = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state - Client info
  const [nomClient, setNomClient] = useState("");
  const [adresseClient, setAdresseClient] = useState("");
  const [codePostalClient, setCodePostalClient] = useState("");
  const [villeClient, setVilleClient] = useState("");
  const [pays, setPays] = useState("france");
  const [paysAutre, setPaysAutre] = useState("");
  const [emailCommanditaire, setEmailCommanditaire] = useState("");
  const [adresseCommanditaire, setAdresseCommanditaire] = useState("");

  // Type de devis
  const [typeDevis, setTypeDevis] = useState<"formation" | "jeu" | "">("");
  const [isAdministration, setIsAdministration] = useState<"oui" | "non" | "">("");
  const [noteDevis, setNoteDevis] = useState("");

  // Formation specific
  const [participants, setParticipants] = useState("");
  const [formationDemandee, setFormationDemandee] = useState("");
  const [dateFormation, setDateFormation] = useState("");
  const [dateFormationAutre, setDateFormationAutre] = useState("");
  const [lieu, setLieu] = useState("");
  const [lieuAutre, setLieuAutre] = useState("");
  const [includeCadeau, setIncludeCadeau] = useState(false);
  const [fraisDossier, setFraisDossier] = useState<"oui" | "non" | "">("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        if (!session?.user) {
          navigate("/auth");
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    // TODO: Implement micro-devis generation
    toast({
      title: "Fonctionnalité en développement",
      description: "La génération de micro-devis sera bientôt disponible.",
    });

    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-foreground text-background py-4 px-6 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SupertiltLogo className="h-10" invert />
            <span className="text-xl font-bold">SuperTools</span>
          </div>
          {user && <UserMenu user={user} onLogout={handleLogout} />}
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto p-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/")}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux outils
        </Button>

        <Card className="border-2 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <FileText className="w-6 h-6 text-primary" />
              Micro-devis
            </CardTitle>
            <CardDescription>
              Créez des devis rapides et simplifiés
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Section: Informations client */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Informations client</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nomClient">Nom du client *</Label>
                    <Input
                      id="nomClient"
                      placeholder="Nom de l'entreprise ou du client"
                      value={nomClient}
                      onChange={(e) => setNomClient(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailCommanditaire">Email du commanditaire *</Label>
                    <Input
                      id="emailCommanditaire"
                      type="email"
                      placeholder="email@exemple.com"
                      value={emailCommanditaire}
                      onChange={(e) => setEmailCommanditaire(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adresseClient">Adresse du client *</Label>
                  <Input
                    id="adresseClient"
                    placeholder="Numéro et nom de rue"
                    value={adresseClient}
                    onChange={(e) => setAdresseClient(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="codePostalClient">Code postal *</Label>
                    <Input
                      id="codePostalClient"
                      placeholder="69000"
                      value={codePostalClient}
                      onChange={(e) => setCodePostalClient(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="villeClient">Ville *</Label>
                    <Input
                      id="villeClient"
                      placeholder="Lyon"
                      value={villeClient}
                      onChange={(e) => setVilleClient(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label>Pays *</Label>
                    <RadioGroup value={pays} onValueChange={setPays} className="flex items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="france" id="pays-france" />
                        <Label htmlFor="pays-france" className="font-normal cursor-pointer">France</Label>
                      </div>
                      <div className="flex items-center space-x-2 flex-1">
                        <RadioGroupItem value="autre" id="pays-autre" />
                        <Label htmlFor="pays-autre" className="font-normal cursor-pointer">Autre :</Label>
                        <Input
                          placeholder="Pays"
                          value={paysAutre}
                          onChange={(e) => {
                            setPaysAutre(e.target.value);
                            if (e.target.value) setPays("autre");
                          }}
                          className="flex-1"
                          disabled={pays !== "autre"}
                        />
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adresseCommanditaire">
                    Comment s'adresser au commanditaire * 
                    <span className="text-muted-foreground font-normal text-sm ml-1">(pas de virgule, pas de bonjour. Ex : Mme Poilvert)</span>
                  </Label>
                  <Input
                    id="adresseCommanditaire"
                    placeholder="Mme Dupont"
                    value={adresseCommanditaire}
                    onChange={(e) => setAdresseCommanditaire(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Section: Type de devis */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Type de devis</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label>S'agit-il d'un devis pour</Label>
                    <RadioGroup value={typeDevis} onValueChange={(v) => setTypeDevis(v as "formation" | "jeu")}>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="formation" id="type-formation" />
                        <Label htmlFor="type-formation" className="font-normal cursor-pointer">Une formation</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="jeu" id="type-jeu" />
                        <Label htmlFor="type-jeu" className="font-normal cursor-pointer">Un jeu</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <Label>Le client est une administration *</Label>
                    <RadioGroup value={isAdministration} onValueChange={(v) => setIsAdministration(v as "oui" | "non")} className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="oui" id="admin-oui" />
                        <Label htmlFor="admin-oui" className="font-normal cursor-pointer">Oui</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="non" id="admin-non" />
                        <Label htmlFor="admin-non" className="font-normal cursor-pointer">Non</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="noteDevis">
                    Note à faire figurer impérativement sur le devis
                    <span className="text-muted-foreground font-normal text-sm ml-1">(facultatif)</span>
                  </Label>
                  <Textarea
                    id="noteDevis"
                    placeholder="Notes ou mentions spéciales à inclure dans le devis..."
                    value={noteDevis}
                    onChange={(e) => setNoteDevis(e.target.value)}
                    className="min-h-[80px]"
                  />
                </div>
              </div>

              {/* Section: Formation (conditional) */}
              {typeDevis === "formation" && (
                <div className="space-y-4 p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <h3 className="text-lg font-semibold text-primary">Formation</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="participants">
                      Liste des participants
                      <span className="text-muted-foreground font-normal text-sm ml-1">(Prénom Nom e-mail ;,)</span>
                    </Label>
                    <Textarea
                      id="participants"
                      placeholder="Jean Dupont jean@exemple.com, Marie Martin marie@exemple.com"
                      value={participants}
                      onChange={(e) => setParticipants(e.target.value)}
                      className="min-h-[100px] font-mono text-sm"
                    />
                  </div>

                  <div className="space-y-3">
                    <Label>Formation demandée *</Label>
                    <RadioGroup value={formationDemandee} onValueChange={setFormationDemandee} className="space-y-2">
                      {FORMATIONS.map((formation) => (
                        <div key={formation} className="flex items-center space-x-2">
                          <RadioGroupItem value={formation} id={`formation-${formation}`} />
                          <Label htmlFor={`formation-${formation}`} className="font-normal cursor-pointer text-sm">
                            {formation}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <Label>Dates de la formation *</Label>
                    <RadioGroup value={dateFormation} onValueChange={setDateFormation} className="space-y-2">
                      {DATES_FORMATION.map((date) => (
                        <div key={date} className="flex items-center space-x-2">
                          <RadioGroupItem value={date} id={`date-${date}`} />
                          <Label htmlFor={`date-${date}`} className="font-normal cursor-pointer text-sm">
                            {date}
                          </Label>
                        </div>
                      ))}
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="autre" id="date-autre" />
                        <Label htmlFor="date-autre" className="font-normal cursor-pointer text-sm">Autre :</Label>
                        <Input
                          placeholder="Dates personnalisées"
                          value={dateFormationAutre}
                          onChange={(e) => {
                            setDateFormationAutre(e.target.value);
                            if (e.target.value) setDateFormation("autre");
                          }}
                          className="flex-1 max-w-xs"
                          disabled={dateFormation !== "autre"}
                        />
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <Label>Lieu *</Label>
                    <RadioGroup value={lieu} onValueChange={setLieu} className="space-y-2">
                      {LIEUX.map((l) => (
                        <div key={l} className="flex items-center space-x-2">
                          <RadioGroupItem value={l} id={`lieu-${l}`} />
                          <Label htmlFor={`lieu-${l}`} className="font-normal cursor-pointer text-sm">
                            {l}
                          </Label>
                        </div>
                      ))}
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="autre" id="lieu-autre" />
                        <Label htmlFor="lieu-autre" className="font-normal cursor-pointer text-sm">Autre :</Label>
                        <Input
                          placeholder="Adresse personnalisée"
                          value={lieuAutre}
                          onChange={(e) => {
                            setLieuAutre(e.target.value);
                            if (e.target.value) setLieu("autre");
                          }}
                          className="flex-1 max-w-md"
                          disabled={lieu !== "autre"}
                        />
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <Label>Cadeau <span className="text-muted-foreground font-normal text-sm">(ne pas cocher si non applicable)</span></Label>
                    <div className="flex items-start space-x-2">
                      <Checkbox 
                        id="cadeau" 
                        checked={includeCadeau}
                        onCheckedChange={(checked) => setIncludeCadeau(checked === true)}
                      />
                      <Label htmlFor="cadeau" className="font-normal cursor-pointer text-sm leading-relaxed">
                        Chaque participant(e) aura : 1 kit de facilitation graphique ainsi qu'un accès illimité et à vie au e-learning de 25h pour continuer sa formation à la facilitation graphique
                      </Label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Afficher les frais de dossier dans le devis * <span className="text-muted-foreground font-normal text-sm">(Oui pour appliquer 150 euros de frais)</span></Label>
                    <RadioGroup value={fraisDossier} onValueChange={(v) => setFraisDossier(v as "oui" | "non")} className="flex gap-4">
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="oui" id="frais-oui" />
                        <Label htmlFor="frais-oui" className="font-normal cursor-pointer">Oui</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="non" id="frais-non" />
                        <Label htmlFor="frais-non" className="font-normal cursor-pointer">Non</Label>
                      </div>
                    </RadioGroup>
                  </div>
                </div>
              )}

              {/* Section: Jeu (conditional) */}
              {typeDevis === "jeu" && (
                <div className="space-y-4 p-4 bg-secondary/50 rounded-lg border border-secondary">
                  <h3 className="text-lg font-semibold">Jeu</h3>
                  <p className="text-muted-foreground">
                    Les options pour les devis de jeu seront bientôt disponibles.
                  </p>
                </div>
              )}

              <Button
                type="submit"
                className="w-full font-semibold text-lg py-6"
                disabled={submitting || !typeDevis}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Générer le micro-devis
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MicroDevis;
