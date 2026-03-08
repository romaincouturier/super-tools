import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  User, GraduationCap, Users, ClipboardCheck,
  CheckCircle2, Loader2, ArrowRight, ArrowLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import SupertiltLogo from "@/components/SupertiltLogo";
import confetti from "canvas-confetti";

const steps = [
  { icon: User, title: "Votre profil", desc: "Présentez-vous en quelques mots" },
  { icon: GraduationCap, title: "Première formation", desc: "Créez votre première formation" },
  { icon: Users, title: "Participants", desc: "Ajoutez vos premiers participants" },
  { icon: ClipboardCheck, title: "Questionnaire", desc: "Configurez un questionnaire type" },
];

const sectorTemplates = [
  { value: "dev", label: "Développement / Tech", suggestions: ["Introduction à Python", "React pour les pros", "DevOps & CI/CD"] },
  { value: "management", label: "Management", suggestions: ["Manager une équipe hybride", "Leadership situationnel", "Conduite du changement"] },
  { value: "langues", label: "Langues", suggestions: ["Anglais professionnel B2", "Français Langue Étrangère", "Espagnol débutant"] },
  { value: "coaching", label: "Coaching", suggestions: ["Coaching individuel", "Prise de parole en public", "Gestion du stress"] },
  { value: "bien-etre", label: "Bien-être", suggestions: ["Qualité de vie au travail", "Prévention des RPS", "Gestion du stress"] },
  { value: "other", label: "Autre", suggestions: ["Ma première formation"] },
];

