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
  sponsor_first_name: string | null;
  sponsor_last_name: string | null;
  sponsor_email: string | null;
  format_formation: string | null;
}

interface Schedule {
  day_date: string;
  start_time: string;
  end_time: string;
}

interface ScheduledEmailsSummaryProps {
  trainingId: string;
  participants: Participant[];
  refreshTrigger?: number;
}

interface DelaySettings {
  delayLogisticReminder: number;
  delayTrainerSummary: number;
  delayGoogleReview: number;
  delayVideoTestimonial: number;
  delayColdEvaluation: number;
  delayColdEvaluationFunder: number;
  delayEvaluationReminder1: number;
  delayEvaluationReminder2: number;
  delayFollowUpNews: number;
}

const ScheduledEmailsSummary = ({ trainingId, participants, refreshTrigger }: ScheduledEmailsSummaryProps) => {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmail | null>(null);
  const [training, setTraining] = useState<Training | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [emailToDelete, setEmailToDelete] = useState<ScheduledEmail | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [forceSending, setForceSending] = useState<string | null>(null);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [delaySettings, setDelaySettings] = useState<DelaySettings>({
    delayLogisticReminder: 3,
    delayTrainerSummary: 1,
    delayGoogleReview: 7,
    delayVideoTestimonial: 14,
    delayColdEvaluation: 30,
    delayColdEvaluationFunder: 45,
    delayEvaluationReminder1: 2,
    delayEvaluationReminder2: 5,
    delayFollowUpNews: 30,
  });
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
        .select("training_name, location, start_date, end_date, evaluation_link, supports_url, sponsor_first_name, sponsor_last_name, sponsor_email, format_formation")
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

      // Fetch delay settings
      const { data: settingsData } = await supabase
        .from("app_settings")
        .select("setting_key, setting_value")
        .in("setting_key", [
          "delay_logistic_reminder_days",
          "delay_trainer_summary_days",
          "delay_google_review_days",
          "delay_video_testimonial_days",
          "delay_cold_evaluation_days",
          "delay_cold_evaluation_funder_days",
          "delay_evaluation_reminder_1_days",
          "delay_evaluation_reminder_2_days",
          "delay_follow_up_news_days",
        ]);

      if (settingsData) {
        const newSettings: Partial<DelaySettings> = {};
        settingsData.forEach((s) => {
          const val = parseInt(s.setting_value || "0", 10);
          if (s.setting_key === "delay_logistic_reminder_days") newSettings.delayLogisticReminder = val || 3;
          if (s.setting_key === "delay_trainer_summary_days") newSettings.delayTrainerSummary = val || 1;
          if (s.setting_key === "delay_google_review_days") newSettings.delayGoogleReview = val || 7;
          if (s.setting_key === "delay_video_testimonial_days") newSettings.delayVideoTestimonial = val || 14;
          if (s.setting_key === "delay_cold_evaluation_days") newSettings.delayColdEvaluation = val || 30;
          if (s.setting_key === "delay_cold_evaluation_funder_days") newSettings.delayColdEvaluationFunder = val || 45;
          if (s.setting_key === "delay_evaluation_reminder_1_days") newSettings.delayEvaluationReminder1 = val || 2;
          if (s.setting_key === "delay_evaluation_reminder_2_days") newSettings.delayEvaluationReminder2 = val || 5;
          if (s.setting_key === "delay_follow_up_news_days") newSettings.delayFollowUpNews = val || 30;
        });
        setDelaySettings((prev) => ({ ...prev, ...newSettings }));
      }

      setLoading(false);
    };

    fetchData();
  }, [trainingId]);
  
  // Refresh when refreshTrigger changes
  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      refreshEmails();
    }
  }, [refreshTrigger]);

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
    const labels: Record<string, string> = {
      welcome: "Mail d'accueil",
      needs_survey: "Recueil des besoins",
      needs_survey_reminder: "Relance recueil des besoins",
      reminder: "Rappel logistique",
      trainer_summary: "Synthèse formateur",
      thank_you: "Remerciement",
      google_review: "Avis Google",
      video_testimonial: "Témoignage vidéo",
      cold_evaluation: "Évaluation à froid commanditaire",
      funder_reminder: "Rappel financeur",
      evaluation_reminder_1: "Relance évaluation (1ère)",
      evaluation_reminder_2: "Relance évaluation (2ème)",
      follow_up_news: "Prise de nouvelles",
      live_reminder: "Rappel live / visio",
      coaching_first_invite: "Invitation coaching (J+1)",
      coaching_periodic_reminder: "Rappel coaching périodique",
      coaching_final_reminder: "Rappel coaching (dernier mois)",
      booking_reminder: "Rappel réservation coaching",
      next_inter_session_reminder: "Programmer prochaine session inter",
      participant_list_reminder: "Rappel liste participants",
      elearning_access: "Accès e-learning",
      certificate: "Envoi certificat",
    };
    return labels[type] || type;
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
      case "funder_reminder":
        return `📋 Rappel : Contacter le financeur pour ${training.training_name}`;
      case "evaluation_reminder_1":
        return `📝 Petit rappel : ton avis compte pour "${training.training_name}"`;
      case "evaluation_reminder_2":
        return `🙏 Dernière relance : ta contribution pour "${training.training_name}"`;
      case "follow_up_news":
        return `Des nouvelles depuis la formation ?`;
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
{{sender_name}}
{{sender_email}}`;

      case "needs_survey":
        return `${greeting}

