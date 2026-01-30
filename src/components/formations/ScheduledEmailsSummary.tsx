import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mail, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

interface ScheduledEmail {
  id: string;
  email_type: string;
  scheduled_for: string;
  sent_at: string | null;
  status: string;
  error_message: string | null;
  participant_id: string | null;
}

interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
}

interface ScheduledEmailsSummaryProps {
  trainingId: string;
  participants: Participant[];
}

const ScheduledEmailsSummary = ({ trainingId, participants }: ScheduledEmailsSummaryProps) => {
  const [emails, setEmails] = useState<ScheduledEmail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchScheduledEmails = async () => {
      const { data, error } = await supabase
        .from("scheduled_emails")
        .select("*")
        .eq("training_id", trainingId)
        .order("scheduled_for", { ascending: true });

      if (!error && data) {
        setEmails(data);
      }
      setLoading(false);
    };

    fetchScheduledEmails();
  }, [trainingId]);

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
      default:
        return type;
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

  if (emails.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Emails programmés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun email programmé pour cette formation
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
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
                  className="flex items-center justify-between gap-2 text-sm p-2 rounded-md bg-muted/50"
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
                  {getStatusBadge(email)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default ScheduledEmailsSummary;