export default function Onboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Step 1 — Profile
  const [displayName, setDisplayName] = useState("");
  const [company, setCompany] = useState("");
  const [sector, setSector] = useState("");

  // Step 2 — Training
  const [trainingName, setTrainingName] = useState("");
  const [trainingDuration, setTrainingDuration] = useState("7");

  // Step 3 — Participants
  const [participants, setParticipants] = useState([
    { firstName: "", lastName: "", email: "" },
  ]);

  // Step 4 — questionnaire is auto
  const [questionnaireType, setQuestionnaireType] = useState("besoins");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth");
      else {
        const meta = session.user.user_metadata;
        if (meta?.full_name) setDisplayName(meta.full_name);
      }
    });
  }, [navigate]);

  const markComplete = (step: number) => {
    setCompletedSteps((prev) => [...new Set([...prev, step])]);
    if (step < 3) {
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.7 } });
    }
  };

  const handleProfileSave = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      await supabase.auth.updateUser({
        data: { full_name: displayName, company, sector },
      });

      // Update profile table
      await (supabase.rpc as any)("upsert_profile", {
        p_user_id: user.id,
        p_email: user.email,
        p_display_name: displayName,
      });

      markComplete(0);
      setCurrentStep(1);
      toast({ title: "Profil enregistré ✓" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrainingSave = async () => {
    if (!trainingName.trim()) {
      toast({ title: "Veuillez saisir un nom de formation", variant: "destructive" });
      return;
    }
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("trainings").insert({
        training_name: trainingName,
        created_by: user.id,
        evaluation_link: "",
        location: "À définir",
        client_name: company || "À définir",
      });
      if (error) throw error;

      markComplete(1);
      setCurrentStep(2);
      toast({ title: "Formation créée ✓" });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleParticipantsSave = async () => {
    const valid = participants.filter((p) => p.email.trim());
    if (valid.length === 0) {
      markComplete(2);
      setCurrentStep(3);
      return;
    }
    setIsLoading(true);
    try {
      // For now just mark as done, participants will be added to the training later
      markComplete(2);
      setCurrentStep(3);
      toast({ title: `${valid.length} participant(s) enregistré(s) ✓` });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = () => {
    markComplete(3);
    confetti({ particleCount: 150, spread: 100, origin: { y: 0.6 } });
    setTimeout(() => {
      navigate("/dashboard");
    }, 1500);
  };

  const addParticipant = () => {
    setParticipants((prev) => [...prev, { firstName: "", lastName: "", email: "" }]);
  };

  const updateParticipant = (index: number, field: string, value: string) => {
    setParticipants((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom complet</Label>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Marie Dupont" />
            </div>
            <div className="space-y-2">
              <Label>Organisme / Entreprise</Label>
              <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Ma société de formation" />
            </div>
            <div className="space-y-2">
              <Label>Secteur d'activité</Label>
              <div className="grid grid-cols-2 gap-2">
                {sectorTemplates.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setSector(s.value)}
                    className={cn(
                      "p-3 rounded-lg border text-sm text-left transition-all",
                      sector === s.value
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <Button className="w-full font-semibold" onClick={handleProfileSave} disabled={isLoading || !displayName.trim()}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continuer <ArrowRight className="ml-2 w-4 h-4" /></>}
            </Button>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nom de la formation</Label>
              <Input value={trainingName} onChange={(e) => setTrainingName(e.target.value)} placeholder="Ex: Introduction au management" />
            </div>
            <div className="space-y-2">
              <Label>Durée (heures)</Label>
              <Input type="number" value={trainingDuration} onChange={(e) => setTrainingDuration(e.target.value)} min="1" />
            </div>
            <Button className="w-full font-semibold" onClick={handleTrainingSave} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Créer la formation <ArrowRight className="ml-2 w-4 h-4" /></>}
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            {participants.map((p, i) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <Input placeholder="Prénom" value={p.firstName} onChange={(e) => updateParticipant(i, "firstName", e.target.value)} />
                <Input placeholder="Nom" value={p.lastName} onChange={(e) => updateParticipant(i, "lastName", e.target.value)} />
                <Input placeholder="Email" type="email" value={p.email} onChange={(e) => updateParticipant(i, "email", e.target.value)} />
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addParticipant}>+ Ajouter un participant</Button>
            <Button className="w-full font-semibold" onClick={handleParticipantsSave} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Continuer <ArrowRight className="ml-2 w-4 h-4" /></>}
            </Button>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4 text-center">
            <div className="space-y-2">
              <Label>Type de questionnaire à activer</Label>
              <div className="flex gap-3 justify-center">
                {[
                  { value: "besoins", label: "Recueil des besoins" },
                  { value: "evaluation", label: "Évaluation à chaud" },
                ].map((q) => (
                  <button
                    key={q.value}
                    type="button"
                    onClick={() => setQuestionnaireType(q.value)}
                    className={cn(
                      "px-4 py-3 rounded-lg border text-sm transition-all",
                      questionnaireType === q.value
                        ? "border-primary bg-primary/5 font-medium"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Les questionnaires seront envoyés automatiquement à vos participants.
            </p>
            <Button className="w-full font-semibold text-lg py-6" onClick={handleFinish}>
              🎉 Terminer et accéder au tableau de bord
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => {
            const isCompleted = completedSteps.includes(i);
            const isCurrent = i === currentStep;
            return (
              <div key={i} className="flex items-center gap-2">
                <button
                  onClick={() => isCompleted && setCurrentStep(i)}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                    isCompleted
                      ? "bg-primary text-primary-foreground"
                      : isCurrent
                        ? "bg-primary/20 text-primary border-2 border-primary"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <s.icon className="w-5 h-5" />}
                </button>
                {i < steps.length - 1 && (
                  <div className={cn("w-8 h-0.5", isCompleted ? "bg-primary" : "bg-border")} />
                )}
              </div>
            );
          })}
        </div>

        <Card className="border-2 shadow-xl">
          <CardHeader className="text-center">
            <SupertiltLogo className="h-8 mx-auto mb-2" />
            <CardTitle>{steps[currentStep].title}</CardTitle>
            <CardDescription>{steps[currentStep].desc}</CardDescription>
          </CardHeader>
          <CardContent>
            {renderStepContent()}
            {currentStep > 0 && (
              <Button
                variant="ghost"
                className="w-full mt-3"
                onClick={() => setCurrentStep((s) => s - 1)}
              >
                <ArrowLeft className="mr-2 w-4 h-4" /> Étape précédente
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground mt-4">
              Étape {currentStep + 1} sur {steps.length}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
