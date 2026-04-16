import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { rpc } from "@/lib/supabase-rpc";
import { CheckCircle2, FileText, Calendar, Building, User, PenLine, Shield, ExternalLink } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import SupertiltLogo from "@/components/SupertiltLogo";
import { useJourneyTracking } from "@/hooks/useJourneyTracking";
import { useSignaturePad } from "@/hooks/useSignaturePad";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface ConventionSignatureData {
  id: string;
  token: string;
  recipient_email: string;
  recipient_name: string | null;
  client_name: string;
  formation_name: string;
  pdf_url: string;
  status: string;
  signed_at: string | null;
  email_opened_at: string | null;
  created_at: string;
  expires_at: string | null;
}

function isS3PresignedUrl(url: string): boolean {
  return url.includes("X-Amz-Signature");
}

const SignatureConvention = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [conventionData, setConventionData] = useState<ConventionSignatureData | null>(null);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [signerName, setSignerName] = useState("");
  const [signerFunction, setSignerFunction] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);

  const hasTrackedNameEntered = useRef(false);
  const { toast } = useToast();
  const { invoke: invokeSubmitSignature } = useEdgeFunction(
    "submit-convention-signature",
    { errorMessage: "Une erreur est survenue." },
  );
  const { journeyEvents, trackEvent, trackPageLoaded, getDeviceInfo } = useJourneyTracking();
  const { canvasRef, clear: clearSignature, isEmpty: isSignatureEmpty, toDataURL: getSignatureData } = useSignaturePad({
    onFirstStroke: () => trackEvent("signature_drawing_started"),
  });

  useEffect(() => {
    const fetchConventionData = async () => {
      if (!token) {
        setError("Token invalide");
        setLoading(false);
        return;
      }

      try {
        const { data: signatureJson, error: sigError } = await rpc.getConventionSignatureByToken(token);

        if (sigError) {
          console.error("Error fetching convention signature:", sigError);
          setError("Erreur lors du chargement des données");
          setLoading(false);
          return;
        }

        const signature = signatureJson;
        if (!signature) {
          setError("Lien de signature invalide ou expiré");
          setLoading(false);
          return;
        }

        if (signature.status === "signed" || signature.signed_at) {
          setAlreadySigned(true);
        } else if (
          signature.status === "expired" ||
          (signature.expires_at && new Date(signature.expires_at) < new Date())
        ) {
          setError("Ce lien de signature a expiré");
          setLoading(false);
          return;
        } else if (signature.status === "cancelled") {
          setError("Cette convention a été annulée");
          setLoading(false);
          return;
        }

        trackPageLoaded();

        if (!signature.email_opened_at) {
          await rpc.markConventionOpened(token, new Date().toISOString());
          trackEvent("first_link_opened");
        } else {
          trackEvent("link_reopened");
        }

        setConventionData(signature);

        if (signature.recipient_name) {
          setSignerName(signature.recipient_name);
        }

        if (isS3PresignedUrl(signature.pdf_url)) {
          try {
            const refreshResult = await supabase.functions.invoke("refresh-convention-pdf-url", {
              body: { token },
            });
            if (refreshResult.data?.pdf_url && refreshResult.data.pdf_url !== signature.pdf_url) {
              setConventionData((prev) =>
                prev ? { ...prev, pdf_url: refreshResult.data.pdf_url } : prev
              );
            }
          } catch (refreshErr) {
            console.warn("Could not refresh PDF URL:", refreshErr);
          }
        }
      } catch (err) {
        console.error("Error:", err);
        setError("Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };

    fetchConventionData();
  }, [token, trackEvent, trackPageLoaded]);

  const handlePdfConsulted = () => {
    trackEvent("pdf_consulted", { pdf_url: conventionData?.pdf_url });
  };

  const handleNameChange = (value: string) => {
    setSignerName(value);
    if (value.trim().length > 0 && !hasTrackedNameEntered.current) {
      trackEvent("signer_name_entered");
      hasTrackedNameEntered.current = true;
    }
  };

  const handleConsentChange = (checked: boolean) => {
    setConsentGiven(checked);
    trackEvent(checked ? "consent_checkbox_checked" : "consent_checkbox_unchecked");
  };

  const handleClear = () => {
    clearSignature();
    trackEvent("signature_cleared");
  };

  const handleSubmit = async () => {
    if (!signerName.trim()) {
      toast({ title: "Nom requis", description: "Veuillez indiquer votre nom.", variant: "destructive" });
      return;
    }
    if (!consentGiven) {
      toast({ title: "Consentement requis", description: "Veuillez accepter les conditions de signature électronique.", variant: "destructive" });
      return;
    }
    if (isSignatureEmpty()) {
      toast({ title: "Signature requise", description: "Veuillez signer dans le cadre prévu.", variant: "destructive" });
      return;
    }
    if (!conventionData || !token) return;

    trackEvent("submit_button_clicked");
    setSubmitting(true);

    const signatureData = getSignatureData("image/png");
    const deviceInfo = getDeviceInfo();

    const result = await invokeSubmitSignature({
      token,
      signatureData,
      userAgent: navigator.userAgent,
      consent: consentGiven,
      signerName: signerName.trim(),
      signerFunction: signerFunction.trim() || undefined,
      deviceInfo,
      journeyEvents: journeyEvents.current,
    });

    if (result !== null) {
      setSignatureSubmitted(true);
      toast({ title: "Convention signée", description: "Votre signature a été enregistrée avec succès." });
    }
    setSubmitting(false);
  };

  const formatCreatedDate = (dateStr: string) => {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: fr });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Spinner size="lg" className="text-primary" />
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
            <h2 className="text-xl font-semibold">Convention signée</h2>
            <p className="text-muted-foreground">
              Votre signature électronique a été enregistrée avec succès.
            </p>
            {conventionData && (
              <div className="mt-4 text-sm text-muted-foreground space-y-1">
                <p><strong>{conventionData.formation_name}</strong></p>
                <p>{conventionData.client_name}</p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Un email de confirmation vous sera envoyé prochainement.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <SupertiltLogo className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Signature de la convention de formation</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Détails de la convention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{conventionData?.client_name}</span>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>{conventionData?.formation_name}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Convention du {conventionData && formatCreatedDate(conventionData.created_at)}</span>
            </div>
            {conventionData?.pdf_url && (
              <div className="pt-2">
                <Button variant="outline" asChild className="w-full sm:w-auto" onClick={handlePdfConsulted}>
                  <a href={conventionData.pdf_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Consulter la convention PDF
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Informations du signataire
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signerName">Nom complet *</Label>
              <Input id="signerName" value={signerName} onChange={(e) => handleNameChange(e.target.value)} placeholder="Prénom Nom" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signerFunction">Fonction (optionnel)</Label>
              <Input id="signerFunction" value={signerFunction} onChange={(e) => setSignerFunction(e.target.value)} placeholder="Ex: Directeur des Ressources Humaines" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PenLine className="h-5 w-5" />
              Votre signature
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white">
              <canvas ref={canvasRef} className="w-full h-48 touch-none" style={{ touchAction: "none" }} />
            </div>
            <div className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
              <Checkbox id="consent" checked={consentGiven} onCheckedChange={(checked) => handleConsentChange(checked === true)} className="mt-0.5" />
              <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
                En signant cette convention, j'accepte les conditions de formation proposées et je
                reconnais que cette signature électronique a valeur légale conformément au règlement
                européen eIDAS (UE n° 910/2014) et aux articles 1366 et 1367 du Code civil français.
              </Label>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleClear} className="flex-1">Effacer</Button>
              <Button onClick={handleSubmit} disabled={submitting || !consentGiven || !signerName.trim()} className="flex-1">
                {submitting ? (<><Spinner className="mr-2" />Envoi...</>) : "Signer la convention"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/30 border-dashed">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">Signature électronique sécurisée</p>
                <p>Cette signature électronique est juridiquement recevable en France conformément au règlement européen eIDAS (UE n° 910/2014) et aux articles 1366 et 1367 du Code civil.</p>
                <p>Données enregistrées : votre signature, votre nom, la date et l'heure, votre adresse IP, les informations de votre appareil, et l'intégralité de votre parcours de signature. Ces données constituent le dossier de preuve de votre engagement et sont conservées dans un espace sécurisé séparé pour les besoins de traçabilité.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SignatureConvention;
