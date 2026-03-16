import { useState } from "react";
import { Upload, Loader2, Send, CheckCircle, FileDown, Scroll, PenLine, Shield, ChevronDown, ChevronUp, Trash2, BellRing, RotateCw, Download } from "lucide-react";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { formatSentDateTime, formatDateTimeSeconds } from "@/lib/dateFormatters";
import { sanitizeFileName } from "@/lib/file-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { ConventionSignatureStatus, VerificationResult } from "./types";

interface ConventionSectionProps {
  trainingId: string;
  isInterEntreprise: boolean;
  formatFormation?: string | null;
  conventionFileUrl: string | null;
  setConventionFileUrl: (url: string | null) => void;
  sponsorEmail: string | null;
  sponsorName: string | null;
  sponsorFirstName: string | null;
  sponsorFormalAddress: boolean;
  conventionSentAt: string | null;
  setConventionSentAt: (date: string | null) => void;
  conventionSignatureStatus: ConventionSignatureStatus | null;
  conventionSignatureUrl: string | null;
  setConventionSignatureUrl: (url: string | null) => void;
  signedConventionUrls: string[];
  setSignedConventionUrls: (urls: string[]) => void;
  onUpdate?: () => void;
}

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

const ConventionSection = ({
  trainingId,
  isInterEntreprise,
  formatFormation,
  conventionFileUrl,
  setConventionFileUrl,
  sponsorEmail,
  sponsorName,
  sponsorFirstName,
  sponsorFormalAddress,
  conventionSentAt,
  setConventionSentAt,
  conventionSignatureStatus,
  conventionSignatureUrl,
  setConventionSignatureUrl,
  signedConventionUrls,
  setSignedConventionUrls,
  onUpdate,
}: ConventionSectionProps) => {
  const [generatingConvention, setGeneratingConvention] = useState(false);
  const [sendingConvention, setSendingConvention] = useState(false);
  const [lastGeneratedConventionFileName, setLastGeneratedConventionFileName] = useState<string | null>(null);
  const [enableOnlineSignature, setEnableOnlineSignature] = useState(true);
  const [uploadingSignedConvention, setUploadingSignedConvention] = useState(false);
  const [sendingConventionReminder, setSendingConventionReminder] = useState(false);
  const [showAuditPanel, setShowAuditPanel] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const { toast } = useToast();

  const formatSentDate = formatSentDateTime;
  const formatFullDate = formatDateTimeSeconds;

  const handleVerifySignature = async () => {
    setVerifying(true);
    try {
      const { data: sigData } = await supabase
        .from("convention_signatures")
        .select("id")
        .eq("training_id", trainingId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!sigData) {
        toast({ title: "Erreur", description: "Aucune signature trouvée", variant: "destructive" });
        return;
      }

      const response = await supabase.functions.invoke("verify-convention-signature", {
        body: { signatureId: sigData.id },
      });

      if (response.error) {
        throw new Error(response.error instanceof Error ? response.error.message : "Erreur inconnue");
      }

      setVerificationResult(response.data as VerificationResult);
      toast({ title: "Vérification terminée", description: `Résultat : ${(response.data as VerificationResult).summary?.overall || "OK"}` });
    } catch (error: unknown) {
      console.error("Verification error:", error);
      toast({ title: "Erreur de vérification", description: error instanceof Error ? error.message : "Erreur inconnue", variant: "destructive" });
    } finally {
      setVerifying(false);
    }
  };

  const handleSignedConventionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingSignedConvention(true);

    try {
      const newUrls: string[] = [];

      for (const file of Array.from(files)) {
        if (!file.type.includes("pdf") && !file.type.includes("image")) {
          toast({
            title: "Format non supporté",
            description: "Seuls les fichiers PDF et images sont acceptés.",
            variant: "destructive",
          });
          continue;
        }

        const fileExt = file.name.split(".").pop();
        const baseName = file.name.replace(`.${fileExt}`, "");
        const sanitizedName = sanitizeFileName(baseName);
        const fileName = `${trainingId}/convention_signee_${Date.now()}_${sanitizedName}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("training-documents")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("training-documents")
          .getPublicUrl(fileName);

        newUrls.push(publicUrl);
      }

      if (newUrls.length > 0) {
        const allUrls = [...signedConventionUrls, ...newUrls];

        const { error: updateError } = await supabase
          .from("trainings")
          .update({ signed_convention_urls: allUrls })
          .eq("id", trainingId);

        if (updateError) throw updateError;

        setSignedConventionUrls(allUrls);
        onUpdate?.();

        toast({
          title: "Convention signée uploadée",
          description: `${newUrls.length} fichier(s) ajouté(s).`,
        });
      }
    } catch (error: unknown) {
      console.error("Upload error:", error);
      toast({
        title: "Erreur d'upload",
        description: error instanceof Error ? error.message : "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setUploadingSignedConvention(false);
      e.target.value = "";
    }
  };

  const handleDeleteSignedConvention = async (urlToDelete: string) => {
    try {
      const updatedUrls = signedConventionUrls.filter(url => url !== urlToDelete);

      const { error: updateError } = await supabase
        .from("trainings")
        .update({ signed_convention_urls: updatedUrls })
        .eq("id", trainingId);

      if (updateError) throw updateError;

      const path = urlToDelete.split("/training-documents/")[1];
      if (path) {
        await supabase.storage.from("training-documents").remove([path]);
      }

      setSignedConventionUrls(updatedUrls);
      onUpdate?.();

      toast({
        title: "Fichier supprimé",
        description: "La convention signée a été retirée.",
      });
    } catch (error: unknown) {
      console.error("Delete error:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de supprimer le fichier.",
        variant: "destructive",
      });
    }
  };

  const handleSendConventionReminder = async () => {
    setSendingConventionReminder(true);
    try {
      const { error } = await supabase.functions.invoke("send-convention-reminder", {
        body: { trainingId },
      });

      if (error) throw error;

      toast({
        title: "Relance envoyée",
        description: `Une relance convention a été envoyée à ${sponsorEmail}.`,
      });
    } catch (error: unknown) {
      console.error("Error sending convention reminder:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'envoyer la relance.",
        variant: "destructive",
      });
    } finally {
      setSendingConventionReminder(false);
    }
  };

  const handleGenerateConvention = async () => {
    if (isInterEntreprise || formatFormation === "e_learning" || formatFormation === "inter") {
      toast({
        title: "Non disponible",
        description: "Pour les formations inter-entreprises et e-learning, la convention se génère par participant.",
        variant: "destructive",
      });
      return;
    }

    setGeneratingConvention(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-convention-formation", {
        body: {
          trainingId,
          subrogation: false,
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error as string);
      }

      if (data?.pdfUrl) {
        setConventionFileUrl(data.pdfUrl as string);
        setLastGeneratedConventionFileName((data.fileName as string) || null);

        toast({
          title: "Convention générée",
          description: "La convention de formation a été générée avec succès.",
        });

        onUpdate?.();
      }
    } catch (error: unknown) {
      console.error("Convention generation error:", error);
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de générer la convention.",
        variant: "destructive",
      });
    } finally {
      setGeneratingConvention(false);
    }
  };

  const handleSendConvention = async () => {
    if (!conventionFileUrl || !sponsorEmail) {
      toast({
        title: "Impossible",
        description: !conventionFileUrl
          ? "Aucune convention générée."
          : "Aucun email de commanditaire défini.",
        variant: "destructive",
      });
      return;
    }

    setSendingConvention(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-convention-email", {
        body: {
          trainingId,
          conventionUrl: conventionFileUrl,
          recipientEmail: sponsorEmail,
          recipientName: sponsorName,
          recipientFirstName: sponsorFirstName,
          formalAddress: sponsorFormalAddress,
          conventionFileName: lastGeneratedConventionFileName,
          enableOnlineSignature,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error as string);

      setConventionSentAt(new Date().toISOString());

      if (data?.signatureUrl) {
        setConventionSignatureUrl(data.signatureUrl as string);
      }

      toast({
        title: "Convention envoyée",
        description: enableOnlineSignature
          ? `Convention envoyée à ${sponsorEmail} avec lien de signature en ligne.`
          : `La convention a été envoyée à ${sponsorEmail}.`,
      });
    } catch (error: unknown) {
      console.error("Send convention error:", error);
      toast({
        title: "Erreur d'envoi",
        description: error instanceof Error ? error.message : "Impossible d'envoyer la convention.",
        variant: "destructive",
      });
    } finally {
      setSendingConvention(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Scroll className="h-4 w-4" />
          Convention de formation
        </Label>
        {!isInterEntreprise && formatFormation !== "e_learning" && formatFormation !== "inter" && (
          <div className="flex items-center gap-0.5">
            {!conventionFileUrl ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateConvention}
                disabled={generatingConvention}
              >
                {generatingConvention ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4 mr-2" />
                )}
                Générer
              </Button>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" disabled={generatingConvention || sendingConvention}>
                    {generatingConvention || sendingConvention ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Scroll className="h-4 w-4 mr-2" />
                    )}
                    Convention
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem asChild>
                    <a href={conventionFileUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="h-4 w-4 mr-2" />Télécharger
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleGenerateConvention} disabled={generatingConvention}>
                    <RotateCw className="h-4 w-4 mr-2" />Regénérer
                  </DropdownMenuItem>
                  {sponsorEmail && (
                    <DropdownMenuItem onClick={handleSendConvention} disabled={sendingConvention}>
                      <Send className="h-4 w-4 mr-2" />Envoyer
                    </DropdownMenuItem>
                  )}
                  {conventionSentAt && conventionSignatureStatus?.status !== "signed" && signedConventionUrls.length === 0 && (
                    <DropdownMenuItem onClick={handleSendConventionReminder} disabled={sendingConventionReminder}>
                      {sendingConventionReminder ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BellRing className="h-4 w-4 mr-2" />}
                      Relancer convention
                    </DropdownMenuItem>
                  )}
                  {conventionSignatureStatus?.status !== "signed" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Label htmlFor="signed-convention-upload" className="cursor-pointer flex items-center">
                          <Upload className="h-4 w-4 mr-2" />Uploader signée
                        </Label>
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
      {conventionFileUrl && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 p-2 bg-muted/50 border border-border rounded-md">
            <CheckCircle className="h-4 w-4 text-primary" />
            <a
              href={conventionFileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-foreground hover:underline flex-1 truncate"
            >
              Convention générée
            </a>
          </div>

          {/* Online signature option */}
          {sponsorEmail && (
            <div className="flex items-center space-x-2 pl-1">
              <Checkbox
                id="enableOnlineSignature"
                checked={enableOnlineSignature}
                onCheckedChange={(checked) => setEnableOnlineSignature(checked === true)}
              />
              <Label htmlFor="enableOnlineSignature" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                <PenLine className="h-3 w-3" />
                Proposer la signature en ligne (en plus du PDF joint)
              </Label>
            </div>
          )}

          {conventionSentAt && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-primary" />
              Envoyée le {formatSentDate(conventionSentAt)} à {sponsorEmail}
            </span>
          )}
          {conventionSignatureUrl && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <PenLine className="h-3 w-3 text-primary" />
              Lien de signature en ligne envoyé
            </span>
          )}

          {/* Convention signature status + audit panel */}
          {conventionSignatureStatus?.status === "signed" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                <div className="flex-1">
                  <span className="text-sm font-medium text-green-700 dark:text-green-300">
                    Convention signée en ligne
                  </span>
                  {conventionSignatureStatus.signer_name && (
                    <span className="text-xs text-green-600 dark:text-green-400 ml-1">
                      par {conventionSignatureStatus.signer_name}
                    </span>
                  )}
                  {conventionSignatureStatus.signed_at && (
                    <span className="text-xs text-green-600 dark:text-green-400 ml-1">
                      le {formatSentDate(conventionSignatureStatus.signed_at)}
                    </span>
                  )}
                </div>
                {conventionSignatureStatus.signed_pdf_url && (
                  <a href={conventionSignatureStatus.signed_pdf_url} target="_blank" rel="noopener noreferrer">
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs gap-1">
                      <FileDown className="h-3 w-3" /> PDF signé
                    </Button>
                  </a>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setShowAuditPanel(!showAuditPanel)}
                >
                  <Shield className="h-3 w-3" />
                  Preuve
                  {showAuditPanel ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </div>

              {/* Audit / Proof Panel */}
              {showAuditPanel && (
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
              )}
            </div>
          )}

          {/* Upload signed convention (manual) - hidden input, triggered from dropdown */}
          {conventionSignatureStatus?.status !== "signed" && (
            <div className="space-y-2">
              <input
                type="file"
                accept=".pdf,image/*"
                multiple
                onChange={handleSignedConventionUpload}
                disabled={uploadingSignedConvention}
                className="hidden"
                id="signed-convention-upload"
              />

              {signedConventionUrls.length > 0 && (
                <div className="space-y-1">
                  {signedConventionUrls.map((url, index) => {
                    const fileName = decodeURIComponent(url.split("/").pop() || `Fichier ${index + 1}`);
                    return (
                      <div key={index} className="flex items-center gap-2 p-1.5 bg-muted/50 border border-border rounded text-xs">
                        <CheckCircle className="h-3 w-3 text-green-600 shrink-0" />
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground hover:underline flex-1 truncate"
                        >
                          {fileName}
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 shrink-0"
                          onClick={() => handleDeleteSignedConvention(url)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {formatFormation === "intra" ? (
        <p className="text-xs text-muted-foreground">
          Génère une convention de formation pour l&apos;ensemble des participants (intra-entreprise)
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Pour les formations inter-entreprises et e-learning, la convention se génère par participant
          (via l&apos;icône convention dans la liste des participants)
        </p>
      )}
    </div>
  );
};

export default ConventionSection;
