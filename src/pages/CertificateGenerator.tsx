import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Award, Loader2, Send, ArrowLeft } from "lucide-react";
import { User } from "@supabase/supabase-js";
import AppHeader from "@/components/AppHeader";
import ProcessingLog, { LogEntry } from "@/components/ProcessingLog";
import GoogleDriveConnect from "@/components/GoogleDriveConnect";
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
  duree_heures: number;
}

interface ParsedParticipant {
  prenom: string;
  nom: string;
  email: string;
}

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Formation configs from DB
  const [formationConfigs, setFormationConfigs] = useState<FormationConfig[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(true);

  // Form state
  const [formationName, setFormationName] = useState("");
  const [customFormationName, setCustomFormationName] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [duree, setDuree] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [participants, setParticipants] = useState("");
  const [emailCommanditaire, setEmailCommanditaire] = useState("");

  // Processing log state
  const [showLog, setShowLog] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [completedCount, setCompletedCount] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);

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
          .select("id, formation_name, duree_heures")
          .order("display_order");

        if (error) throw error;

        if (data && data.length > 0) {
          setFormationConfigs(data as FormationConfig[]);
        }
      } catch (error) {
        console.error("Error loading formation configs:", error);
      } finally {
        setLoadingConfigs(false);
      }
    };

    if (user) {
      loadFormationConfigs();
    }
  }, [user]);

  // Auto-update duration when formation changes
  useEffect(() => {
    if (formationName && formationName !== "__custom__") {
      const selectedConfig = formationConfigs.find(f => f.formation_name === formationName);
      if (selectedConfig) {
        setDuree(selectedConfig.duree_heures.toString());
      }
    }
  }, [formationName, formationConfigs]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleDateDebutChange = (value: string) => {
    setDateDebut(value);
    setDateFin(value);
  };

  const addLog = (participant: string, step: LogEntry["step"], message: string, status: LogEntry["status"]) => {
    const newLog: LogEntry = {
      id: `${Date.now()}-${Math.random()}`,
      participant,
      step,
      message,
      status,
      timestamp: new Date(),
    };
    setLogs((prev) => [...prev, newLog]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get actual formation name
    const actualFormationName = formationName === "__custom__" ? customFormationName : formationName;

    // Validate formation name
    if (!actualFormationName.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez saisir un nom de formation",
        variant: "destructive",
      });
      return;
    }
    
    // Parse participants
    const lines = participants.trim().split("\n").filter(line => line.trim());
    const parsedParticipants: ParsedParticipant[] = lines.map(line => {
      const parts = line.split(",").map(p => p.trim());
      return {
        prenom: parts[0] || "",
        nom: parts[1] || "",
        email: parts[2] || "",
      };
    });

    // Validate participants
    const invalidParticipants = parsedParticipants.filter(
      p => !p.prenom || !p.nom || !p.email || !p.email.includes("@")
    );

    if (invalidParticipants.length > 0) {
      toast({
        title: "Erreur de format",
        description: "Vérifiez le format des participants : Prénom, Nom, email@exemple.com",
        variant: "destructive",
      });
      return;
    }

    // Reset and show log
    setLogs([]);
    setCompletedCount(0);
    setTotalParticipants(parsedParticipants.length);
    setShowLog(true);
    setSubmitting(true);

    try {
      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;

      // Use fetch directly for streaming support
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-certificates`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
            "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            formationName: actualFormationName,
            entreprise,
            duree: `${duree}h`,
            dateDebut,
            dateFin,
            emailDestinataire: user?.email || "",
            emailCommanditaire: emailCommanditaire.trim() || undefined,
            participants: parsedParticipants,
            userId: user?.id,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Erreur serveur: ${response.status}`);
      }

      // Read the stream
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Pas de stream disponible");

      const decoder = new TextDecoder();
      let buffer = "";
      let allSuccess = true;
      let finalSuccessCount = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          if (!line.trim()) continue;
          
          try {
            const event = JSON.parse(line);
            
            if (event.type === "step") {
              const { participant, step, status, message } = event.data;
              addLog(participant, step, message, status);
            } else if (event.type === "participant_done") {
              const { participant, success, index, error } = event.data;
              setCompletedCount(index);
              
              if (success) {
                addLog(participant, "done", "✓ Certificat traité avec succès", "success");
              } else {
                allSuccess = false;
                addLog(participant, "error", error || "Erreur lors du traitement", "error");
              }
            } else if (event.type === "complete") {
              finalSuccessCount = event.data.successCount;
              toast({
                title: "Traitement terminé",
                description: `${finalSuccessCount}/${parsedParticipants.length} certificat(s) traité(s) avec succès.`,
                variant: allSuccess ? "default" : "destructive",
              });
            }
          } catch (parseError) {
            console.warn("Failed to parse event:", line, parseError);
          }
        }
      }

      // Reset form on success
      if (allSuccess) {
        setFormationName("");
        setCustomFormationName("");
        setEntreprise("");
        setDuree("");
        setDateDebut("");
        setDateFin("");
        setParticipants("");
        setEmailCommanditaire("");
      }
    } catch (error: any) {
      console.error("Error:", error);
      addLog("Système", "error", error.message || "Une erreur est survenue", "error");
      toast({
        title: "Erreur",
        description: error.message || "Une erreur est survenue lors de la génération",
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
      <AppHeader />

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
                  <Award className="w-6 h-6 text-primary" />
                  Génération de certificats de formation
                </CardTitle>
                <CardDescription>
                  Remplissez les informations de la formation et la liste des participants
                </CardDescription>
              </div>
              <GoogleDriveConnect />
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Formation details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="formationName">Nom de la formation</Label>
                  <Select
                    value={formationName}
                    onValueChange={(value) => {
                      setFormationName(value);
                      if (value !== "__custom__") {
                        setCustomFormationName("");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingConfigs ? "Chargement..." : "Sélectionner une formation"} />
                    </SelectTrigger>
                    <SelectContent>
                      {formationConfigs.map((config) => (
                        <SelectItem key={config.id} value={config.formation_name}>
                          {config.formation_name}
                        </SelectItem>
                      ))}
                      <SelectItem value="__custom__">Autre (saisie libre)</SelectItem>
                    </SelectContent>
                  </Select>
                  {formationName === "__custom__" && (
                    <Input
                      id="customFormationName"
                      placeholder="Ex: Facilitation graphique, communiquer avec le visuel"
                      value={customFormationName}
                      onChange={(e) => setCustomFormationName(e.target.value)}
                      className="mt-2"
                      required
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="entreprise">Entreprise</Label>
                  <Input
                    id="entreprise"
                    placeholder="Ex: Acme Corp"
                    value={entreprise}
                    onChange={(e) => setEntreprise(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-5 gap-4">
                <div className="space-y-2 col-span-1">
                  <Label htmlFor="duree">Durée (heures)</Label>
                  <div className="relative">
                    <Input
                      id="duree"
                      type="number"
                      min="1"
                      placeholder="14"
                      value={duree}
                      onChange={(e) => setDuree(e.target.value)}
                      required
                      className="pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      h
                    </span>
                  </div>
                </div>
                <div className="space-y-2 col-span-1 sm:col-span-2">
                  <Label htmlFor="dateDebut">Date de début</Label>
                  <Input
                    id="dateDebut"
                    type="date"
                    value={dateDebut}
                    onChange={(e) => handleDateDebutChange(e.target.value)}
                    required
                    className="h-10"
                  />
                </div>
                <div className="space-y-2 col-span-1 sm:col-span-2">
                  <Label htmlFor="dateFin">Date de fin</Label>
                  <Input
                    id="dateFin"
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    required
                    className="h-10"
                  />
                </div>
              </div>

              {/* Email commanditaire (optional) */}
              <div className="space-y-2">
                <Label htmlFor="emailCommanditaire">
                  Email du commanditaire <span className="text-muted-foreground font-normal">(facultatif)</span>
                </Label>
                <Input
                  id="emailCommanditaire"
                  type="email"
                  placeholder="Si renseigné, un ZIP avec tous les certificats sera envoyé à cette adresse"
                  value={emailCommanditaire}
                  onChange={(e) => setEmailCommanditaire(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="participants">Liste des participants</Label>
                <Textarea
                  id="participants"
                  placeholder="Prénom, Nom, email@exemple.com"
                  value={participants}
                  onChange={(e) => setParticipants(e.target.value)}
                  required
                  className="min-h-[150px] font-mono text-sm"
                />
                <p className="text-sm text-muted-foreground">
                  Une ligne par participant : Prénom, Nom, email
                </p>
              </div>

              <Button
                type="submit"
                className="w-full font-semibold text-lg py-6"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5 mr-2" />
                    Générer et envoyer les certificats
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>

      {/* Processing Log Modal */}
      <ProcessingLog
        isOpen={showLog}
        onClose={() => setShowLog(false)}
        logs={logs}
        isProcessing={submitting}
        totalParticipants={totalParticipants}
        completedCount={completedCount}
      />
    </div>
  );
};

export default Index;