Vous êtes inscrit(e) à la formation "${training.training_name}" qui aura lieu le ${trainingDate}.

Afin de personnaliser cette formation à vos attentes, je vous invite à remplir un court questionnaire de recueil des besoins.

[Lien vers le questionnaire]

Ce questionnaire vous prendra environ 5 minutes et me permettra d'adapter le contenu de la formation à vos besoins spécifiques.

Merci de le compléter au moins 2 jours avant la formation.

—
{{sender_name}}
{{sender_email}}`;

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
{{sender_name}}
{{sender_email}}`;

      case "trainer_summary":
        return `Bonjour,

Voici la synthèse des besoins recueillis pour la formation "${training.training_name}" prévue le ${trainingDate}.

[Synthèse des réponses au questionnaire]

—
{{sender_name}}
{{sender_email}}`;

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
{{sender_name}}
{{sender_email}}`;

      case "google_review":
        return `${greeting}

J'espère que tout va bien pour toi !

Pour continuer d'améliorer nos formations et partager des retours d'expérience avec d'autres professionnels, ton avis serait précieux.
Pourrais-tu nous accorder 1 minute pour laisser un commentaire sur notre page Google ?

👉 Clique ici pour laisser ton avis : [Lien configuré dans Paramètres > Général]

Ton retour est essentiel pour nous permettre de progresser et d'aider d'autres personnes à découvrir nos formations.

Merci infiniment pour ton soutien et pour avoir participé à notre formation ! 😊

À bientôt,

—
{{sender_name}}
{{sender_email}}`;

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
{{sender_name}}
{{sender_email}}`;

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
{{sender_name}}
{{sender_email}}`;

      case "funder_reminder":
        return `Bonjour,

C'est le moment de contacter le financeur pour la formation "${training.training_name}".

N'oublie pas de faire le bilan qualité avec eux !

—
{{sender_name}}
{{sender_email}}`;

      case "evaluation_reminder_1":
        return `${greeting}

J'espère que tu vas bien et que tu as pu commencer à mettre en pratique ce que nous avons vu ensemble lors de la formation "${training.training_name}" !

Je me permets de te relancer car je n'ai pas encore reçu ton évaluation. Ton retour est vraiment précieux pour moi : il m'aide à améliorer continuellement mes formations et à mieux répondre aux attentes des futurs participants.

