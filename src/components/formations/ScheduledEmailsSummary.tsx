import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Mail, Clock, CheckCircle, AlertCircle, Loader2, Trash2, Eye, Send, Info, ChevronDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface ScheduledEmail {
  id: string;
  email_type: string;
  scheduled_for: string;
  sent_at: string | null;
  status: string;
  error_message: string | null;
  participant_id: string | null;
  training_id: string;
}

interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface Training {
  training_name: string;
  location: string;
  start_date: string;
  end_date: string | null;
  evaluation_link: string;
  supports_url: string | null;
}

interface Schedule {
  day_date: string;
  start_time: string;
  end_time: string;
}

interface ScheduledEmailsSummaryProps {
  trainingId: string;
  participants: Participant[];
}

const ScheduledEmailsSummary = ({ trainingId, participants }: ScheduledEmailsSummaryProps) => {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmail | null>(null);
  const [training, setTraining] = useState<Training | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [emailToDelete, setEmailToDelete] = useState<ScheduledEmail | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [forceSending, setForceSending] = useState<string | null>(null);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      // Fetch scheduled emails
      const { data: emailsData, error: emailsError } = await supabase
        .from("scheduled_emails")
        .select("*")
        .eq("training_id", trainingId)
        .order("scheduled_for", { ascending: true });

      if (!emailsError && emailsData) {
        setEmails(emailsData);
      }

      // Fetch training info
      const { data: trainingData } = await supabase
        .from("trainings")
        .select("training_name, location, start_date, end_date, evaluation_link, supports_url")
        .eq("id", trainingId)
        .single();

      if (trainingData) {
        setTraining(trainingData);
      }

      // Fetch schedules
      const { data: schedulesData } = await supabase
        .from("training_schedules")
        .select("day_date, start_time, end_time")
        .eq("training_id", trainingId)
        .order("day_date", { ascending: true });

      if (schedulesData) {
        setSchedules(schedulesData);
      }

      setLoading(false);
    };

    fetchData();
  }, [trainingId]);

  const refreshEmails = async () => {
    const { data, error } = await supabase
      .from("scheduled_emails")
      .select("*")
      .eq("training_id", trainingId)
      .order("scheduled_for", { ascending: true });

    if (!error && data) {
      setEmails(data);
    }
  };

  const getEmailTypeLabel = (type: string) => {
    switch (type) {
      case "welcome":
        return "Mail d'accueil";
      case "needs_survey":
        return "Recueil des besoins";
      case "reminder":
        return "Rappel logistique";
      case "trainer_summary":
        return "Synthèse formateur";
      case "thank_you":
        return "Remerciement";
      case "google_review":
        return "Avis Google";
      case "video_testimonial":
        return "Témoignage vidéo";
      case "cold_evaluation":
        return "Évaluation à froid commanditaire";
      default:
        return type;
    }
  };

  const getEmailSubject = (email: ScheduledEmail) => {
    if (!training) return "";
    
    switch (email.email_type) {
      case "welcome":
        return `Bienvenue à votre formation ${training.training_name}`;
      case "needs_survey":
        return `Questionnaire de recueil des besoins - ${training.training_name}`;
      case "reminder":
        return `Rappel : Formation ${training.training_name}`;
      case "trainer_summary":
        return `Synthèse pré-formation - ${training.training_name}`;
      case "thank_you":
        return `Merci pour votre participation à la formation ${training.training_name}`;
      case "google_review":
        return `🤩 Ton avis sur la formation ${training.training_name}`;
      case "video_testimonial":
        return `🎥 Ton avis sur la formation ${training.training_name} ?`;
      case "cold_evaluation":
        return `🫶🏻 Évaluation à froid de la formation ${training.training_name}`;
      default:
        return `Email concernant ${training.training_name}`;
    }
  };

  const getEmailContent = (email: ScheduledEmail) => {
    if (!training) return "";

    const participant = email.participant_id 
      ? participants.find(p => p.id === email.participant_id) 
      : null;
    
    const firstName = participant?.first_name || "";
    const greeting = firstName ? `Bonjour ${firstName},` : "Bonjour,";
    
    // Format training date
    const startDate = new Date(training.start_date);
    const trainingDate = startDate.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    // Format schedules
    const scheduleStr = schedules.map(s => {
      const date = new Date(s.day_date).toLocaleDateString('fr-FR', { 
        weekday: 'long', 
        day: 'numeric', 
        month: 'long' 
      });
      return `${date} : ${s.start_time.slice(0, 5)} - ${s.end_time.slice(0, 5)}`;
    }).join('\n') || '';

    switch (email.email_type) {
      case "welcome":
        return `${greeting}

Nous avons le plaisir de vous confirmer votre inscription à la formation "${training.training_name}".

Informations pratiques :
• Date : ${trainingDate}
• Horaires :
${scheduleStr}
• Lieu : ${training.location}

Nous restons à votre disposition pour toute question.

À très bientôt !

—
Romain Couturier
romain@supertilt.fr`;

      case "needs_survey":
        return `${greeting}

Vous êtes inscrit(e) à la formation "${training.training_name}" qui aura lieu le ${trainingDate}.

Afin de personnaliser cette formation à vos attentes, je vous invite à remplir un court questionnaire de recueil des besoins.

[Lien vers le questionnaire]

Ce questionnaire vous prendra environ 5 minutes et me permettra d'adapter le contenu de la formation à vos besoins spécifiques.

Merci de le compléter au moins 2 jours avant la formation.

—
Romain Couturier
romain@supertilt.fr`;

      case "reminder":
        return `${greeting}

Votre formation "${training.training_name}" approche !

Pour rappel :
• Date : ${trainingDate}
• Horaires :
${scheduleStr}
• Lieu : ${training.location}

N'hésitez pas à me contacter si vous avez des questions.

À très bientôt !

—
Romain Couturier
romain@supertilt.fr`;

      case "trainer_summary":
        return `Bonjour,

Voici la synthèse des besoins recueillis pour la formation "${training.training_name}" prévue le ${trainingDate}.

[Synthèse des réponses au questionnaire]

—
Romain Couturier
romain@supertilt.fr`;

      case "thank_you":
        const supportsSection = training.supports_url 
          ? `\nVous trouverez également tous les supports de la formation ici :\n${training.supports_url}\n`
          : "";
        
        return `Bonjour à toutes et à tous,

Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour votre énergie et votre participation pendant notre formation "${training.training_name}".

Pour finaliser cette formation, j'ai besoin que vous preniez quelques minutes pour compléter le questionnaire d'évaluation :
${training.evaluation_link}
${supportsSection}
Je suis curieux de voir comment vous allez utiliser tout ce que nous avons vu ! N'hésitez pas à me contacter si vous avez des questions.

Je vous souhaite une bonne journée

—
Romain Couturier
romain@supertilt.fr`;

      case "google_review":
        return `${greeting}

J'espère que tout va bien pour toi !

Pour continuer d'améliorer nos formations et partager des retours d'expérience avec d'autres professionnels, ton avis serait précieux.
Pourrais-tu nous accorder 1 minute pour laisser un commentaire sur notre page Google ?

👉 Clique ici pour laisser ton avis : https://g.page/r/CYFu8NVOFD31EBM/review

Ton retour est essentiel pour nous permettre de progresser et d'aider d'autres personnes à découvrir nos formations.

Merci infiniment pour ton soutien et pour avoir participé à notre formation ! 😊

À bientôt,

—
Romain Couturier
romain@supertilt.fr`;

      case "video_testimonial":
        return `${greeting}

J'espère que tu vas bien et que la formation "${training.training_name}" t'a apporté ce que tu en attendais.

Ton retour d'expérience serait très précieux pour moi et pour les futurs participants. Serais-tu d'accord pour partager ton témoignage en vidéo ?

Je te propose une courte interview ensemble via Zoom, cela prend seulement 10 minutes.

Réponds simplement "Je suis partant(e) !" à cet email et on organisera ça ensemble.

Les témoignages authentiques de personnes qui ont vraiment vécu la formation sont les plus inspirants pour ceux qui hésitent encore.

Merci d'avance pour ton aide !

Bonne journée

—
Romain Couturier
romain@supertilt.fr`;

      case "cold_evaluation":
        return `${greeting}

Comment vas-tu ?

Dans le cadre de mon processus qualité (Qualiopi), je propose désormais des évaluations à froid de mes formations.

❓ Pourrais-tu prendre 2 minutes pour remplir ce questionnaire en ligne ?

[Lien vers le questionnaire d'évaluation à froid]

Merci énormément pour ton soutien :-)

À bientôt

PS : on peut continuer à rester en contact sur LinkedIn et sur Instagram pour d'autres contenus sur le sujet de la formation.

—
Romain Couturier
romain@supertilt.fr`;

      default:
        return "Contenu de l'email non disponible.";
    }
  };

  const handleDeleteEmail = async () => {
    if (!emailToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("scheduled_emails")
        .delete()
        .eq("id", emailToDelete.id);

      if (error) throw error;

      toast({
        title: "Email supprimé",
        description: "L'email programmé a été supprimé.",
      });

      await refreshEmails();
      setEmailToDelete(null);
    } catch (error: any) {
      console.error("Error deleting email:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'email.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleForceSend = async (email: ScheduledEmail) => {
    setForceSending(email.id);
    try {
      const { data, error } = await supabase.functions.invoke("force-send-scheduled-email", {
        body: { scheduledEmailId: email.id },
      });

      if (error) throw error;

      toast({
        title: "Email envoyé",
        description: "L'email a été envoyé avec succès.",
      });

      await refreshEmails();
      setSelectedEmail(null);
    } catch (error: any) {
      console.error("Error force sending email:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer l'email.",
        variant: "destructive",
      });
    } finally {
      setForceSending(null);
    }
  };

  const getStatusBadge = (email: ScheduledEmail) => {
    if (email.status === "sent" || email.sent_at) {
      return (
        <Badge variant="default" className="bg-primary/80 hover:bg-primary">
          <CheckCircle className="h-3 w-3 mr-1" />
          Envoyé
        </Badge>
      );
    }
    if (email.status === "error" || email.error_message) {
      return (
        <Badge variant="destructive">
          <AlertCircle className="h-3 w-3 mr-1" />
          Erreur
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Clock className="h-3 w-3 mr-1" />
        Programmé
      </Badge>
    );
  };

  const getParticipantName = (participantId: string | null) => {
    if (!participantId) return "Tous les participants";
    const participant = participants.find(p => p.id === participantId);
    if (!participant) return "Participant inconnu";
    if (participant.first_name || participant.last_name) {
      return `${participant.first_name || ""} ${participant.last_name || ""}`.trim();
    }
    return participant.email;
  };

  // Group emails by type
  const groupedEmails = emails.reduce((acc, email) => {
    const type = email.email_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(email);
    return acc;
  }, {} as Record<string, ScheduledEmail[]>);

  // Calculate summary stats
  const totalEmails = emails.length;
  const sentEmails = emails.filter(e => e.status === "sent" || e.sent_at).length;
  const pendingEmails = emails.filter(e => e.status === "pending" && !e.sent_at).length;
  const errorEmails = emails.filter(e => e.status === "error" || e.error_message).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const SchedulingRulesInfo = () => (
    <Collapsible open={rulesExpanded} onOpenChange={setRulesExpanded}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground h-auto py-2 px-3">
          <Info className="h-4 w-4 flex-shrink-0" />
          <span className="text-xs text-left">Comment fonctionne la programmation des emails ?</span>
          <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${rulesExpanded ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-2">
          <p className="font-medium text-foreground">Déclencheur :</p>
          <p>La programmation des emails démarre automatiquement lors de l'<strong>ajout d'un participant</strong> à la formation.</p>
          
          <p className="font-medium text-foreground pt-2">Règles de programmation :</p>
          <ul className="space-y-1 list-none">
            <li className="flex items-start gap-2">
              <span className="text-primary font-medium">J {">"} 7</span>
              <span>→ Le questionnaire de recueil des besoins est programmé pour J-7</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-medium">J-7 à J-2</span>
              <span>→ Un mail d'accueil est envoyé immédiatement</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary font-medium">J {"<"} 2</span>
              <span>→ Mode manuel activé (aucun envoi automatique)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-muted-foreground">Formation passée</span>
              <span>→ Aucun email programmé</span>
            </li>
          </ul>
          
          <p className="font-medium text-foreground pt-2">Autres emails avant formation :</p>
          <ul className="space-y-1 list-none">
            <li>• <strong>J-X</strong> : Rappel logistique (configurable dans Paramètres)</li>
            <li>• <strong>J-X</strong> : Synthèse des besoins pour le formateur</li>
          </ul>
          
          <p className="font-medium text-foreground pt-2">Emails après formation :</p>
          <p className="text-xs italic mb-1">Programmés automatiquement lors de l'envoi du mail de remerciement</p>
          <ul className="space-y-1 list-none">
            <li>• <strong>J+X</strong> : Demande d'avis Google</li>
            <li>• <strong>J+X</strong> : Demande de témoignage vidéo</li>
            <li>• <strong>J+X</strong> : Évaluation à froid commanditaire</li>
          </ul>
          <p className="text-xs text-muted-foreground pt-2 italic">Les délais sont configurables dans Paramètres {">"} Général</p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );

  if (emails.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Emails programmés
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground text-center py-2">
            Aucun email programmé pour cette formation
          </p>
          <SchedulingRulesInfo />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Emails programmés
          </CardTitle>
          <CardDescription>
            {totalEmails} email{totalEmails > 1 ? "s" : ""} • {sentEmails} envoyé{sentEmails > 1 ? "s" : ""} • {pendingEmails} en attente
            {errorEmails > 0 && ` • ${errorEmails} erreur${errorEmails > 1 ? "s" : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(groupedEmails).map(([type, typeEmails]) => (
            <div key={type} className="space-y-2">
              <h4 className="text-sm font-medium flex items-center gap-2">
                {getEmailTypeLabel(type)}
                <Badge variant="outline" className="text-xs">
                  {typeEmails.length}
                </Badge>
              </h4>
              <div className="space-y-1.5">
                {typeEmails.map((email) => (
                  <div
                    key={email.id}
                    className="flex items-center justify-between gap-2 text-sm p-2 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => setSelectedEmail(email)}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="truncate block">
                        {getParticipantName(email.participant_id)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {email.sent_at 
                          ? `Envoyé le ${format(parseISO(email.sent_at), "d MMM à HH:mm", { locale: fr })}`
                          : `Prévu le ${format(parseISO(email.scheduled_for), "d MMM à HH:mm", { locale: fr })}`
                        }
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(email)}
                      {email.status !== "sent" && !email.sent_at && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary hover:text-primary/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleForceSend(email);
                          }}
                          disabled={forceSending === email.id}
                          title="Forcer l'envoi"
                        >
                          {forceSending === email.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEmail(email);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {email.status !== "sent" && !email.sent_at && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEmailToDelete(email);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {/* Scheduling rules info */}
          <SchedulingRulesInfo />
        </CardContent>
      </Card>

      {/* Email Detail Dialog */}
      <Dialog open={!!selectedEmail} onOpenChange={() => setSelectedEmail(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {selectedEmail && getEmailTypeLabel(selectedEmail.email_type)}
            </DialogTitle>
            <DialogDescription>
              De: Romain Couturier &lt;romain@supertilt.fr&gt;
              <br />
              À: {selectedEmail && getParticipantName(selectedEmail.participant_id)}
            </DialogDescription>
          </DialogHeader>
          
          {selectedEmail && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Objet</p>
                <p className="font-medium">{getEmailSubject(selectedEmail)}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Statut</p>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedEmail)}
                  <span className="text-sm text-muted-foreground">
                    {selectedEmail.sent_at 
                      ? `Envoyé le ${format(parseISO(selectedEmail.sent_at), "d MMMM yyyy à HH:mm", { locale: fr })}`
                      : `Prévu le ${format(parseISO(selectedEmail.scheduled_for), "d MMMM yyyy à HH:mm", { locale: fr })}`
                    }
                  </span>
                </div>
                {selectedEmail.error_message && (
                  <p className="text-sm text-destructive mt-1">{selectedEmail.error_message}</p>
                )}
              </div>
              
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Contenu</p>
                <div className="bg-muted/50 rounded-lg p-4 whitespace-pre-wrap text-sm font-mono">
                  {getEmailContent(selectedEmail)}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {selectedEmail && selectedEmail.status !== "sent" && !selectedEmail.sent_at && (
              <>
                <Button
                  variant="default"
                  onClick={() => handleForceSend(selectedEmail)}
                  disabled={forceSending === selectedEmail.id}
                >
                  {forceSending === selectedEmail.id ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Envoyer maintenant
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setSelectedEmail(null);
                    setEmailToDelete(selectedEmail);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </Button>
              </>
            )}
            <Button variant="outline" onClick={() => setSelectedEmail(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!emailToDelete} onOpenChange={() => setEmailToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cet email programmé ?</AlertDialogTitle>
            <AlertDialogDescription>
              L'email "{emailToDelete && getEmailTypeLabel(emailToDelete.email_type)}" prévu pour{" "}
              {emailToDelete && getParticipantName(emailToDelete.participant_id)} sera définitivement supprimé.
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteEmail}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ScheduledEmailsSummary;
