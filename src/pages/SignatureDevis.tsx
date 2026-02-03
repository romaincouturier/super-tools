import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2,
  CheckCircle2,
  FileText,
  Calendar,
  Building,
  User,
  PenLine,
  Shield,
  Download,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import SupertiltLogo from "@/components/SupertiltLogo";
import SignaturePad from "signature_pad";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface DevisSignatureData {
  id: string;
  token: string;
  recipient_email: string;
  recipient_name: string | null;
  client_name: string;
  formation_name: string;
  devis_type: string;
  pdf_url: string;
  status: string;
  signed_at: string | null;
  email_opened_at: string | null;
  created_at: string;
  expires_at: string | null;
}

const SignatureDevis = () => {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [devisData, setDevisData] = useState<DevisSignatureData | null>(null);
  const [alreadySigned, setAlreadySigned] = useState(false);
  const [signatureSubmitted, setSignatureSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [signerName, setSignerName] = useState("");
  const [signerFunction, setSignerFunction] = useState("");
  const [consentGiven, setConsentGiven] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const signaturePadRef = useRef<SignaturePad | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDevisData = async () => {
      if (!token) {
        setError("Token invalide");
        setLoading(false);
        return;
      }

      try {
        // Fetch devis signature record
        const { data: signature, error: sigError } = await supabase
          .from("devis_signatures")
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
          setError("Lien de signature invalide ou expiré");
          setLoading(false);
          return;
        }

        // Check status
        if (signature.status === "signed" || signature.signed_at) {
          setAlreadySigned(true);
        } else if (signature.status === "expired" || (signature.expires_at && new Date(signature.expires_at) < new Date())) {
          setError("Ce lien de signature a expiré");
          setLoading(false);
          return;
        } else if (signature.status === "cancelled") {
          setError("Ce devis a été annulé");
          setLoading(false);
          return;
        }

        // Record first open if not already opened
        if (!signature.email_opened_at) {
          await supabase
            .from("devis_signatures")
            .update({ email_opened_at: new Date().toISOString() })
            .eq("id", signature.id);
        }

        setDevisData(signature);

        // Pre-fill signer name if available
        if (signature.recipient_name) {
          setSignerName(signature.recipient_name);
        }
      } catch (err) {
        console.error("Error:", err);
        setError("Une erreur est survenue");
      } finally {
        setLoading(false);
      }
    };

    fetchDevisData();
  }, [token]);

  // Initialize signature pad
  useEffect(() => {
    if (canvasRef.current && !alreadySigned && devisData) {
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
  }, [devisData, alreadySigned]);

  const handleClear = () => {
    if (signaturePadRef.current) {
      signaturePadRef.current.clear();
    }
  };

  const handleSubmit = async () => {
    if (!signerName.trim()) {
      toast({
        title: "Nom requis",
        description: "Veuillez indiquer votre nom.",
        variant: "destructive",
      });
      return;
    }

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
        description: "Veuillez signer dans le cadre prévu.",
        variant: "destructive",
      });
      return;
    }

    if (!devisData || !token) return;

    setSubmitting(true);

    try {
      const signatureData = signaturePadRef.current.toDataURL("image/png");

      // Collect device info for audit trail
      const deviceInfo = {
        screenWidth: window.screen.width,
        screenHeight: window.screen.height,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: navigator.language,
      };

      // Call edge function
      const response = await supabase.functions.invoke("submit-devis-signature", {
        body: {
          token,
          signatureData,
          userAgent: navigator.userAgent,
          consent: consentGiven,
          signerName: signerName.trim(),
          signerFunction: signerFunction.trim() || undefined,
          deviceInfo,
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
        title: "Devis signé",
        description: "Votre signature a été enregistrée avec succès.",
      });
    } catch (err) {
      console.error("Error submitting signature:", err);
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getDevisTypeLabel = (type: string) => {
    return type === "avec_subrogation"
      ? "Avec subrogation de paiement"
      : "Sans subrogation de paiement";
  };

  const formatCreatedDate = (dateStr: string) => {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: fr });
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
            <h2 className="text-xl font-semibold">Devis signé</h2>
            <p className="text-muted-foreground">
              Votre signature électronique a été enregistrée avec succès.
            </p>
            {devisData && (
              <div className="mt-4 text-sm text-muted-foreground space-y-1">
                <p><strong>{devisData.formation_name}</strong></p>
                <p>{devisData.client_name}</p>
                <p className="text-xs">{getDevisTypeLabel(devisData.devis_type)}</p>
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
        {/* Header */}
        <div className="text-center">
          <SupertiltLogo className="h-12 mx-auto mb-4" />
          <h1 className="text-2xl font-bold">Signature électronique du devis</h1>
        </div>

        {/* Devis info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Détails du devis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{devisData?.client_name}</span>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>{devisData?.formation_name}</span>
            </div>
            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>Devis du {devisData && formatCreatedDate(devisData.created_at)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm bg-muted px-2 py-1 rounded">
                {devisData && getDevisTypeLabel(devisData.devis_type)}
              </span>
            </div>

            {/* View PDF button */}
            {devisData?.pdf_url && (
              <div className="pt-2">
                <Button variant="outline" asChild className="w-full sm:w-auto">
                  <a href={devisData.pdf_url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Consulter le devis PDF
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Signer info */}
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
              <Input
                id="signerName"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                placeholder="Prénom Nom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signerFunction">Fonction (optionnel)</Label>
              <Input
                id="signerFunction"
                value={signerFunction}
                onChange={(e) => setSignerFunction(e.target.value)}
                placeholder="Ex: Directeur des Ressources Humaines"
              />
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
                onCheckedChange={(checked) => setConsentGiven(checked === true)}
                className="mt-0.5"
              />
              <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
                En signant ce devis, j'accepte les conditions proposées et je reconnais que cette
                signature électronique a valeur légale conformément au règlement européen eIDAS
                (UE n° 910/2014) et aux articles 1366 et 1367 du Code civil français.
              </Label>
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
                disabled={submitting || !consentGiven || !signerName.trim()}
                className="flex-1"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  "Signer le devis"
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
                  Données enregistrées : votre signature, votre nom, la date et l'heure, votre adresse IP,
                  les informations de votre appareil. Ces données constituent la preuve de votre engagement
                  et sont conservées pour les besoins de traçabilité.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SignatureDevis;
