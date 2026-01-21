import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, FileText, ArrowLeft, Send, Settings, Save, X } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface FormationConfig {
  id: string;
  formation_name: string;
  prix: number;
  duree_heures: number;
  programme_url: string | null;
}

const DEFAULT_FORMATIONS = [
  "Développement et déploiement de formations tutorées",
  "Création de formations digitales avec Genially",
  "Créer des jeux pédagogiques avec Genially",
  "Gamifier l'apprentissage avec Genially",
  "Créer des parcours pédagogiques interactifs",
  "Créer des formations interactives avancées avec Genially",
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

  // Formation configs from DB
  const [formationConfigs, setFormationConfigs] = useState<FormationConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);
  const [editingFormation, setEditingFormation] = useState<FormationConfig | null>(null);
  const [configDialogOpen, setConfigDialogOpen] = useState(false);

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

  // Editable dates
  const [customDates, setCustomDates] = useState<string[]>(DATES_FORMATION);
  const [editingDateIndex, setEditingDateIndex] = useState<number | null>(null);
  const [editingDateValue, setEditingDateValue] = useState("");

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

  // Load formation configs from DB
  useEffect(() => {
    const loadFormationConfigs = async () => {
      try {
        const { data, error } = await supabase
          .from("formation_configs")
          .select("*")
          .order("formation_name");

        if (error) throw error;

        if (data && data.length > 0) {
          setFormationConfigs(data);
        } else {
          // If no configs in DB, create default ones
          const defaultConfigs = DEFAULT_FORMATIONS.map(name => ({
            formation_name: name,
            prix: 1490,
            duree_heures: 14,
            programme_url: null,
          }));

          for (const config of defaultConfigs) {
            await supabase.from("formation_configs").insert(config);
          }

          const { data: newData } = await supabase
            .from("formation_configs")
            .select("*")
            .order("formation_name");
          
          if (newData) setFormationConfigs(newData);
        }
      } catch (error) {
        console.error("Error loading formation configs:", error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les configurations de formations",
          variant: "destructive",
        });
      } finally {
        setLoadingConfigs(false);
      }
    };

    if (user) {
      loadFormationConfigs();
    }
  }, [user, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getSelectedFormationConfig = (): FormationConfig | undefined => {
    return formationConfigs.find(f => f.formation_name === formationDemandee);
  };

  const countParticipants = (): number => {
    if (!participants.trim()) return 1;
    // Count lines or comma-separated entries
    const lines = participants.split(/[,;\n]/).filter(l => l.trim());
    return Math.max(1, lines.length);
  };

  const handleSaveFormationConfig = async () => {
    if (!editingFormation) return;

    try {
      const { error } = await supabase
        .from("formation_configs")
        .update({
          prix: editingFormation.prix,
          duree_heures: editingFormation.duree_heures,
          programme_url: editingFormation.programme_url,
        })
        .eq("id", editingFormation.id);

      if (error) throw error;

      setFormationConfigs(prev => 
        prev.map(f => f.id === editingFormation.id ? editingFormation : f)
      );

      toast({
        title: "Configuration sauvegardée",
        description: `Les paramètres de "${editingFormation.formation_name}" ont été mis à jour.`,
      });

      setEditingFormation(null);
    } catch (error) {
      console.error("Error saving formation config:", error);
      toast({
        title: "Erreur",
        description: "Impossible de sauvegarder la configuration",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (typeDevis !== "formation") {
      toast({
        title: "Fonctionnalité en développement",
        description: "La génération de devis pour les jeux sera bientôt disponible.",
      });
      return;
    }

    const selectedConfig = getSelectedFormationConfig();
    if (!selectedConfig) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner une formation",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const finalDateFormation = dateFormation === "autre" ? dateFormationAutre : dateFormation;
      const finalLieu = lieu === "autre" ? lieuAutre : lieu;
      const finalPays = pays === "autre" ? paysAutre : "France";

      const response = await supabase.functions.invoke("generate-micro-devis", {
        body: {
          nomClient,
          adresseClient,
          codePostalClient,
          villeClient,
          pays: finalPays,
          emailCommanditaire,
          adresseCommanditaire,
          isAdministration: isAdministration === "oui",
          noteDevis,
          formationDemandee,
          dateFormation: finalDateFormation,
          lieu: finalLieu,
          includeCadeau,
          fraisDossier: fraisDossier === "oui",
          prix: selectedConfig.prix,
          dureeHeures: selectedConfig.duree_heures,
          programmeUrl: selectedConfig.programme_url,
          nbParticipants: countParticipants(),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Devis envoyés !",
        description: `Les 2 devis ont été générés et envoyés à ${emailCommanditaire}`,
      });

      // Reset form
      setNomClient("");
      setAdresseClient("");
      setCodePostalClient("");
      setVilleClient("");
      setPays("france");
      setPaysAutre("");
      setEmailCommanditaire("");
      setAdresseCommanditaire("");
      setTypeDevis("");
      setIsAdministration("");
      setNoteDevis("");
      setParticipants("");
      setFormationDemandee("");
      setDateFormation("");
      setDateFormationAutre("");
      setLieu("");
      setLieuAutre("");
      setIncludeCadeau(false);
      setFraisDossier("");

    } catch (error: any) {
      console.error("Error generating micro-devis:", error);
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la génération des devis",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditDate = (index: number) => {
    setEditingDateIndex(index);
    setEditingDateValue(customDates[index]);
  };

  const handleSaveDate = () => {
    if (editingDateIndex !== null && editingDateValue.trim()) {
      const newDates = [...customDates];
      newDates[editingDateIndex] = editingDateValue.trim();
      setCustomDates(newDates);
      if (dateFormation === customDates[editingDateIndex]) {
        setDateFormation(editingDateValue.trim());
      }
    }
    setEditingDateIndex(null);
    setEditingDateValue("");
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <FileText className="w-6 h-6 text-primary" />
                  Micro-devis
                </CardTitle>
                <CardDescription>
                  Créez des devis rapides et simplifiés
                </CardDescription>
              </div>
              <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="w-4 h-4 mr-2" />
                    Configurer formations
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Configuration des formations</DialogTitle>
                    <DialogDescription>
                      Modifiez les prix, durées et URLs des programmes de formation
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 mt-4">
                    {loadingConfigs ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin" />
                      </div>
                    ) : (
                      formationConfigs.map((config) => (
                        <div key={config.id} className="border rounded-lg p-4 space-y-3">
                          <h4 className="font-medium text-sm">{config.formation_name}</h4>
                          {editingFormation?.id === config.id ? (
                            <div className="space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Prix (€)</Label>
                                  <Input
                                    type="number"
                                    value={editingFormation.prix}
                                    onChange={(e) => setEditingFormation({
                                      ...editingFormation,
                                      prix: parseFloat(e.target.value) || 0
                                    })}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Durée (heures)</Label>
                                  <Input
                                    type="number"
                                    value={editingFormation.duree_heures}
                                    onChange={(e) => setEditingFormation({
                                      ...editingFormation,
                                      duree_heures: parseInt(e.target.value) || 0
                                    })}
                                  />
                                </div>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">URL du programme</Label>
                                <Input
                                  type="url"
                                  placeholder="https://..."
                                  value={editingFormation.programme_url || ""}
                                  onChange={(e) => setEditingFormation({
                                    ...editingFormation,
                                    programme_url: e.target.value || null
                                  })}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button size="sm" onClick={handleSaveFormationConfig}>
                                  <Save className="w-3 h-3 mr-1" />
                                  Sauvegarder
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingFormation(null)}>
                                  <X className="w-3 h-3 mr-1" />
                                  Annuler
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="text-sm text-muted-foreground">
                                {config.prix}€ • {config.duree_heures}h
                                {config.programme_url && " • Programme ✓"}
                              </div>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => setEditingFormation(config)}
                              >
                                Modifier
                              </Button>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
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
                    {participants && (
                      <p className="text-sm text-muted-foreground">
                        {countParticipants()} participant(s) détecté(s)
                      </p>
                    )}
                  </div>

                  <div className="space-y-3">
                    <Label>Formation demandée *</Label>
                    <RadioGroup value={formationDemandee} onValueChange={setFormationDemandee} className="space-y-2">
                      {formationConfigs.map((config) => (
                        <div key={config.id} className="flex items-center space-x-2">
                          <RadioGroupItem value={config.formation_name} id={`formation-${config.id}`} />
                          <Label htmlFor={`formation-${config.id}`} className="font-normal cursor-pointer text-sm flex-1">
                            {config.formation_name}
                            <span className="text-muted-foreground ml-2">
                              ({config.prix}€ • {config.duree_heures}h)
                            </span>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>

                  <div className="space-y-3">
                    <Label>Dates de la formation *</Label>
                    <RadioGroup value={dateFormation} onValueChange={setDateFormation} className="space-y-2">
                      {customDates.map((date, index) => (
                        <div key={index} className="flex items-center space-x-2 group">
                          <RadioGroupItem value={date} id={`date-${index}`} />
                          {editingDateIndex === index ? (
                            <div className="flex items-center gap-2 flex-1">
                              <Input
                                value={editingDateValue}
                                onChange={(e) => setEditingDateValue(e.target.value)}
                                className="flex-1"
                                autoFocus
                              />
                              <Button type="button" size="sm" onClick={handleSaveDate}>
                                <Save className="w-3 h-3" />
                              </Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => setEditingDateIndex(null)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <Label htmlFor={`date-${index}`} className="font-normal cursor-pointer text-sm flex-1">
                                {date}
                              </Label>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => handleEditDate(index)}
                              >
                                Modifier
                              </Button>
                            </>
                          )}
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

                  {/* Summary */}
                  {formationDemandee && (
                    <div className="mt-4 p-3 bg-background rounded border">
                      <h4 className="font-medium text-sm mb-2">Résumé du devis</h4>
                      {(() => {
                        const config = getSelectedFormationConfig();
                        if (!config) return null;
                        const nbParticipants = countParticipants();
                        const prixFormation = config.prix * nbParticipants;
                        const frais = fraisDossier === "oui" ? 150 : 0;
                        const totalHT = prixFormation + frais;
                        const tva = isAdministration === "oui" ? 0 : totalHT * 0.2;
                        const totalTTC = totalHT + tva;

                        return (
                          <div className="text-sm space-y-1">
                            <p>Formation : {config.prix}€ × {nbParticipants} = <strong>{prixFormation}€</strong></p>
                            {frais > 0 && <p>Frais de dossier : {frais}€</p>}
                            <p>Total HT : <strong>{totalHT}€</strong></p>
                            <p>TVA (20%) : {isAdministration === "oui" ? "Exonéré" : `${tva.toFixed(2)}€`}</p>
                            <p className="text-base">Total TTC : <strong>{totalTTC.toFixed(2)}€</strong></p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* Section: Jeu (conditional) */}
              {typeDevis === "jeu" && (
                <div className="space-y-4 p-4 bg-secondary/50 rounded-lg border border-secondary">
                  <h3 className="text-lg font-semibold">Jeu</h3>
                  <p className="text-muted-foreground">
                    Pour créer un devis pour un jeu, veuillez utiliser notre formulaire dédié :
                  </p>
                  <Button asChild variant="outline" className="w-full">
                    <a 
                      href="https://docs.google.com/forms/d/e/1FAIpQLScoZ3qkcJDxbEQYysE2YSkTEV-bfmF6mkAumwQ20Hoqflp7_g/viewform" 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      Accéder au formulaire de devis Jeu
                    </a>
                  </Button>
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
