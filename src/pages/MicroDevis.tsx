import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, FileText, ArrowLeft, Send, Settings, Save, X, Plus, Trash2, Star, Eye, Search } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FormationConfig {
  id: string;
  formation_name: string;
  prix: number;
  duree_heures: number;
  programme_url: string | null;
  is_default: boolean;
}

interface FormationDate {
  id: string;
  date_label: string;
  is_default: boolean;
}

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
  const [newFormation, setNewFormation] = useState<Partial<FormationConfig> | null>(null);

  // Formation dates from DB
  const [formationDates, setFormationDates] = useState<FormationDate[]>([]);
  const [loadingDates, setLoadingDates] = useState(true);
  const [editingDate, setEditingDate] = useState<FormationDate | null>(null);
  const [datesDialogOpen, setDatesDialogOpen] = useState(false);
  const [newDate, setNewDate] = useState<Partial<FormationDate> | null>(null);
  const [jsonPreviewOpen, setJsonPreviewOpen] = useState(false);

  // SIREN search
  const [siren, setSiren] = useState("");
  const [searchingSiren, setSearchingSiren] = useState(false);

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
          const configs = data as FormationConfig[];
          setFormationConfigs(configs);
          
          const defaultFormation = configs.find(f => f.is_default);
          if (defaultFormation) {
            setFormationDemandee(defaultFormation.formation_name);
          }
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

  // Load formation dates from DB
  useEffect(() => {
    const loadFormationDates = async () => {
      try {
        const { data, error } = await supabase
          .from("formation_dates")
          .select("*")
          .order("date_label");

        if (error) throw error;

        if (data && data.length > 0) {
          setFormationDates(data as FormationDate[]);
          
          const defaultDate = data.find((d: FormationDate) => d.is_default);
          if (defaultDate) {
            setDateFormation(defaultDate.date_label);
          }
        }
      } catch (error) {
        console.error("Error loading formation dates:", error);
        toast({
          title: "Erreur",
          description: "Impossible de charger les dates de formations",
          variant: "destructive",
        });
      } finally {
        setLoadingDates(false);
      }
    };

    if (user) {
      loadFormationDates();
    }
  }, [user, toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleSearchSiren = async () => {
    if (!siren || !/^\d{9}$/.test(siren)) {
      toast({
        title: "SIREN invalide",
        description: "Le SIREN doit contenir exactement 9 chiffres",
        variant: "destructive",
      });
      return;
    }

    setSearchingSiren(true);
    try {
      const response = await supabase.functions.invoke("search-siren", {
        body: { siren },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data;
      
      if (data.error) {
        toast({
          title: "Erreur",
          description: data.error,
          variant: "destructive",
        });
        return;
      }

      // Auto-fill fields
      if (data.nomClient) setNomClient(data.nomClient);
      if (data.adresse) setAdresseClient(data.adresse);
      if (data.codePostal) setCodePostalClient(data.codePostal);
      if (data.ville) setVilleClient(data.ville);
      if (data.pays && data.pays !== "France") {
        setPays("autre");
        setPaysAutre(data.pays);
      } else {
        setPays("france");
      }

      toast({
        title: "Entreprise trouvée",
        description: `${data.nomClient} - ${data.ville}`,
      });
    } catch (error: unknown) {
      console.error("SIREN search error:", error);
      const errorMessage = error instanceof Error ? error.message : "Erreur lors de la recherche";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSearchingSiren(false);
    }
  };

  const getSelectedFormationConfig = (): FormationConfig | undefined => {
    return formationConfigs.find(f => f.formation_name === formationDemandee);
  };

  const countParticipants = (): number => {
    if (!participants.trim()) return 1;
    const lines = participants.split(/[,;\n]/).filter(l => l.trim());
    return Math.max(1, lines.length);
  };

  const buildPayload = () => {
    const selectedConfig = getSelectedFormationConfig();
    if (!selectedConfig) return null;
    
    const finalLieu = lieu === "autre" ? lieuAutre : lieu;
    const finalPays = pays === "autre" ? paysAutre : "France";
    const nbParticipants = countParticipants();

    // Parse participants list
    const participantsList = participants
      .split(/[,;\n]/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    // Build cadeau text if included
    const cadeauText = includeCadeau 
      ? "Chaque participant(e) aura : 1 kit de facilitation graphique ainsi qu'un accès illimité et à vie au e-learning de 25h pour continuer sa formation en facilitation graphique"
      : "";

    return {
      // Données envoyées à la fonction
      requestPayload: {
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
        dateFormation,
        lieu: finalLieu,
        includeCadeau,
        fraisDossier: fraisDossier === "oui",
        prix: selectedConfig.prix,
        dureeHeures: selectedConfig.duree_heures,
        programmeUrl: selectedConfig.programme_url,
        nbParticipants,
        participants,
      },
      // Payload PDF Monkey (structure attendue par le template)
      pdfMonkeyPayload: {
        client: {
          name: nomClient,
          address: adresseClient,
          zip: codePostalClient,
          city: villeClient,
          country: finalPays,
        },
        note: noteDevis || "",
        affiche_frais: fraisDossier === "oui" ? "Oui" : "Non",
        subrogation: "Oui / Non (2 versions)",
        cadeau: cadeauText,
        items: [
          {
            name: formationDemandee,
            participant_name: participantsList.length > 0 ? participantsList : [`${adresseCommanditaire} ${emailCommanditaire}`],
            date: dateFormation,
            place: finalLieu,
            duration: `${selectedConfig.duree_heures}h`,
            quantity: nbParticipants,
            unit_price: selectedConfig.prix,
          },
        ],
        admin_fee: fraisDossier === "oui" ? 150 : 0,
        is_administration: isAdministration === "oui",
      },
    };
  };

  const handleSaveFormationConfig = async () => {
    if (!editingFormation) return;

    try {
      const { error } = await supabase
        .from("formation_configs")
        .update({
          formation_name: editingFormation.formation_name,
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

  const handleAddFormation = async () => {
    if (!newFormation?.formation_name || !newFormation?.programme_url) return;

    try {
      const { data, error } = await supabase
        .from("formation_configs")
        .insert({
          formation_name: newFormation.formation_name,
          prix: newFormation.prix || 0,
          duree_heures: newFormation.duree_heures || 0,
          programme_url: newFormation.programme_url || null,
          is_default: false,
        })
        .select()
        .single();

      if (error) throw error;

      setFormationConfigs(prev => [...prev, data as FormationConfig].sort((a, b) => 
        a.formation_name.localeCompare(b.formation_name)
      ));

      toast({
        title: "Formation ajoutée",
        description: `"${newFormation.formation_name}" a été ajoutée.`,
      });

      setNewFormation(null);
    } catch (error) {
      console.error("Error adding formation:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la formation",
        variant: "destructive",
      });
    }
  };

  const handleDeleteFormation = async (id: string, name: string) => {
    try {
      const { error } = await supabase
        .from("formation_configs")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setFormationConfigs(prev => prev.filter(f => f.id !== id));

      toast({
        title: "Formation supprimée",
        description: `"${name}" a été supprimée.`,
      });
    } catch (error) {
      console.error("Error deleting formation:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la formation",
        variant: "destructive",
      });
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      // Remove default from all
      await supabase
        .from("formation_configs")
        .update({ is_default: false })
        .neq("id", "");

      // Set new default
      const { error } = await supabase
        .from("formation_configs")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;

      setFormationConfigs(prev => 
        prev.map(f => ({ ...f, is_default: f.id === id }))
      );

      const formation = formationConfigs.find(f => f.id === id);
      toast({
        title: "Formation par défaut",
        description: `"${formation?.formation_name}" est maintenant la formation par défaut.`,
      });
    } catch (error) {
      console.error("Error setting default:", error);
      toast({
        title: "Erreur",
        description: "Impossible de définir la formation par défaut",
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
          dateFormation,
          lieu: finalLieu,
          includeCadeau,
          fraisDossier: fraisDossier === "oui",
          prix: selectedConfig.prix,
          dureeHeures: selectedConfig.duree_heures,
          programmeUrl: selectedConfig.programme_url,
          nbParticipants: countParticipants(),
          participants,
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
      const defaultFormation = formationConfigs.find(f => f.is_default);
      setFormationDemandee(defaultFormation?.formation_name || "");
      setDateFormation("");
      setLieu("");
      setLieuAutre("");
      setIncludeCadeau(false);
      setFraisDossier("");

    } catch (error: unknown) {
      console.error("Error generating micro-devis:", error);
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      toast({
        title: "Erreur",
        description: errorMessage,
        variant: "destructive",
      });
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
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <FileText className="w-6 h-6 text-primary" />
                Micro-devis
              </CardTitle>
              <CardDescription>
                Créez des devis rapides et simplifiés
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Section: Informations client */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold border-b pb-2">Informations client</h3>
                
                {/* SIREN search */}
                <div className="flex gap-2 items-end p-3 bg-muted/50 rounded-lg border">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor="siren" className="text-sm">
                      Rechercher par SIREN
                      <span className="text-muted-foreground font-normal ml-1">(9 chiffres)</span>
                    </Label>
                    <Input
                      id="siren"
                      placeholder="123456789"
                      value={siren}
                      onChange={(e) => setSiren(e.target.value.replace(/\D/g, "").slice(0, 9))}
                      className="font-mono"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleSearchSiren}
                    disabled={searchingSiren || siren.length !== 9}
                  >
                    {searchingSiren ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Search className="w-4 h-4" />
                    )}
                    <span className="ml-2">Rechercher</span>
                  </Button>
                </div>

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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <div className="space-y-2">
                    <Label htmlFor="adresseCommanditaire">
                      Comment s'adresser au commanditaire *
                      <span className="text-muted-foreground font-normal text-sm ml-1">(Ex : Mme Poilvert)</span>
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="participants">
                        Liste des participants
                        <span className="text-muted-foreground font-normal text-sm ml-1">(Prénom Nom e-mail ;,)</span>
                      </Label>
                      {adresseCommanditaire && emailCommanditaire && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            const commanditaireEntry = `${adresseCommanditaire} ${emailCommanditaire}`;
                            if (participants.trim()) {
                              // Add to existing list if not already present
                              if (!participants.includes(emailCommanditaire)) {
                                setParticipants(participants + "\n" + commanditaireEntry);
                              }
                            } else {
                              setParticipants(commanditaireEntry);
                            }
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" />
                          Ajouter le commanditaire
                        </Button>
                      )}
                    </div>
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
                    <div className="flex items-center justify-between">
                      <Label>Formation demandée *</Label>
                      <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 px-2">
                            <Settings className="w-3 h-3 mr-1" />
                            Gérer
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Configuration des formations</DialogTitle>
                            <DialogDescription>
                              Gérez les formations, leurs prix, durées et URLs des programmes
                            </DialogDescription>
                          </DialogHeader>
                          
                          {/* Add new formation */}
                          <div className="border-b pb-4 mb-4">
                            {newFormation ? (
                              <div className="space-y-3 p-4 border rounded-lg bg-primary/5">
                                <h4 className="font-medium">Nouvelle formation</h4>
                                <div className="space-y-2">
                                  <Label className="text-xs">Nom de la formation *</Label>
                                  <Input
                                    placeholder="Nom de la formation"
                                    value={newFormation.formation_name || ""}
                                    onChange={(e) => setNewFormation({
                                      ...newFormation,
                                      formation_name: e.target.value
                                    })}
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Prix (€)</Label>
                                    <Input
                                      type="number"
                                      placeholder="0"
                                      value={newFormation.prix || ""}
                                      onChange={(e) => setNewFormation({
                                        ...newFormation,
                                        prix: parseFloat(e.target.value) || 0
                                      })}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Durée (heures)</Label>
                                    <Input
                                      type="number"
                                      step="0.5"
                                      placeholder="0"
                                      value={newFormation.duree_heures || ""}
                                      onChange={(e) => setNewFormation({
                                        ...newFormation,
                                        duree_heures: parseFloat(e.target.value) || 0
                                      })}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">URL du programme *</Label>
                                  <Input
                                    type="url"
                                    placeholder="https://..."
                                    value={newFormation.programme_url || ""}
                                    onChange={(e) => setNewFormation({
                                      ...newFormation,
                                      programme_url: e.target.value || null
                                    })}
                                    required
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={handleAddFormation} disabled={!newFormation.formation_name || !newFormation.programme_url}>
                                    <Save className="w-3 h-3 mr-1" />
                                    Ajouter
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setNewFormation(null)}>
                                    <X className="w-3 h-3 mr-1" />
                                    Annuler
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button 
                                variant="outline" 
                                className="w-full" 
                                onClick={() => setNewFormation({ prix: 1490, duree_heures: 14 })}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Ajouter une formation
                              </Button>
                            )}
                          </div>

                          {/* Existing formations */}
                          <div className="space-y-3">
                            {loadingConfigs ? (
                              <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin" />
                              </div>
                            ) : (
                              formationConfigs.map((config) => (
                                <div key={config.id} className="border rounded-lg p-4 space-y-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                      {config.is_default && (
                                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                      )}
                                      <h4 className="font-medium text-sm">{config.formation_name}</h4>
                                    </div>
                                    <div className="flex gap-1">
                                      {!config.is_default && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleSetDefault(config.id)}
                                          title="Définir par défaut"
                                        >
                                          <Star className="w-3 h-3" />
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => handleDeleteFormation(config.id, config.formation_name)}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  
                                  {editingFormation?.id === config.id ? (
                                    <div className="space-y-3">
                                      <div className="space-y-2">
                                        <Label className="text-xs">Nom de la formation</Label>
                                        <Input
                                          value={editingFormation.formation_name}
                                          onChange={(e) => setEditingFormation({
                                            ...editingFormation,
                                            formation_name: e.target.value
                                          })}
                                        />
                                      </div>
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
                                            step="0.5"
                                            value={editingFormation.duree_heures}
                                            onChange={(e) => setEditingFormation({
                                              ...editingFormation,
                                              duree_heures: parseFloat(e.target.value) || 0
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
                    <Select value={formationDemandee} onValueChange={setFormationDemandee}>
                      <SelectTrigger className="w-full bg-background">
                        <SelectValue placeholder="Sélectionner une formation" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        {formationConfigs.map((config) => (
                          <SelectItem key={config.id} value={config.formation_name}>
                            <div className="flex items-center gap-2">
                              {config.is_default && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                              <span>{config.formation_name}</span>
                              <span className="text-muted-foreground text-xs">
                                ({config.prix}€ • {config.duree_heures}h)
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Dates de la formation *</Label>
                      <Dialog open={datesDialogOpen} onOpenChange={setDatesDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 px-2">
                            <Settings className="w-3 h-3 mr-1" />
                            Gérer
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>Configuration des dates de formation</DialogTitle>
                            <DialogDescription>
                              Gérez les dates de formation prédéfinies
                            </DialogDescription>
                          </DialogHeader>
                          
                          {/* Add new date */}
                          <div className="border-b pb-4 mb-4">
                            {newDate ? (
                              <div className="space-y-3 p-4 border rounded-lg bg-primary/5">
                                <h4 className="font-medium">Nouvelle date</h4>
                                <div className="space-y-2">
                                  <Label className="text-xs">Libellé de la date *</Label>
                                  <Input
                                    placeholder="Ex: 15 et 16 janvier 2026"
                                    value={newDate.date_label || ""}
                                    onChange={(e) => setNewDate({
                                      ...newDate,
                                      date_label: e.target.value
                                    })}
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={async () => {
                                    if (!newDate.date_label) return;
                                    try {
                                      const { data, error } = await supabase
                                        .from("formation_dates")
                                        .insert({
                                          date_label: newDate.date_label,
                                          is_default: false,
                                        })
                                        .select()
                                        .single();
                                      if (error) throw error;
                                      setFormationDates(prev => [...prev, data as FormationDate].sort((a, b) => 
                                        a.date_label.localeCompare(b.date_label)
                                      ));
                                      toast({
                                        title: "Date ajoutée",
                                        description: `"${newDate.date_label}" a été ajoutée.`,
                                      });
                                      setNewDate(null);
                                    } catch (error) {
                                      console.error("Error adding date:", error);
                                      toast({
                                        title: "Erreur",
                                        description: "Impossible d'ajouter la date",
                                        variant: "destructive",
                                      });
                                    }
                                  }} disabled={!newDate.date_label}>
                                    <Save className="w-3 h-3 mr-1" />
                                    Ajouter
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => setNewDate(null)}>
                                    <X className="w-3 h-3 mr-1" />
                                    Annuler
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button 
                                variant="outline" 
                                className="w-full" 
                                onClick={() => setNewDate({})}
                              >
                                <Plus className="w-4 h-4 mr-2" />
                                Ajouter une date
                              </Button>
                            )}
                          </div>

                          {/* Existing dates */}
                          <div className="space-y-3">
                            {loadingDates ? (
                              <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin" />
                              </div>
                            ) : formationDates.length === 0 ? (
                              <p className="text-center text-muted-foreground py-4">
                                Aucune date configurée. Ajoutez-en une ou saisissez directement dans le champ.
                              </p>
                            ) : (
                              formationDates.map((dateConfig) => (
                                <div key={dateConfig.id} className="border rounded-lg p-4 space-y-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-2">
                                      {dateConfig.is_default && (
                                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                                      )}
                                      <h4 className="font-medium text-sm">{dateConfig.date_label}</h4>
                                    </div>
                                    <div className="flex gap-1">
                                      {!dateConfig.is_default && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={async () => {
                                            try {
                                              await supabase
                                                .from("formation_dates")
                                                .update({ is_default: false })
                                                .neq("id", "");
                                              const { error } = await supabase
                                                .from("formation_dates")
                                                .update({ is_default: true })
                                                .eq("id", dateConfig.id);
                                              if (error) throw error;
                                              setFormationDates(prev => 
                                                prev.map(d => ({ ...d, is_default: d.id === dateConfig.id }))
                                              );
                                              toast({
                                                title: "Date par défaut",
                                                description: `"${dateConfig.date_label}" est maintenant la date par défaut.`,
                                              });
                                            } catch (error) {
                                              console.error("Error setting default:", error);
                                              toast({
                                                title: "Erreur",
                                                description: "Impossible de définir la date par défaut",
                                                variant: "destructive",
                                              });
                                            }
                                          }}
                                          title="Définir par défaut"
                                        >
                                          <Star className="w-3 h-3" />
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-destructive hover:text-destructive"
                                        onClick={async () => {
                                          try {
                                            const { error } = await supabase
                                              .from("formation_dates")
                                              .delete()
                                              .eq("id", dateConfig.id);
                                            if (error) throw error;
                                            setFormationDates(prev => prev.filter(d => d.id !== dateConfig.id));
                                            toast({
                                              title: "Date supprimée",
                                              description: `"${dateConfig.date_label}" a été supprimée.`,
                                            });
                                          } catch (error) {
                                            console.error("Error deleting date:", error);
                                            toast({
                                              title: "Erreur",
                                              description: "Impossible de supprimer la date",
                                              variant: "destructive",
                                            });
                                          }
                                        }}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  </div>
                                  
                                  {editingDate?.id === dateConfig.id ? (
                                    <div className="space-y-3">
                                      <div className="space-y-2">
                                        <Label className="text-xs">Libellé de la date</Label>
                                        <Input
                                          value={editingDate.date_label}
                                          onChange={(e) => setEditingDate({
                                            ...editingDate,
                                            date_label: e.target.value
                                          })}
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <Button size="sm" onClick={async () => {
                                          if (!editingDate) return;
                                          try {
                                            const { error } = await supabase
                                              .from("formation_dates")
                                              .update({ date_label: editingDate.date_label })
                                              .eq("id", editingDate.id);
                                            if (error) throw error;
                                            setFormationDates(prev => 
                                              prev.map(d => d.id === editingDate.id ? editingDate : d)
                                            );
                                            toast({
                                              title: "Date sauvegardée",
                                              description: `Les modifications ont été enregistrées.`,
                                            });
                                            setEditingDate(null);
                                          } catch (error) {
                                            console.error("Error saving date:", error);
                                            toast({
                                              title: "Erreur",
                                              description: "Impossible de sauvegarder la date",
                                              variant: "destructive",
                                            });
                                          }
                                        }}>
                                          <Save className="w-3 h-3 mr-1" />
                                          Sauvegarder
                                        </Button>
                                        <Button size="sm" variant="outline" onClick={() => setEditingDate(null)}>
                                          <X className="w-3 h-3 mr-1" />
                                          Annuler
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center justify-end">
                                      <Button 
                                        size="sm" 
                                        variant="ghost"
                                        onClick={() => setEditingDate(dateConfig)}
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
                    {formationDates.length > 0 ? (
                      <Select value={dateFormation} onValueChange={setDateFormation}>
                        <SelectTrigger className="w-full bg-background">
                          <SelectValue placeholder="Sélectionner une date" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50">
                          {formationDates.map((dateConfig) => (
                            <SelectItem key={dateConfig.id} value={dateConfig.date_label}>
                              <div className="flex items-center gap-2">
                                {dateConfig.is_default && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                                <span>{dateConfig.date_label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        id="dateFormation"
                        placeholder="Ex: 15 et 16 janvier 2026, ou Du 10 au 14 mars 2026"
                        value={dateFormation}
                        onChange={(e) => setDateFormation(e.target.value)}
                        required
                      />
                    )}
                    <p className="text-xs text-muted-foreground">
                      {formationDates.length > 0 
                        ? "Sélectionnez une date ou gérez les dates disponibles" 
                        : "Saisissez les dates au format souhaité (ex: \"26 et 27 janvier 2026\")"
                      }
                    </p>
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

              <div className="flex gap-3">
                <Dialog open={jsonPreviewOpen} onOpenChange={setJsonPreviewOpen}>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="font-semibold py-6"
                      disabled={!typeDevis || typeDevis !== "formation" || !formationDemandee}
                    >
                      <Eye className="w-5 h-5 mr-2" />
                      Prévisualiser JSON
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Prévisualisation du JSON PDF Monkey</DialogTitle>
                      <DialogDescription>
                        Payload qui sera envoyé à PDF Monkey pour générer le devis
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4">
                      <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(buildPayload()?.pdfMonkeyPayload, null, 2)}
                      </pre>
                    </div>
                  </DialogContent>
                </Dialog>

                <Button
                  type="submit"
                  className="flex-1 font-semibold text-lg py-6"
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
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default MicroDevis;
