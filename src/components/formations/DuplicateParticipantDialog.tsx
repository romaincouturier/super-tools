import { useEffect, useMemo, useState } from "react";
import { Copy, Calendar, MapPin, Users, Search } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { formatDateRange } from "@/lib/dateFormatters";
const normalizeText = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
import type { Participant } from "@/hooks/useEditParticipant";
import type { AddParticipantResponse } from "@/types/addParticipant";

interface DuplicateTarget {
  id: string;
  training_name: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  format_formation: string | null;
  max_participants: number | null;
  participant_count: number;
}

interface Props {
  participant: Participant;
  trainingId: string;
  onDuplicated: () => void;
  trigger?: React.ReactNode;
}

const formatLabel = (f: string | null) => {
  switch (f) {
    case "inter-entreprises":
      return "Inter";
    case "intra-entreprise":
      return "Intra";
    case "e_learning":
      return "E-learning";
    default:
      return f || "—";
  }
};

const DuplicateParticipantDialog = ({ participant, trainingId, onDuplicated, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [targets, setTargets] = useState<DuplicateTarget[]>([]);
  const [query, setQuery] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const { data: sessions, error } = await supabase
          .from("trainings")
          .select(
            "id, training_name, start_date, end_date, location, format_formation, max_participants",
          )
          .or(
            `start_date.gte.${today},start_date.is.null,end_date.gte.${today}`,
          )
          .or("is_cancelled.is.null,is_cancelled.eq.false")
          .order("start_date", { ascending: true });
        if (error) throw error;

        const ids = (sessions || []).map((s) => s.id);
        const countsMap = new Map<string, number>();
        if (ids.length > 0) {
          const { data: parts } = await supabase
            .from("training_participants")
            .select("training_id")
            .in("training_id", ids)
            .is("repositioned_to_training_id", null);
          (parts || []).forEach((p) => {
            countsMap.set(p.training_id, (countsMap.get(p.training_id) || 0) + 1);
          });
        }

        setTargets(
          (sessions || []).map((s) => ({
            ...s,
            participant_count: countsMap.get(s.id) || 0,
          })),
        );
      } catch (err) {
        console.error("[duplicate] fetch targets failed:", err);
        toast({
          title: "Erreur",
          description: "Impossible de charger les sessions cibles.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [open, trainingId, toast]);

  const filteredTargets = useMemo(() => {
    const q = normalizeText(query.trim());
    if (!q) return targets;
    const terms = q.split(/\s+/).filter(Boolean);
    return targets.filter((t) => {
      const hay = normalizeText(
        `${t.training_name || ""} ${t.location || ""} ${formatLabel(t.format_formation)} ${t.start_date || ""}`,
      );
      return terms.every((term) => hay.includes(term));
    });
  }, [targets, query]);

  const handleDuplicate = async (target: DuplicateTarget) => {
    setSubmitting(target.id);
    try {
      const isInter =
        target.format_formation === "inter-entreprises" ||
        target.format_formation === "e_learning";
      const coachingSessionsTotal = participant.coaching_sessions_total || 0;
      const coachingDeadline =
        coachingSessionsTotal > 0
          ? (() => {
              const d = new Date();
              d.setFullYear(d.getFullYear() + 1);
              return format(d, "yyyy-MM-dd");
            })()
          : null;

      const { data, error } = await supabase.functions.invoke<AddParticipantResponse>(
        "add-training-participant",
        {
          body: {
            draft: true,
            trainingId: target.id,
            trainingStartDate: target.start_date,
            trainingEndDate: target.end_date,
            formatFormation: target.format_formation,
            isInterEntreprise: isInter,
            company: participant.company || "",
            companyAddress: participant.company_address || null,
            companyZip: participant.company_zip || null,
            companyCity: participant.company_city || null,
            soldPriceHt: participant.sold_price_ht ?? null,
            paymentMode: participant.payment_mode === "online" ? "online" : "invoice",
            formulaId: participant.formula_id || null,
            formulaName: participant.formula || null,
            coachingSessionsTotal,
            coachingDeadline,
            sponsorFirstName: participant.sponsor_first_name || "",
            sponsorLastName: participant.sponsor_last_name || "",
            sponsorEmail: participant.sponsor_email || "",
            financeurSameAsSponsor: participant.financeur_same_as_sponsor ?? true,
            financeurName: participant.financeur_name || "",
            financeurUrl: participant.financeur_url || "",
            generateCoupon: false,
            source: "manual",
          },
        },
      );

      if (error) throw error;
      if (!data) throw new Error("Pas de réponse de add-training-participant");

      toast({
        title: "Participant dupliqué",
        description: `Un participant à compléter (nom, prénom, email vides) a été créé dans « ${target.training_name} ».`,
      });
      setOpen(false);
      onDuplicated();
    } catch (err) {
      const e = err as { code?: string; message?: string };
      const msg = e?.message || "Erreur inconnue";
      const isDup = e?.code === "23505" || /duplicate|already/i.test(msg);
      toast({
        title: "Duplication impossible",
        description: isDup
          ? "Ce participant est déjà inscrit à cette session."
          : msg,
        variant: "destructive",
      });
    } finally {
      setSubmitting(null);
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Copy className="h-3.5 w-3.5 mr-1.5" />
      Dupliquer
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger ?? defaultTrigger}</DialogTrigger>
      <DialogContent className="w-full sm:max-w-2xl flex flex-col max-h-[80vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>Dupliquer le participant</DialogTitle>
          <DialogDescription>
            Choisissez la formation cible (y compris la formation actuelle). Toutes
            les informations sont copiées sauf le nom, le prénom et l'email qui
            restent à compléter. Aucun onboarding (mails, convention) n'est lancé.
          </DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par nom, lieu, format…"
            className="pl-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="py-12 flex justify-center">
            <Spinner className="h-6 w-6 text-primary" />
          </div>
        ) : filteredTargets.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            {targets.length === 0
              ? "Aucune session future disponible."
              : "Aucun résultat pour cette recherche."}
          </div>
        ) : (
          <div className="space-y-2 py-2">
            {filteredTargets.map((t) => {
              const full =
                t.max_participants != null && t.participant_count >= t.max_participants;
              return (
                <div
                  key={t.id}
                  className="border rounded-lg p-3 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium truncate">{t.training_name}</div>
                      <Badge variant="secondary" className="text-[10px]">
                        {formatLabel(t.format_formation)}
                      </Badge>
                      {t.id === trainingId && (
                        <Badge variant="outline" className="text-[10px]">Formation actuelle</Badge>
                      )}
                    </div>
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
                    onClick={() => handleDuplicate(t)}
                    disabled={submitting !== null || full}
                  >
                    {submitting === t.id ? (
                      <Spinner className="h-3.5 w-3.5" />
                    ) : full ? (
                      "Complète"
                    ) : (
                      "Dupliquer"
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicateParticipantDialog;
