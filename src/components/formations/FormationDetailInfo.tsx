import { useState } from "react";
import { Calendar, FileText, MapPin, Building, UserIcon, Clock, Copy, Check, Euro, Mail, ExternalLink, Truck, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatSentDateTime } from "@/lib/dateFormatters";
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
  copiedEmail: boolean;
  setCopiedEmail: (v: boolean) => void;
  copiedLocation: boolean;
  setCopiedLocation: (v: boolean) => void;
  getFormatLabel: () => string | null;
  calculateTotalDuration: () => number;
  toast: (opts: any) => void;
}

const FormationDetailInfo = ({
  training,
  schedules,
  participants,
  availableFormulas,
  assignedUserName,
  isInterSession,
  copiedEmail,
  setCopiedEmail,
  copiedLocation,
  setCopiedLocation,
  getFormatLabel,
  calculateTotalDuration,
  toast,
}: Props) => {
  const [sendingLogistics, setSendingLogistics] = useState(false);

  const handleSendLogisticsEmail = async () => {
    setSendingLogistics(true);
    try {
      const { error } = await supabase.functions.invoke("send-logistics-requirements", {
        body: { trainingId: training.id },
      });
      if (error) throw error;
      toast({
        title: "Email envoyé",
        description: `Les besoins logistiques ont été envoyés à ${training.sponsor_email}.`,
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'envoyer l'email.",
        variant: "destructive",
      });
    } finally {
      setSendingLogistics(false);
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
            <button type="button" className="ml-1 p-0.5 rounded hover:bg-muted transition-colors" onClick={() => { navigator.clipboard.writeText(training.client_address!); toast({ title: "Adresse copiée", description: "L'adresse du client a été copiée." }); }}>
              <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          </Badge>
        )}
        <Badge variant="outline" className="flex items-center gap-1.5 group">
          <MapPin className="h-3.5 w-3.5" />{training.location}
          <button type="button" className="ml-1 p-0.5 rounded hover:bg-muted transition-colors" onClick={() => { navigator.clipboard.writeText(training.location); setCopiedLocation(true); toast({ title: "Adresse copiée", description: "L'adresse a été copiée dans le presse-papiers." }); setTimeout(() => setCopiedLocation(false), 2000); }}>
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
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(training.sponsor_email!); setCopiedEmail(true); toast({ title: "Email copié", description: "L'adresse email a été copiée dans le presse-papiers." }); setTimeout(() => setCopiedEmail(false), 2000); }}>
                    {copiedEmail ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                  </Button>
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
      {(training as any).private_group_url && (
        <>
          <Separator />
          <div className="flex items-center gap-2">
            <a
              href={(training as any).private_group_url}
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
                  const hours = (endH * 60 + endM - startH * 60 - startM) / 60;
                  return hours <= 4 ? 3.5 : 7;
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

export default FormationDetailInfo;
