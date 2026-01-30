import { HelpCircle, Mail, MailCheck, Clock, CheckCircle, AlertTriangle, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  needs_survey_status: string;
  needs_survey_sent_at: string | null;
  added_at: string;
}

interface ParticipantListProps {
  participants: Participant[];
  onParticipantUpdated: () => void;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case "non_envoye":
      return {
        label: "Non envoyé",
        icon: Mail,
        variant: "secondary" as const,
        tooltip: "Le questionnaire n'a pas encore été envoyé",
      };
    case "envoye":
      return {
        label: "Envoyé",
        icon: MailCheck,
        variant: "outline" as const,
        tooltip: "Le questionnaire a été envoyé, en attente de réponse",
      };
    case "en_cours":
      return {
        label: "En cours",
        icon: Clock,
        variant: "default" as const,
        tooltip: "Le participant a commencé à remplir le questionnaire",
      };
    case "complete":
      return {
        label: "Complété",
        icon: CheckCircle,
        variant: "default" as const,
        tooltip: "Le questionnaire a été complété",
      };
    case "valide_formateur":
      return {
        label: "Validé",
        icon: CheckCircle,
        variant: "default" as const,
        tooltip: "Le formateur a validé les réponses",
      };
    case "expire":
      return {
        label: "Expiré",
        icon: AlertTriangle,
        variant: "destructive" as const,
        tooltip: "Le lien du questionnaire a expiré",
      };
    default:
      return {
        label: status,
        icon: HelpCircle,
        variant: "secondary" as const,
        tooltip: "Statut inconnu",
      };
  }
};

const ParticipantList = ({ participants, onParticipantUpdated }: ParticipantListProps) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast } = useToast();

  const handleDelete = async (participant: Participant) => {
    setDeletingId(participant.id);
    try {
      // Delete related questionnaire_besoins first (if any)
      await supabase
        .from("questionnaire_besoins")
        .delete()
        .eq("participant_id", participant.id);

      // Delete the participant
      const { error } = await supabase
        .from("training_participants")
        .delete()
        .eq("id", participant.id);

      if (error) throw error;

      toast({
        title: "Participant supprimé",
        description: `${participant.email} a été retiré de la formation.`,
      });

      onParticipantUpdated();
    } catch (error: any) {
      console.error("Error deleting participant:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer le participant.",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (participants.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg">Aucun participant inscrit</p>
        <p className="text-sm">Ajoutez des participants pour commencer</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nom</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Société</TableHead>
          <TableHead>Recueil des besoins</TableHead>
          <TableHead className="w-12"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {participants.map((participant) => {
          const statusConfig = getStatusConfig(participant.needs_survey_status);
          const StatusIcon = statusConfig.icon;
          const displayName = participant.first_name || participant.last_name
            ? `${participant.first_name || ""} ${participant.last_name || ""}`.trim()
            : participant.email;

          return (
            <TableRow key={participant.id}>
              <TableCell className="font-medium">
                {participant.first_name || participant.last_name
                  ? `${participant.first_name || ""} ${participant.last_name || ""}`.trim()
                  : "—"}
              </TableCell>
              <TableCell>{participant.email}</TableCell>
              <TableCell>{participant.company || "—"}</TableCell>
              <TableCell>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge
                      variant={statusConfig.variant}
                      className="cursor-help gap-1"
                    >
                      <StatusIcon className="h-3 w-3" />
                      {statusConfig.label}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{statusConfig.tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TableCell>
              <TableCell>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      disabled={deletingId === participant.id}
                    >
                      {deletingId === participant.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Supprimer ce participant ?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {displayName} sera définitivement retiré de cette formation.
                        Ses réponses au questionnaire seront également supprimées.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuler</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(participant)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Supprimer
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};

export default ParticipantList;
