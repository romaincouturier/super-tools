import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Loader2, CheckCircle2, MapPin, Calendar, Clock, User, PenLine, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import SupertiltLogo from "@/components/SupertiltLogo";
import { formatDateWithDayOfWeek, getPeriodLabel } from "@/lib/dateFormatters";
import { supabase } from "@/integrations/supabase/client";
import { rpc, type TrainingPublicInfo, type ParticipantPublicInfo, type ScheduleForDate } from "@/lib/supabase-rpc";
import { useJourneyTracking } from "@/hooks/useJourneyTracking";
import { useSignaturePad } from "@/hooks/useSignaturePad";

interface AttendanceData {
  id: string;
  training_id: string;
  participant_id: string;
  schedule_date: string;
  period: string;
  token: string;
  signature_data: string | null;
  signed_at: string | null;
  training: { training_name: string; location: string };
  participant: { first_name: string | null; last_name: string | null; email: string };
  schedule: { start_time: string; end_time: string } | null;
}

const Emargement = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceData | null>(null);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);

  const { toast } = useToast();
  const { journeyEvents, trackEvent, trackPageLoaded, getDeviceInfo } = useJourneyTracking();

  const { canvasRef, clear: clearSignature, isEmpty: isSignatureEmpty, toDataURL: getSignatureData } = useSignaturePad({
    onFirstStroke: () => trackEvent("signature_drawing_started"),
  });

  useEffect(() => {
    const fetchAttendanceData = async () => {
      if (!token) {
        setError("Token invalide");
        setLoading(false);
        return;
      }

      try {
        const { data: signature, error: sigError } = await rpc.getAttendanceByToken(token);

        if (sigError || !signature) {
          setError(sigError ? "Erreur lors du chargement des données" : "Lien d'émargement invalide ou expiré");
          setLoading(false);
          return;
        }

        if (signature.signed_at) {
          setAlreadySigned(true);
        }

        trackPageLoaded();

        // Fetch related data in parallel
        const [trainingRes, participantRes, scheduleRes] = await Promise.all([
          rpc.getTrainingPublicInfo(signature.training_id),
          rpc.getParticipantPublicInfo(signature.participant_id),
          rpc.getTrainingScheduleForDate(signature.training_id, signature.schedule_date),
        ]);

        // Record first open
        if (!signature.email_opened_at) {
          await rpc.markAttendanceOpened(token, new Date().toISOString());
          trackEvent("first_link_opened");
        } else {
          trackEvent("link_reopened");
        }

        setAttendanceData({
          ...signature,
          training: trainingRes.data
            ? { training_name: (trainingRes.data as TrainingPublicInfo).training_name, location: (trainingRes.data as TrainingPublicInfo).location || "" }
            : { training_name: "Formation", location: "" },
          participant: (participantRes.data as ParticipantPublicInfo) || { first_name: null, last_name: null, email: "" },
          schedule: scheduleRes.data as ScheduleForDate | null,
        });
      } catch (err) {
        console.error("Error:", err);
        setError("Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };

    fetchAttendanceData();
  }, [token, trackEvent, trackPageLoaded]);

  const handleConsentChange = (checked: boolean) => {
    setConsentGiven(checked);
    trackEvent(checked ? "consent_checkbox_checked" : "consent_checkbox_unchecked");
  };

  const handleClear = () => {
    clearSignature();
    trackEvent("signature_cleared");
  };

  const handleSubmit = async () => {
    if (!consentGiven) {
      toast({
        title: "Consentement requis",
        description: "Veuillez accepter les conditions de signature électronique.",
        variant: "destructive",
      });
      return;
    }

    if (isSignatureEmpty()) {
      toast({
        title: "Signature requise",
        description: "Veuillez signer dans le cadre prévu avant de valider.",
        variant: "destructive",
      });
      return;
    }

    if (!attendanceData || !token) return;

    // Track submit click
    trackEvent("submit_button_clicked");

    setSubmitting(true);

    try {
      const signatureData = getSignatureData("image/png");
      const deviceInfo = getDeviceInfo();

      const response = await supabase.functions.invoke("submit-attendance-signature", {
        body: {
          token,
          signatureData,
          userAgent: navigator.userAgent,
          consent: consentGiven,
          deviceInfo,
          journeyEvents: journeyEvents.current,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || "Erreur lors de l'enregistrement");
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      setSignatureSubmitted(true);
      toast({
        title: "Signature enregistrée",
        description: "Votre présence a été validée avec succès. Cette signature est juridiquement valide.",
      });
    } catch (err) {
      console.error("Error submitting signature:", err);
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Une erreur est survenue lors de l'enregistrement de la signature.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = formatDateWithDayOfWeek;

  const getTimeRange = () => {
    if (!attendanceData?.schedule) {
      return attendanceData?.period === "AM" ? "9h00 - 12h30" : "14h00 - 17h30";
    }

    const startTime = attendanceData.schedule.start_time.slice(0, 5).replace(":", "h");
    const endTime = attendanceData.schedule.end_time.slice(0, 5).replace(":", "h");

    const [startH, startM] = attendanceData.schedule.start_time.split(":").map(Number);
    const [endH, endM] = attendanceData.schedule.end_time.split(":").map(Number);
    const sessionDurationHours = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;

    if (sessionDurationHours <= 4) {
      return `${startTime} - ${endTime}`;
    }

    return attendanceData.period === "AM" ? `${startTime} - 12h30` : `14h00 - ${endTime}`;
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

            {/* Consent checkbox */}
            <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="consent"
                checked={consentGiven}
                onCheckedChange={(checked) => handleConsentChange(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
                J'atteste de ma présence à cette demi-journée de formation et j'accepte que cette
                signature électronique ait valeur légale conformément au règlement européen eIDAS
                (UE n° 910/2014) et aux articles 1366 et 1367 du Code civil français.
              </Label>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClear} className="flex-1">
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
        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">Signature électronique sécurisée</p>
                <p>
                  Cette signature électronique est juridiquement recevable en France conformément au
                  règlement européen eIDAS (UE n° 910/2014) et aux articles 1366 et 1367 du Code civil.
                </p>
                <p>
                  Données enregistrées : votre signature, la date et l'heure, votre adresse IP,
                  les informations de votre appareil, et l'intégralité de votre parcours de signature.
                  Ces données constituent le dossier de preuve de votre présence
                  et sont conservées dans un espace sécurisé séparé pour les besoins de traçabilité.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Emargement;
