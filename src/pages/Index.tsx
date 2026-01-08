import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Award, LogOut, Loader2, Send } from "lucide-react";
import { User } from "@supabase/supabase-js";
import supertiltLogo from "@/assets/supertilt-logo.jpg";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state
  const [formationName, setFormationName] = useState("");
  const [entreprise, setEntreprise] = useState("");
  const [duree, setDuree] = useState("");
  const [dateDebut, setDateDebut] = useState("");
  const [dateFin, setDateFin] = useState("");
  const [participants, setParticipants] = useState("");

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

  const handleDateDebutChange = (value: string) => {
    setDateDebut(value);
    // Auto-set dateFin to dateDebut when changed
    setDateFin(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Parse participants
      const lines = participants.trim().split("\n").filter(line => line.trim());
      const parsedParticipants = lines.map(line => {
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
        setSubmitting(false);
        return;
      }

      // Call edge function with hardcoded BCC email
      const { data, error } = await supabase.functions.invoke("generate-certificates", {
        body: {
          formationName,
          entreprise,
          duree: `${duree}h`,
          dateDebut,
          dateFin,
          emailDestinataire: "romain@supertilt.fr",
          participants: parsedParticipants,
        },
      });

      if (error) throw error;

      toast({
        title: "Certificats générés !",
        description: `${parsedParticipants.length} certificat(s) ont été envoyés avec succès.`,
      });

      // Reset form
      setFormationName("");
      setEntreprise("");
      setDuree("");
      setDateDebut("");
      setDateFin("");
      setParticipants("");
    } catch (error: any) {
      console.error("Error:", error);
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
      {/* Header */}
      <header className="bg-foreground text-background py-4 px-6 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={supertiltLogo} 
              alt="SuperTilt" 
              className="h-10 brightness-0 invert"
            />
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-background hover:bg-background/10"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Déconnexion
          </Button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto p-6">
        <Card className="border-2 shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Award className="w-6 h-6 text-primary" />
              Nouvelle génération de certificats
            </CardTitle>
            <CardDescription>
              Remplissez les informations de la formation et la liste des participants
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Formation details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="formationName">Nom de la formation</Label>
                  <Input
                    id="formationName"
                    placeholder="Ex: Facilitation graphique, communiquer avec le visuel"
                    value={formationName}
                    onChange={(e) => setFormationName(e.target.value)}
                    required
                  />
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

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
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
                <div className="space-y-2">
                  <Label htmlFor="dateDebut">Date de début</Label>
                  <Input
                    id="dateDebut"
                    type="date"
                    value={dateDebut}
                    onChange={(e) => handleDateDebutChange(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateFin">Date de fin</Label>
                  <Input
                    id="dateFin"
                    type="date"
                    value={dateFin}
                    onChange={(e) => setDateFin(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Participants */}
              <div className="space-y-2">
                <Label htmlFor="participants">Liste des participants</Label>
                <Textarea
                  id="participants"
                  placeholder="Prénom, Nom, email@exemple.com
Jean, Dupont, jean.dupont@email.com
Marie, Martin, marie.martin@email.com"
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
    </div>
  );
};

export default Index;
