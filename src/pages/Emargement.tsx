import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, MapPin, Calendar, Clock, User, PenLine, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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

interface JourneyEvent {
  event: string;
  timestamp: string;
  details?: Record<string, unknown>;
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

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const journeyEventsRef = useRef<JourneyEvent[]>([]);
  const hasTrackedSignatureDrawn = useRef(false);
  const { toast } = useToast();

  // Journey event tracker
  const trackEvent = useCallback((event: string, details?: Record<string, unknown>) => {
    journeyEventsRef.current.push({
      event,
      timestamp: new Date().toISOString(),
      details,
    });
  }, []);

  useEffect(() => {
    const fetchAttendanceData = async () => {
      if (!token) {
        setError("Token invalide");
        setLoading(false);
        return;
      }

      try {
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

        if (signature.signed_at) {
          setAlreadySigned(true);
        }

        // Track page loaded
        trackEvent("page_loaded", {
          user_agent: navigator.userAgent,
          screen_width: window.screen.width,
          screen_height: window.screen.height,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
        });

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

        // Record first open
        if (!signature.email_opened_at) {
          await supabase
            .from("attendance_signatures")
            .update({ email_opened_at: new Date().toISOString() })
            .eq("id", signature.id);
          trackEvent("first_link_opened");
        } else {
          trackEvent("link_reopened");
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
  }, [token, trackEvent]);

  // Initialize signature pad
  useEffect(() => {
    if (canvasRef.current && !alreadySigned && attendanceData) {
      const canvas = canvasRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
      }

      const pad = new SignaturePad(canvas, {
        backgroundColor: "rgb(255, 255, 255)",
        penColor: "rgb(0, 0, 0)",
      });

      // Track first stroke
      pad.addEventListener("beginStroke", () => {
        if (!hasTrackedSignatureDrawn.current) {
          trackEvent("signature_drawing_started");
          hasTrackedSignatureDrawn.current = true;
        }
      });

      signaturePadRef.current = pad;
    }

    return () => {
      if (signaturePadRef.current) {
        signaturePadRef.current.off();
      }
    };
  }, [attendanceData, alreadySigned, trackEvent]);

  const handleConsentChange = (checked: boolean) => {
    setConsentGiven(checked);
    trackEvent(checked ? "consent_checkbox_checked" : "consent_checkbox_unchecked");
  };

  const handleClear = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
      trackEvent("signature_cleared");
      hasTrackedSignatureDrawn.current = false;
    }
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

    if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
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
      const signatureData = signaturePadRef.current.toDataURL("image/png");

      const deviceInfo = {
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
        colorDepth: window.screen.colorDepth,
        pixelRatio: window.devicePixelRatio,
        platform: navigator.platform,
        cookiesEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine,
      };

      const response = await supabase.functions.invoke("submit-attendance-signature", {
        body: {
          token,
          signatureData,
          userAgent: navigator.userAgent,
          consent: consentGiven,
          deviceInfo,
          journeyEvents: journeyEventsRef.current,
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
      return attendanceData?.period === "AM" ? "9h00 - 12h30" : "14h00 - 17h30";
    }
    
    const startTime = attendanceData.schedule.start_time.slice(0, 5).replace(":", "h");
    const endTime = attendanceData.schedule.end_time.slice(0, 5).replace(":", "h");
    
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
                disabled={submitting || !consentGiven}
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
