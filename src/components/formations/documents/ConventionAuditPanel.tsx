import { useState } from "react";
import { Loader2, Shield } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import { formatDateTimeSeconds } from "@/lib/dateFormatters";

import type { ConventionSignatureStatus, VerificationResult } from "./types";

const journeyEventLabels: Record<string, string> = {
  page_loaded: "Page ouverte",
  first_link_opened: "Premier accès au lien",
  link_reopened: "Lien réouvert",
  pdf_consulted: "PDF consulté",
  signer_name_entered: "Nom saisi",
  signature_drawing_started: "Début de signature",
  signature_cleared: "Signature effacée",
  consent_checkbox_checked: "Consentement coché",
  consent_checkbox_unchecked: "Consentement décoché",
  submit_button_clicked: "Bouton signer cliqué",
  signature_submitted_server: "Signature enregistrée (serveur)",
};

interface ConventionAuditPanelProps {
  trainingId: string;
  conventionSignatureStatus: ConventionSignatureStatus;
}

const ConventionAuditPanel = ({
  trainingId,
  conventionSignatureStatus,
}: ConventionAuditPanelProps) => {
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const { toast } = useToast();
  const { loading: verifying, invoke: invokeVerify } = useEdgeFunction<VerificationResult>(
    "verify-convention-signature",
    { errorMessage: "Erreur de vérification" },
  );

  const formatFullDate = formatDateTimeSeconds;

  const handleVerifySignature = async () => {
    const { data: sigData } = await supabase
      .from("convention_signatures")
      .select("id")
      .eq("training_id", trainingId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sigData) {
      toastError(toast, "Aucune signature trouvée");
      return;
    }

    const result = await invokeVerify({ signatureId: sigData.id });
    if (result) {
      setVerificationResult(result);
      toast({ title: "Vérification terminée", description: `Résultat : ${result.summary?.overall || "OK"}` });
    }
  };

  return (
    <div className="p-3 bg-muted/30 border border-border rounded-md space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">Dossier de preuve</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={handleVerifySignature}
          disabled={verifying}
        >
          {verifying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
          Vérifier l&apos;intégrité
        </Button>
      </div>

      {/* Signer info */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-muted-foreground">Signataire</span>
        <span className="font-medium">{conventionSignatureStatus.signer_name || "—"}</span>
        {conventionSignatureStatus.signer_function && (
          <>
            <span className="text-muted-foreground">Fonction</span>
            <span>{conventionSignatureStatus.signer_function}</span>
          </>
        )}
        <span className="text-muted-foreground">Date de signature</span>
        <span>{conventionSignatureStatus.signed_at ? formatFullDate(conventionSignatureStatus.signed_at) : "—"}</span>
        <span className="text-muted-foreground">Adresse IP</span>
        <span className="font-mono">{conventionSignatureStatus.ip_address || "—"}</span>
        <span className="text-muted-foreground">Consentement donné</span>
        <span>{conventionSignatureStatus.consent_timestamp ? formatFullDate(conventionSignatureStatus.consent_timestamp) : "—"}</span>
      </div>

      {/* Hashes */}
      <div className="space-y-1">
        <span className="font-semibold">Empreintes numériques</span>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <span className="text-muted-foreground">Signature (SHA-256)</span>
          <span className="font-mono truncate" title={conventionSignatureStatus.signature_hash || undefined}>
            {conventionSignatureStatus.signature_hash ? conventionSignatureStatus.signature_hash.substring(0, 24) + "..." : "—"}
          </span>
          <span className="text-muted-foreground">Document PDF</span>
          <span className="font-mono truncate" title={conventionSignatureStatus.pdf_hash || undefined}>
            {conventionSignatureStatus.pdf_hash ? conventionSignatureStatus.pdf_hash.substring(0, 24) + "..." : "—"}
          </span>
          <span className="text-muted-foreground">Dossier de preuve</span>
          <span className="font-mono truncate" title={conventionSignatureStatus.proof_hash || undefined}>
            {conventionSignatureStatus.proof_hash ? conventionSignatureStatus.proof_hash.substring(0, 24) + "..." : "—"}
          </span>
        </div>
      </div>

      {/* Journey timeline */}
      {conventionSignatureStatus.journey_events && conventionSignatureStatus.journey_events.length > 0 && (
        <div className="space-y-1">
          <span className="font-semibold">Parcours du signataire ({conventionSignatureStatus.journey_events.length} événements)</span>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {conventionSignatureStatus.journey_events.map((evt, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span className="text-muted-foreground font-mono w-32 shrink-0">
                  {format(parseISO(evt.timestamp), "HH:mm:ss", { locale: fr })}
                </span>
                <span>{journeyEventLabels[evt.event] || evt.event}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verification results */}
      {verificationResult && (
        <div className="space-y-2 border-t pt-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Résultat de vérification</span>
            <span className={`font-semibold ${
              verificationResult.summary.overall === "CONFORME" ? "text-green-600" :
              verificationResult.summary.overall === "NON CONFORME" ? "text-red-600" :
              "text-yellow-600"
            }`}>
              {verificationResult.summary.overall}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            {verificationResult.summary.conforme}/{verificationResult.summary.total_checks} conformes
            {verificationResult.summary.non_conforme > 0 && `, ${verificationResult.summary.non_conforme} non conformes`}
            {verificationResult.summary.partiel_ou_absent > 0 && `, ${verificationResult.summary.partiel_ou_absent} partiels`}
          </div>
          <div className="space-y-0.5">
            {Object.entries(verificationResult.checks).map(([key, check]) => (
              <div key={key} className="flex items-start gap-2">
                <span className="shrink-0">{check.status.split(" ")[0]}</span>
                <span className="text-muted-foreground">{check.detail}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConventionAuditPanel;
