import { Calendar, FileText, MapPin, Building, Clock, Copy, Check, Euro, Mail, ExternalLink, Truck, CheckCircle2 } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import { formatSentDateTime } from "@/lib/dateFormatters";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useToast } from "@/hooks/use-toast";
import { User as UserIconLucide } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import type { Training, Schedule, Participant } from "@/hooks/useFormationDetail";
import type { FormationFormula } from "@/types/training";

interface Props {
  training: Training;
  schedules: Schedule[];
  participants: Participant[];
  availableFormulas: FormationFormula[];
  assignedUserName: string | null;
  isInterSession: boolean;
  getFormatLabel: () => string | null;
  calculateTotalDuration: () => number;
}

const FormationDetailInfo = ({
  training,
  schedules,
  participants,
  availableFormulas,
  assignedUserName,
  isInterSession,
  getFormatLabel,
  calculateTotalDuration,
}: Props) => {
  const { toast } = useToast();
  const { loading: sendingLogistics, invoke: invokeSendLogistics } = useEdgeFunction(
    "send-logistics-requirements",
    { errorMessage: "Impossible d'envoyer l'email." },
  );
  // Each copy button has its own `copied` flag (one hook instance each) so the
  // three ✓ indicators stay independent.
  const { copy: copyClientAddress } = useCopyToClipboard();
  const { copied: copiedLocation, copy: copyLocation } = useCopyToClipboard();
  const { copied: copiedEmail, copy: copyEmail } = useCopyToClipboard();

  const handleSendLogisticsEmail = async () => {
    const result = await invokeSendLogistics({ trainingId: training.id });
    if (result !== null) {
      toast({
        title: "Email envoyé",
        description: `Les besoins logistiques ont été envoyés à ${training.sponsor_email}.`,
      });
    }
  };

  const isPresentiel = training.format_formation !== "e_learning" && training.format_formation !== "classe_virtuelle";

  return (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <Calendar className="h-5 w-5" />
        Informations
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {/* Quick info badges */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="flex items-center gap-1.5">
          <Building className="h-3.5 w-3.5" />{training.client_name}
        </Badge>
        {training.client_address && (
          <Badge variant="outline" className="flex items-center gap-1.5 group">
            <MapPin className="h-3.5 w-3.5" />{training.client_address}
            <button type="button" className="ml-1 p-0.5 rounded hover:bg-muted transition-colors" onClick={() => copyClientAddress(training.client_address!, { title: "Adresse copiée", description: "L'adresse du client a été copiée." })}>
              <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          </Badge>
        )}
        <Badge variant="outline" className="flex items-center gap-1.5 group">
          <MapPin className="h-3.5 w-3.5" />{training.location}
          <button type="button" className="ml-1 p-0.5 rounded hover:bg-muted transition-colors" onClick={() => copyLocation(training.location, { title: "Adresse copiée", description: "L'adresse a été copiée dans le presse-papiers." })}>
            {copiedLocation ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />}
          </button>
        </Badge>
        {getFormatLabel() && <Badge variant="secondary">{getFormatLabel()}</Badge>}
        <Badge variant="outline" className="flex items-center gap-1.5">
          <UserIconLucide className="h-3.5 w-3.5" />{training.trainer_name}
        </Badge>
        {assignedUserName && (
          <Badge variant="outline" className="flex items-center gap-1.5 text-blue-600 border-blue-300">
            <UserIconLucide className="h-3.5 w-3.5" />{assignedUserName}
          </Badge>
        )}
        {schedules.length > 0 && availableFormulas.length === 0 && (
          <Badge variant="outline" className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />{calculateTotalDuration()}h
          </Badge>
        )}
        {isInterSession ? (
          (() => {
            const totalCA = participants.reduce((sum, p) => sum + (p.sold_price_ht || 0), 0);
            const resteAFacturer = participants.filter(p => p.payment_mode === "invoice" && !p.invoice_file_url).reduce((sum, p) => sum + (p.sold_price_ht || 0), 0);
            return (
              <>
                {totalCA > 0 && (
                  <Badge variant="outline" className="flex items-center gap-1.5">
                    <Euro className="h-3.5 w-3.5" />CA : {totalCA.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT
                  </Badge>
                )}
                {resteAFacturer > 0 && (
                  <Badge variant="outline" className="flex items-center gap-1.5 text-amber-600 border-amber-300">
                    <Euro className="h-3.5 w-3.5" />Reste à facturer : {resteAFacturer.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT
                  </Badge>
                )}
              </>
            );
          })()
        ) : (
          training.sold_price_ht != null && (
            <Badge variant="outline" className="flex items-center gap-1.5">
              <Euro className="h-3.5 w-3.5" />{training.sold_price_ht.toLocaleString("fr-FR")} € HT
            </Badge>
          )
        )}
      </div>

      {/* Sponsor */}
      {(training.sponsor_first_name || training.sponsor_last_name || training.sponsor_email) && (
        <>
          <Separator />
          <div className="flex items-start gap-3">
            <UserIconLucide className="h-4 w-4 mt-0.5 text-muted-foreground" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Commanditaire</p>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Tu</span>
                  <Switch checked={training.sponsor_formal_address} disabled className="scale-75" />
                  <span>Vous</span>
                </div>
              </div>
              {(training.sponsor_first_name || training.sponsor_last_name) && (
                <p className="font-medium">{training.sponsor_first_name} {training.sponsor_last_name}</p>
              )}
              {training.sponsor_email && (
                <div className="flex items-center gap-2">
                  <a href={`mailto:${training.sponsor_email}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
                    <Mail className="h-3.5 w-3.5" />{training.sponsor_email}
                  </a>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyEmail(training.sponsor_email!, { title: "Email copié", description: "L'adresse email a été copiée dans le presse-papiers." })}>
                    {copiedEmail ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                  </Button>
                </div>
              )}
              {/* Logistics email button - only for presentiel intra */}
              {isPresentiel && training.sponsor_email && !isInterSession && (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleSendLogisticsEmail}
                    disabled={sendingLogistics}
                  >
                    {sendingLogistics ? (
                      <Spinner className="h-3 w-3 mr-1.5" />
                    ) : (training as unknown as { logistics_email_sent_at?: string | null }).logistics_email_sent_at ? (
                      <CheckCircle2 className="h-3 w-3 mr-1.5 text-primary" />
                    ) : (
                      <Truck className="h-3 w-3 mr-1.5" />
                    )}
                    {(training as unknown as { logistics_email_sent_at?: string | null }).logistics_email_sent_at ? "Renvoyer besoins logistiques" : "Envoyer besoins logistiques"}
                  </Button>
                  {(training as unknown as { logistics_email_sent_at?: string | null }).logistics_email_sent_at && (
                    <span className="text-xs text-muted-foreground">
                      Envoyé le {formatSentDateTime((training as any).logistics_email_sent_at ?? "")}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Links */}
      {training.program_file_url && (
        <>
          <Separator />
          <div className="flex flex-wrap gap-3">
            <a href={training.program_file_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-primary hover:underline">
              <FileText className="h-4 w-4" />Programme
            </a>
          </div>
        </>
      )}

      {/* Private group URL */}
      {(training as unknown as { private_group_url?: string | null }).private_group_url && (
        <>
          <Separator />
          <div className="flex items-center gap-2">
            <a
              href={(training as unknown as { private_group_url?: string | null }).private_group_url ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              Groupe privé
            </a>
          </div>
        </>
      )}

      {/* Prerequisites */}
      {training.prerequisites && training.prerequisites.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-sm font-medium mb-2">Prérequis</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {training.prerequisites.map((prereq, index) => <li key={index}>{prereq}</li>)}
            </ul>
          </div>
        </>
      )}

      {/* Objectives */}
      {training.objectives && training.objectives.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-sm font-medium mb-2">Objectifs pédagogiques</p>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {training.objectives.map((obj, index) => <li key={index}>{obj}</li>)}
            </ul>
          </div>
        </>
      )}

      {/* Training Schedule Details */}
      {schedules.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-sm font-medium mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Planning ({schedules.length} session{schedules.length > 1 ? "s" : ""})
            </p>
            <div className="space-y-1.5">
              {schedules.map((schedule) => {
                const date = parseISO(schedule.day_date);
                const duration = (() => {
                  const [startH, startM] = schedule.start_time.split(":").map(Number);
                  const [endH, endM] = schedule.end_time.split(":").map(Number);
                  return (endH * 60 + endM - startH * 60 - startM) / 60;
                })();
                return (
                  <div key={schedule.id} className="flex items-center justify-between text-sm py-1.5 px-2 rounded bg-muted/50">
                    <span className="capitalize font-medium">{format(date, "EEEE d MMMM", { locale: fr })}</span>
                    <span className="text-muted-foreground">
                      {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                      <span className="ml-2 text-xs">({duration}h)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </CardContent>
  </Card>
  );
};

export default FormationDetailInfo;
