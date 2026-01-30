import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO, isToday, isBefore, isAfter, startOfDay, addDays } from "date-fns";
import { fr } from "date-fns/locale";
import { PenLine, Send, RefreshCw, Check, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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
}: AttendanceSignatureBlockProps) => {
  const [signatureStatuses, setSignatureStatuses] = useState<SignatureStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingSlot, setSendingSlot] = useState<string | null>(null);
  const { toast } = useToast();

  // Check if we should show this block (training is today or in the past week)
  const shouldShowBlock = () => {
    if (schedules.length === 0) return false;
    
    const today = startOfDay(new Date());
    const weekAgo = addDays(today, -7);
    
    return schedules.some(schedule => {
      const scheduleDate = startOfDay(parseISO(schedule.day_date));
      return !isBefore(scheduleDate, weekAgo) && !isAfter(scheduleDate, addDays(today, 1));
    });
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

      // Build status for each schedule date (AM + PM)
      const today = startOfDay(new Date());
      const weekAgo = addDays(today, -7);
      
      const statuses: SignatureStatus[] = [];

      schedules.forEach(schedule => {
        const scheduleDate = startOfDay(parseISO(schedule.day_date));
        
        // Only show dates from past week up to today
        if (isBefore(scheduleDate, weekAgo) || isAfter(scheduleDate, today)) {
          return;
        }

        ["AM", "PM"].forEach(period => {
          const slotSignatures = signatures?.filter(
            s => s.schedule_date === schedule.day_date && s.period === period
          ) || [];

          statuses.push({
            date: schedule.day_date,
            period: period as "AM" | "PM",
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

  const formatSlotDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    return format(date, "dd/MM", { locale: fr });
  };

  const getPeriodLabel = (period: "AM" | "PM") => {
    return period === "AM" ? "Matin" : "Après-midi";
  };

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
        <CardTitle className="flex items-center gap-2">
          <PenLine className="h-5 w-5" />
          Émargement électronique
        </CardTitle>
        <CardDescription>
          Envoyez les demandes de signature pour chaque demi-journée
        </CardDescription>
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