Cela ne prend que 2-3 minutes :
[Lien vers l'évaluation]

Un grand merci d'avance pour ta contribution !

Belle journée à toi

—
{{sender_name}}
{{sender_email}}`;

      case "evaluation_reminder_2":
        return `${greeting}

Je reviens vers toi une dernière fois concernant l'évaluation de la formation "${training.training_name}".

En tant qu'organisme certifié Qualiopi, la collecte de ces retours est essentielle pour maintenir notre certification et garantir la qualité de nos formations. Ton avis, même bref, a un vrai impact !

Si tu as 2 minutes, voici le lien :
[Lien vers l'évaluation]

Je te remercie sincèrement pour ton aide et te souhaite une excellente continuation dans tes projets !

À bientôt

—
{{sender_name}}
{{sender_email}}`;

      case "follow_up_news":
        return `${greeting}

[Message généré par IA — personnalisé selon l'évaluation du participant]

Ce message est un email informel de prise de nouvelles, généré automatiquement par l'IA pour prendre des nouvelles du participant après la formation "${training.training_name}".

Le contenu sera adapté en fonction :
• Des réponses à l'évaluation (objectifs, freins, appréciation)
• Du prénom du participant
• Du nom de la formation

L'objectif est de renouer le contact de manière humaine et naturelle, sans questionnaire ni lien.

—
{{sender_name}}
{{sender_email}}`;

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

  const getParticipantName = (email: ScheduledEmail) => {
    if (!email.participant_id) {
      // For cold_evaluation with no participant (intra): show sponsor name
      if (email.email_type === "cold_evaluation" && training) {
        const sponsorName = [training.sponsor_first_name, training.sponsor_last_name].filter(Boolean).join(" ");
        if (sponsorName) return `Commanditaire : ${sponsorName}`;
        if (training.sponsor_email) return `Commanditaire : ${training.sponsor_email}`;
      }
      return "Tous les participants";
    }
    const participant = participants.find(p => p.id === email.participant_id);
    if (!participant) return "Participant inconnu";
    if (participant.first_name || participant.last_name) {
      return `${participant.first_name || ""} ${participant.last_name || ""}`.trim();
    }
    return participant.email;
  };

  // Split emails into pending vs sent
  const pendingEmailsList = emails.filter(e => e.status === "pending" && !e.sent_at);
  const sentEmailsList = emails.filter(e => e.status === "sent" || e.sent_at);
  const errorEmailsList = emails.filter(e => e.status === "error" && !e.sent_at);
  // Errors go in the scheduled section
  const scheduledEmails = [...pendingEmailsList, ...errorEmailsList];

  // Group each section by type
  const groupByType = (list: ScheduledEmail[]) =>
    list.reduce((acc, email) => {
      const type = email.email_type;
      if (!acc[type]) acc[type] = [];
      acc[type].push(email);
      return acc;
    }, {} as Record<string, ScheduledEmail[]>);

  const groupedScheduled = groupByType(scheduledEmails);
  const groupedSent = groupByType(sentEmailsList);

  // Calculate summary stats
  const totalEmails = emails.length;
  const sentEmails = sentEmailsList.length;
  const pendingEmails = pendingEmailsList.length;
  const errorEmails = errorEmailsList.length;

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
          <span className="text-xs text-left">📋 Récap complet de tous les emails automatisés</span>
          <ChevronDown className={`h-3 w-3 ml-auto transition-transform ${rulesExpanded ? "rotate-180" : ""}`} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-4">

          {/* ===== INSCRIPTION ===== */}
          <div>
            <p className="font-medium text-foreground text-sm mb-1">📝 À l'inscription d'un participant</p>
            <ul className="space-y-1 list-none mt-1">
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J {">"} 7</span>
                <span>→ <strong>Recueil des besoins</strong> programmé pour J-7 + <strong>Mail d'accueil</strong> immédiat</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J-7 à J-2</span>
                <span>→ <strong>Mail d'accueil</strong> envoyé immédiatement (pas de recueil des besoins)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J {"<"} 2</span>
                <span>→ Mode manuel (aucun envoi automatique)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-muted-foreground min-w-[90px]">E-learning</span>
                <span>→ <strong>Accès e-learning</strong> + coupon WooCommerce envoyés à l'ajout</span>
              </li>
            </ul>
          </div>

          {/* ===== AVANT FORMATION ===== */}
          <div>
            <p className="font-medium text-foreground text-sm mb-1">📅 Avant la formation <span className="text-xs font-normal text-muted-foreground">(automatique, cron quotidien)</span></p>
            <ul className="space-y-1 list-none mt-1">
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J-7</span>
                <span>→ <strong>Rappel liste participants</strong> au formateur (si liste incomplète)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J-{delaySettings.delayLogisticReminder}</span>
                <span>→ <strong>Rappel logistique</strong> aux participants (convocation, horaires, lieu)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J-{delaySettings.delayTrainerSummary}</span>
                <span>→ <strong>Synthèse des besoins</strong> au formateur</span>
              </li>
            </ul>
          </div>

          {/* ===== PENDANT FORMATION ===== */}
          <div>
            <p className="font-medium text-foreground text-sm mb-1">🎯 Pendant la formation <span className="text-xs font-normal text-muted-foreground">(temps réel, cron /15min)</span></p>
            <ul className="space-y-1 list-none mt-1">
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">Début session</span>
                <span>→ <strong>Émargement</strong> envoyé aux participants (matin + après-midi)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">Début session</span>
                <span>→ <strong>Notification formateur</strong> (récap participants présents)</span>
              </li>
            </ul>
          </div>

          {/* ===== LIVES / VISIOS ===== */}
          <div>
            <p className="font-medium text-foreground text-sm mb-1">📹 Lives / Visios programmées <span className="text-xs font-normal text-muted-foreground">(cron quotidien)</span></p>
            <ul className="space-y-1 list-none mt-1">
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J-1</span>
                <span>→ <strong>Rappel live</strong> envoyé à chaque participant inscrit (avec lien visio)</span>
              </li>
            </ul>
          </div>

          {/* ===== FIN DE FORMATION ===== */}
          <div>
            <p className="font-medium text-foreground text-sm mb-1">🎉 Fin de formation <span className="text-xs font-normal text-muted-foreground">(déclenché manuellement via "Envoyer remerciement")</span></p>
            <ul className="space-y-1 list-none mt-1">
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">Immédiat</span>
                <span>→ <strong>Mail de remerciement</strong> avec lien évaluation + supports</span>
              </li>
            </ul>
            <p className="text-xs italic mt-1 mb-1 text-muted-foreground">↓ Les emails suivants sont programmés automatiquement à ce moment :</p>
            <ul className="space-y-1 list-none">
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J+{delaySettings.delayGoogleReview}</span>
                <span>→ <strong>Avis Google</strong> (participant)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J+{delaySettings.delayEvaluationReminder1}</span>
                <span>→ <strong>1ère relance évaluation</strong> (annulée si déjà soumise)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J+{delaySettings.delayVideoTestimonial}</span>
                <span>→ <strong>Témoignage vidéo</strong> (participant)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J+{delaySettings.delayEvaluationReminder2}</span>
                <span>→ <strong>2ème relance évaluation</strong> (annulée si déjà soumise)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J+{delaySettings.delayColdEvaluation}</span>
                <span>→ <strong>Évaluation à froid</strong> (commanditaire / sponsor)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J+{delaySettings.delayColdEvaluationFunder}</span>
                <span>→ <strong>Rappel financeur</strong> (si différent du commanditaire)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J+{delaySettings.delayFollowUpNews}</span>
                <span>→ <strong>Prise de nouvelles</strong> personnalisée par IA (participant)</span>
              </li>
            </ul>
          </div>

          {/* ===== INTER-ENTREPRISE ONLY ===== */}
          <div>
            <p className="font-medium text-foreground text-sm mb-1">🏢 Inter-entreprise uniquement</p>
            <ul className="space-y-1 list-none mt-1">
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J+7</span>
                <span>→ <strong>Prochaine session inter</strong> : email au formateur pour planifier la prochaine session</span>
              </li>
            </ul>
          </div>

          {/* ===== COACHING ===== */}
          <div>
            <p className="font-medium text-foreground text-sm mb-1">🧠 Coaching <span className="text-xs font-normal text-muted-foreground">(si formule avec sessions coaching, cron quotidien)</span></p>
            <ul className="space-y-1 list-none mt-1">
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J+1 (fin)</span>
                <span>→ <strong>Invitation coaching</strong> initiale au participant</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">Tous les 3 mois</span>
                <span>→ <strong>Rappel périodique</strong> (tant que sessions non utilisées)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">M-1 (deadline)</span>
                <span>→ <strong>Rappel final</strong> coaching (dernière chance avant expiration)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary font-medium min-w-[90px]">J-1 (rdv)</span>
                <span>→ <strong>Rappel réservation</strong> coaching (veille d'un créneau réservé)</span>
              </li>
            </ul>
            <p className="text-xs italic mt-1">⚠️ Si quota = 0 ou deadline absente → alerte envoyée au formateur au lieu du participant</p>
          </div>

          <p className="text-xs text-muted-foreground pt-1 italic border-t border-border mt-2 pt-2">
            💡 Les délais post-formation sont configurables dans Paramètres {">"} Général. Tous les envois respectent les jours ouvrables. Les emails tu/vous sont choisis automatiquement selon la préférence du participant.
          </p>
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
          {/* Sub-section: Programmés */}
          {scheduledEmails.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Programmés ({scheduledEmails.length})
              </p>
              {Object.entries(groupedScheduled).map(([type, typeEmails]) => (
                <Collapsible key={`scheduled-${type}`} defaultOpen={false}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between h-auto py-2 px-3 hover:bg-muted/50">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {getEmailTypeLabel(type)}
                        <Badge variant="outline" className="text-xs">{typeEmails.length}</Badge>
                      </span>
                      <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-1.5 mt-2 ml-3">
                      {typeEmails.map((email) => (
                        <div
                          key={email.id}
                          className="flex items-center justify-between gap-2 text-sm p-2 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                          onClick={() => setSelectedEmail(email)}
                        >
                          <div className="flex-1 min-w-0">
                            <span className="truncate block">{getParticipantName(email)}</span>
                            <span className="text-xs text-muted-foreground">
                              Prévu le {format(parseISO(email.scheduled_for), "d MMM à HH:mm", { locale: fr })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(email)}
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-primary hover:text-primary/80"
                              onClick={(e) => { e.stopPropagation(); handleForceSend(email); }}
                              disabled={forceSending === email.id} title="Forcer l'envoi">
                              {forceSending === email.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); setSelectedEmail(email); }}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setEmailToDelete(email); }}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}

          {/* Sub-section: Envoyés */}
          {sentEmailsList.length > 0 && (
            <div className="space-y-2">
              {scheduledEmails.length > 0 && <div className="border-t pt-4" />}
              <p className="text-sm font-medium flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-primary" />
                Envoyés ({sentEmailsList.length})
              </p>
              {Object.entries(groupedSent).map(([type, typeEmails]) => (
                <Collapsible key={`sent-${type}`} defaultOpen={false}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between h-auto py-2 px-3 hover:bg-muted/50">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        {getEmailTypeLabel(type)}
                        <Badge className="text-xs bg-primary/10 text-primary">{typeEmails.length}</Badge>
                      </span>
                      <ChevronDown className="h-4 w-4 transition-transform [[data-state=open]>&]:rotate-180" />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="space-y-1.5 mt-2 ml-3">
                      {typeEmails.map((email) => (
                        <div
                          key={email.id}
                          className="flex items-center justify-between gap-2 text-sm p-2 rounded-md bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                          onClick={() => setSelectedEmail(email)}
                        >
                          <div className="flex-1 min-w-0">
                            <span className="truncate block">{getParticipantName(email)}</span>
                            <span className="text-xs text-muted-foreground">
                              Envoyé le {format(parseISO(email.sent_at!), "d MMM à HH:mm", { locale: fr })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(email)}
                            <Button variant="ghost" size="icon" className="h-7 w-7"
                              onClick={(e) => { e.stopPropagation(); setSelectedEmail(email); }}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          )}

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
              De: {"{sender_name}"} &lt;{"{sender_email}"}&gt;
              <br />
              À: {selectedEmail && getParticipantName(selectedEmail)}
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
              {emailToDelete && getParticipantName(emailToDelete)} sera définitivement supprimé.
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
