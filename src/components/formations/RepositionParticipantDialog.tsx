import { useEffect, useState } from "react";
import { ArrowRightLeft, Loader2, Calendar, MapPin, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { formatDateRange } from "@/lib/dateFormatters";
import {
  fetchRepositioningTargets,
  repositionParticipant,
  type RepositioningTarget,
} from "@/services/repositioning";
import type { Participant } from "@/hooks/useEditParticipant";

interface Props {
  participant: Participant;
  trainingId: string;
  onRepositioned: () => void;
  /** Custom trigger element. If omitted, a default icon button is rendered. */
  trigger?: React.ReactNode;
}

const RepositionParticipantDialog = ({ participant, trainingId, onRepositioned, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [targets, setTargets] = useState<RepositioningTarget[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchRepositioningTargets(trainingId)
      .then(setTargets)
      .finally(() => setLoading(false));
  }, [open, trainingId]);

  const handleReposition = async (target: RepositioningTarget) => {
    setSubmitting(target.id);
    try {
      const r = await repositionParticipant(participant, target);
      const parts: string[] = [];
      if (r.welcomeSent) parts.push("mail d'accueil envoyé");
      else if (r.welcomeFailed) parts.push("⚠️ mail d'accueil en erreur");
      if (r.attendanceCatchUpSlots > 0) {
        parts.push(`${r.attendanceCatchUpSlots} émargement(s) rattrapé(s)`);
      }
      if (r.needsSurveySkipped) parts.push("⚠️ recueil des besoins non programmé");
      toast({
        title: "Participant repositionné",
        description: `Vers ${target.training_name}. ${parts.join(", ") || "Onboarding lancé."}`,
        duration: 6000,
      });
      setOpen(false);
      onRepositioned();
    } catch (err) {
      console.error("[Reposition] failed:", err);
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      const isDup = /duplicate|23505|already/i.test(msg);
      toast({
        title: "Repositionnement impossible",
        description: isDup
          ? "Ce participant est déjà inscrit à la session cible."
          : msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(null);
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
      Repositionner
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="w-full max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Repositionner le participant</DialogTitle>
          <DialogDescription>
            Choisissez une session future de la même formation. Le participant
            sera ajouté sur la nouvelle session avec tout l'onboarding (mails,
            convention, etc.) comme s'il venait d'être inscrit.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : targets.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Aucune session future disponible pour cette formation.
          </div>
        ) : (
          <div className="space-y-2 py-2">
            {targets.map((t) => {
              const full =
                t.max_participants != null && t.participant_count >= t.max_participants;
              return (
                <div
                  key={t.id}
                  className="border rounded-lg p-3 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{t.training_name}</div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDateRange(t.start_date, t.end_date) || "Dates non définies"}
                      </span>
                      {t.location && (
                        <span className="inline-flex items-center gap-1 truncate">
                          <MapPin className="h-3 w-3" />
                          {t.location}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {t.participant_count}
                        {t.max_participants ? ` / ${t.max_participants}` : ""}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleReposition(t)}
                    disabled={submitting !== null || full}
                  >
                    {submitting === t.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : full ? (
                      "Complète"
                    ) : (
                      "Repositionner"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RepositionParticipantDialog;
