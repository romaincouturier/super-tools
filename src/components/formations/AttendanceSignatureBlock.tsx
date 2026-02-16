import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isBefore, isAfter, startOfDay, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { PenLine, Send, RefreshCw, Check, Loader2, Download, FileDown, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AttendanceSignatureBlockProps {
  trainingId: string;
  trainingName: string;
  schedules: Array<{
    id: string;
    day_date: string;
    start_time: string;
    end_time: string;
  }>;
  participantsCount: number;
  participants: Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
  }>;
}

interface SignatureStatus {
  date: string;
  period: "AM" | "PM";
  totalSent: number;
  totalSigned: number;
  hasSent: boolean;
}

const AttendanceSignatureBlock = ({
  trainingId,
  trainingName,
  schedules,
  participantsCount,
  participants,
}: AttendanceSignatureBlockProps) => {
  const [signatureStatuses, setSignatureStatuses] = useState<SignatureStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingSlot, setSendingSlot] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { toast } = useToast();

  // Show this block for any training that has schedules
  const shouldShowBlock = () => {
    return schedules.length > 0;
  };

  useEffect(() => {
    if (shouldShowBlock()) {
      fetchSignatureStatuses();
    } else {
      setLoading(false);
    }
  }, [trainingId, schedules]);

  const fetchSignatureStatuses = async () => {
    try {
      // Get all signatures for this training
      const { data: signatures, error } = await supabase
        .from("attendance_signatures")
        .select("*")
        .eq("training_id", trainingId);

      if (error) throw error;

      // Build status for each schedule date, determining periods from actual times
      const statuses: SignatureStatus[] = [];

      schedules.forEach(schedule => {
        // Determine which periods apply based on start_time and end_time
        const startHour = parseInt(schedule.start_time.split(":")[0], 10);
        const endHour = parseInt(schedule.end_time.split(":")[0], 10);
        const endMin = parseInt(schedule.end_time.split(":")[1], 10);

        const periods: ("AM" | "PM")[] = [];
        // AM if the session starts before 13:00
        if (startHour < 13) periods.push("AM");
        // PM if the session ends after 13:30 (and spans the afternoon)
        if (endHour > 13 || (endHour === 13 && endMin > 30)) periods.push("PM");
        // Fallback: if no period matched, default to AM
        if (periods.length === 0) periods.push("AM");

        periods.forEach(period => {
          const slotSignatures = signatures?.filter(
            s => s.schedule_date === schedule.day_date && s.period === period
          ) || [];

          statuses.push({
            date: schedule.day_date,
            period,
            totalSent: slotSignatures.filter(s => s.email_sent_at).length,
            totalSigned: slotSignatures.filter(s => s.signed_at).length,
            hasSent: slotSignatures.some(s => s.email_sent_at),
          });
        });
      });

      // Sort by date and period
      statuses.sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.period === "AM" ? -1 : 1;
      });

      setSignatureStatuses(statuses);
    } catch (err) {
      console.error("Error fetching signature statuses:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendSignatureRequests = async (date: string, period: "AM" | "PM") => {
    const slotKey = `${date}-${period}`;
    setSendingSlot(slotKey);

    try {
      const { data, error } = await supabase.functions.invoke("send-attendance-signature-request", {
        body: {
          trainingId,
          scheduleDate: date,
          period,
        },
      });

      if (error) throw error;

      toast({
        title: "Emails envoyés",
        description: `Les demandes de signature ont été envoyées aux participants.`,
      });

      // Refresh statuses
      await fetchSignatureStatuses();
    } catch (err) {
      console.error("Error sending signature requests:", err);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'envoi des demandes de signature.",
        variant: "destructive",
      });
    } finally {
      setSendingSlot(null);
    }
  };

  const handleExportPdf = async (participantId?: string) => {
    setExporting(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-attendance-pdf", {
        body: {
          trainingId,
          participantId,
        },
      });

      if (error) throw error;

      if (data?.html) {
        // Download as HTML file (no popup needed)
        const blob = new Blob([data.html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Emargement_${data.training?.training_name?.replace(/[^a-zA-Z0-9àâäéèêëïîôùûüç\s-]/g, "").replace(/\s+/g, "_") || "formation"}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
          title: "Export téléchargé",
          description: "Ouvrez le fichier HTML et imprimez-le en PDF (Ctrl+P).",
        });
      } else {
        toast({
          title: "Erreur",
          description: "Aucune donnée d'émargement trouvée.",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error("Error exporting attendance PDF:", err);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'export.",
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  const formatSlotDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    return format(date, "dd/MM", { locale: fr });
  };

  const getPeriodLabel = (period: "AM" | "PM") => {
    return period === "AM" ? "Matin" : "Après-midi";
  };

  const getParticipantName = (p: { first_name: string | null; last_name: string | null; email: string }) => {
    const name = `${p.first_name || ""} ${p.last_name || ""}`.trim();
    return name || p.email;
  };

  // Calculate total signatures stats
  const totalExpected = signatureStatuses.length * participantsCount;
  const totalSigned = signatureStatuses.reduce((sum, s) => sum + s.totalSigned, 0);

  if (!shouldShowBlock() || loading) {
    if (loading) {
      return (
        <Card>
          <CardContent className="py-6">
            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
          </CardContent>
        </Card>
      );
    }
    return null;
  }

  if (signatureStatuses.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5" />
              Émargement électronique
            </CardTitle>
            <CardDescription>
              Envoyez les demandes de signature pour chaque demi-journée
            </CardDescription>
          </div>

          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                {exporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Exporter PDF
                <ChevronDown className="h-4 w-4 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Exporter les émargements</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExportPdf()}>
                <FileDown className="h-4 w-4 mr-2" />
                Toute la session ({totalSigned}/{totalExpected} signatures)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Par participant
              </DropdownMenuLabel>
              {participants.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => handleExportPdf(p.id)}
                >
                  {getParticipantName(p)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {signatureStatuses.map((status) => {
            const slotKey = `${status.date}-${status.period}`;
            const isSending = sendingSlot === slotKey;
            const isComplete = status.totalSigned === participantsCount && participantsCount > 0;

            return (
              <div
                key={slotKey}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-3">
                  <div className="text-sm">
                    <span className="font-medium">{formatSlotDate(status.date)}</span>
                    <span className="text-muted-foreground ml-2">{getPeriodLabel(status.period)}</span>
                  </div>
                  <Badge variant={isComplete ? "default" : "secondary"} className="text-xs">
                    {status.totalSigned}/{participantsCount} signés
                  </Badge>
                </div>

                <Button
                  size="sm"
                  variant={status.hasSent ? "outline" : "default"}
                  onClick={() => handleSendSignatureRequests(status.date, status.period)}
                  disabled={isSending || isComplete}
                >
                  {isSending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Envoi...
                    </>
                  ) : isComplete ? (
                    <>
                      <Check className="h-4 w-4 mr-1" />
                      Complet
                    </>
                  ) : status.hasSent ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Renvoyer
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-1" />
                      Envoyer
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default AttendanceSignatureBlock;
