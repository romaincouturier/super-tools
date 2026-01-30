import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, MapPin, Calendar, Clock, User, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import SupertiltLogo from "@/components/SupertiltLogo";
import SignaturePad from "signature_pad";

interface AttendanceData {
  id: string;
  training_id: string;
  participant_id: string;
  schedule_date: string;
  period: string;
  token: string;
  signature_data: string | null;
  signed_at: string | null;
  training: {
    training_name: string;
    location: string;
  };
  participant: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  };
  schedule: {
    start_time: string;
    end_time: string;
  } | null;
}

const Emargement = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAttendanceData = async () => {
      if (!token) {
        setError("Token invalide");
        setLoading(false);
        return;
      }

      try {
        // Fetch attendance signature record
        const { data: signature, error: sigError } = await supabase
          .from("attendance_signatures")
          .select("*")
          .eq("token", token)
          .maybeSingle();

        if (sigError) {
          console.error("Error fetching signature:", sigError);
          setError("Erreur lors du chargement des données");
          setLoading(false);
          return;
        }

        if (!signature) {
          setError("Lien d'émargement invalide ou expiré");
          setLoading(false);
          return;
        }

        // Check if already signed
        if (signature.signed_at) {
          setAlreadySigned(true);
        }

        // Fetch training info
        const { data: training } = await supabase
          .from("trainings")
          .select("training_name, location")
          .eq("id", signature.training_id)
          .single();

        // Fetch participant info
        const { data: participant } = await supabase
          .from("training_participants")
          .select("first_name, last_name, email")
          .eq("id", signature.participant_id)
          .single();

        // Fetch schedule for this date
        const { data: schedule } = await supabase
          .from("training_schedules")
          .select("start_time, end_time")
          .eq("training_id", signature.training_id)
          .eq("day_date", signature.schedule_date)
          .maybeSingle();

        // Record first open if not already opened
        if (!signature.email_opened_at) {
          await supabase
            .from("attendance_signatures")
            .update({ email_opened_at: new Date().toISOString() })
            .eq("id", signature.id);
        }

        setAttendanceData({
          ...signature,
          training: training || { training_name: "Formation", location: "" },
          participant: participant || { first_name: null, last_name: null, email: "" },
          schedule: schedule,
        });
      } catch (err) {
        console.error("Error:", err);
        setError("Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceData();
  }, [token]);

  // Initialize signature pad
  useEffect(() => {
    if (canvasRef.current && !alreadySigned && attendanceData) {
      const canvas = canvasRef.current;
      
      // Set canvas size
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
      }

      signaturePadRef.current = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
      });
    }

    return () => {
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
      }
    };
  }, [attendanceData, alreadySigned]);

  const handleClear = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
  };

  const handleSubmit = async () => {
    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
      toast({
        title: "Signature requise",
        description: "Veuillez signer dans le cadre prévu avant de valider.",
        variant: "destructive",
      });
      return;
    }

    if (!attendanceData) return;

    setSubmitting(true);

    try {
      const signatureData = signaturePadRef.current.toDataURL("image/png");

      const { error: updateError } = await supabase
        .from("attendance_signatures")
        .update({
          signature_data: signatureData,
          signed_at: new Date().toISOString(),
          user_agent: navigator.userAgent,
        })
        .eq("token", token);

      if (updateError) {
        throw updateError;
      }

      setSignatureSubmitted(true);
      toast({
        title: "Signature enregistrée",
        description: "Votre présence a été validée avec succès.",
      });
    } catch (err) {
      console.error("Error submitting signature:", err);
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de l'enregistrement de la signature.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getPeriodLabel = (period: string) => {
    return period === "AM" ? "Matin" : "Après-midi";
  };

  const getTimeRange = () => {
    if (!attendanceData?.schedule) {
      // Default times if no schedule
      return attendanceData?.period === "AM" ? "9h00 - 12h30" : "14h00 - 17h30";
    }
    
    const startTime = attendanceData.schedule.start_time.slice(0, 5).replace(":", "h");
    const endTime = attendanceData.schedule.end_time.slice(0, 5).replace(":", "h");
    
    // For half-day, we need to split the full day
    if (attendanceData.period === "AM") {
      return `${startTime} - 12h30`;
    } else {
      return `14h00 - ${endTime}`;
    }
  };

  const getParticipantName = () => {
    const firstName = attendanceData?.participant?.first_name || "";
    const lastName = attendanceData?.participant?.last_name || "";
    return `${firstName} ${lastName}`.trim() || attendanceData?.participant?.email || "Participant";
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <SupertiltLogo className="h-12 mb-6" />
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (alreadySigned || signatureSubmitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <SupertiltLogo className="h-12 mb-6" />
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-500" />
            <h2 className="text-xl font-semibold">Présence confirmée</h2>
            <p className="text-muted-foreground">
              Votre signature a été enregistrée avec succès pour cette demi-journée de formation.
            </p>
            {attendanceData && (
              <div className="mt-4 text-sm text-muted-foreground">
                <p><strong>{attendanceData.training.training_name}</strong></p>
                <p>{formatDate(attendanceData.schedule_date)} - {getPeriodLabel(attendanceData.period)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <SupertiltLogo className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Émargement électronique</h1>
        </div>

        {/* Formation info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{attendanceData?.training.training_name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{getParticipantName()}</span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{attendanceData?.training.location}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>{attendanceData && formatDate(attendanceData.schedule_date)}</span>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>
                {getPeriodLabel(attendanceData?.period || "AM")} • {getTimeRange()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Signature area */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PenLine className="h-5 w-5" />
              Votre signature
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white">
              <canvas
                ref={canvasRef}
                className="w-full h-48 touch-none"
                style={{ touchAction: "none" }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleClear}
                className="flex-1"
              >
                Effacer
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  "Signer ma présence"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Legal notice */}
        <p className="text-xs text-muted-foreground text-center px-4">
          En signant, j'atteste de ma présence à cette demi-journée de formation et accepte que 
          cette signature électronique ait valeur légale conformément au règlement européen eIDAS 
          (UE n° 910/2014).
        </p>
      </div>
    </div>
  );
};

export default Emargement;
