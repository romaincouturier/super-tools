import {
  Upload,
  FileText,
  Trash2,
  Loader2,
  Send,
  Receipt,
  ClipboardList,
  Mail,
  Link,
  CheckCircle,
  FileDown,
  Scroll,
  PenLine,
  Shield,
  ChevronDown,
  ChevronUp,
  BellRing,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AttendanceSheetGenerator from "@/components/formations/AttendanceSheetGenerator";
import type { DocumentsManagerProps } from "./DocumentsManager.types";
import { useDocumentsManager } from "./useDocumentsManager";

const DocumentsManager = (props: DocumentsManagerProps) => {
  const {
    trainingName,
    startDate,
    endDate,
    sponsorEmail,
    formatFormation,
    trainerName,
    location,
    schedules,
    participants,
  } = props;

  const dm = useDocumentsManager(props);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documents et communication
          </CardTitle>
          <CardDescription>
            Gérez les documents administratifs et les communications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 1. Convention de Formation Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Scroll className="h-4 w-4" />
                Convention de formation
              </Label>
              {formatFormation === "intra" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={dm.handleGenerateConvention}
                  disabled={dm.generatingConvention}
                >
                  {dm.generatingConvention ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4 mr-2" />
                  )}
                  {dm.conventionFileUrl ? "Regénérer" : "Générer"}
                </Button>
              )}
            </div>
            {dm.conventionFileUrl && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-muted/50 border border-border rounded-md">
                  <CheckCircle className="h-4 w-4 text-primary" />
                  <a
                    href={dm.conventionFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-foreground hover:underline flex-1 truncate"
                  >
                    Convention générée - Cliquer pour télécharger
                  </a>
                  {sponsorEmail && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={dm.handleSendConvention}
                      disabled={dm.sendingConvention}
                      className="shrink-0"
                    >
                      {dm.sendingConvention ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-1" />
                      )}
                      Envoyer
                    </Button>
                  )}
                </div>

                {/* Online signature option */}
                {sponsorEmail && (
                  <div className="flex items-center space-x-2 pl-1">
                    <Checkbox
                      id="enableOnlineSignature"
                      checked={dm.enableOnlineSignature}
                      onCheckedChange={(checked) => dm.setEnableOnlineSignature(checked === true)}
                    />
                    <Label
                      htmlFor="enableOnlineSignature"
                      className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1"
                    >
                      <PenLine className="h-3 w-3" />
                      Proposer la signature en ligne (en plus du PDF joint)
                    </Label>
                  </div>
                )}

                {dm.conventionSentAt && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-primary" />
                    Envoyée le {dm.formatSentDate(dm.conventionSentAt)} à {sponsorEmail}
                  </span>
                )}
                {dm.conventionSignatureUrl && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <PenLine className="h-3 w-3 text-primary" />
                    Lien de signature en ligne envoyé
                  </span>
                )}

                {/* Convention reminder button */}
                {dm.conventionSentAt &&
                  dm.conventionSignatureStatus?.status !== "signed" &&
                  dm.signedConventionUrls.length === 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={dm.handleSendConventionReminder}
                      disabled={dm.sendingConventionReminder}
                      className="w-fit"
                    >
                      {dm.sendingConventionReminder ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <BellRing className="h-4 w-4 mr-2" />
                      )}
                      Relancer pour la convention signée
                    </Button>
                  )}

                {/* Convention signature status + audit panel */}
                {dm.conventionSignatureStatus?.status === "signed" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-green-700 dark:text-green-300">
                          Convention signée en ligne
                        </span>
                        {dm.conventionSignatureStatus.signer_name && (
                          <span className="text-xs text-green-600 dark:text-green-400 ml-1">
                            par {dm.conventionSignatureStatus.signer_name}
                          </span>
                        )}
                        {dm.conventionSignatureStatus.signed_at && (
                          <span className="text-xs text-green-600 dark:text-green-400 ml-1">
                            le {dm.formatSentDate(dm.conventionSignatureStatus.signed_at)}
                          </span>
                        )}
                      </div>
                      {dm.conventionSignatureStatus.signed_pdf_url && (
                        <a
                          href={dm.conventionSignatureStatus.signed_pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                          >
                            <FileDown className="h-3 w-3" /> PDF signé
                          </Button>
                        </a>
                      )}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => dm.setShowAuditPanel(!dm.showAuditPanel)}
                      >
                        <Shield className="h-3 w-3" />
                        Preuve
                        {dm.showAuditPanel ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </Button>
                    </div>

                    {/* Audit / Proof Panel */}
                    {dm.showAuditPanel && (
                      <div className="p-3 bg-muted/30 border border-border rounded-md space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-sm">Dossier de preuve</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            onClick={dm.handleVerifySignature}
                            disabled={dm.verifying}
                          >
                            {dm.verifying ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Shield className="h-3 w-3" />
                            )}
                            Vérifier l'intégrité
                          </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <span className="text-muted-foreground">Signataire</span>
                          <span className="font-medium">
                            {dm.conventionSignatureStatus.signer_name || "—"}
                          </span>
                          {dm.conventionSignatureStatus.signer_function && (
                            <>
                              <span className="text-muted-foreground">Fonction</span>
                              <span>{dm.conventionSignatureStatus.signer_function}</span>
                            </>
                          )}
                          <span className="text-muted-foreground">Date de signature</span>
                          <span>
                            {dm.conventionSignatureStatus.signed_at
                              ? dm.formatFullDate(dm.conventionSignatureStatus.signed_at)
                              : "—"}
                          </span>
                          <span className="text-muted-foreground">Adresse IP</span>
                          <span className="font-mono">
                            {dm.conventionSignatureStatus.ip_address || "—"}
                          </span>
                          <span className="text-muted-foreground">Consentement donné</span>
                          <span>
                            {dm.conventionSignatureStatus.consent_timestamp
                              ? dm.formatFullDate(dm.conventionSignatureStatus.consent_timestamp)
                              : "—"}
                          </span>
                        </div>

                        <div className="space-y-1">
                          <span className="font-semibold">Empreintes numériques</span>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <span className="text-muted-foreground">Signature (SHA-256)</span>
                            <span
                              className="font-mono truncate"
                              title={dm.conventionSignatureStatus.signature_hash || undefined}
                            >
                              {dm.conventionSignatureStatus.signature_hash
                                ? dm.conventionSignatureStatus.signature_hash.substring(0, 24) +
                                  "..."
                                : "—"}
                            </span>
                            <span className="text-muted-foreground">Document PDF</span>
                            <span
                              className="font-mono truncate"
                              title={dm.conventionSignatureStatus.pdf_hash || undefined}
                            >
                              {dm.conventionSignatureStatus.pdf_hash
                                ? dm.conventionSignatureStatus.pdf_hash.substring(0, 24) + "..."
                                : "—"}
                            </span>
                            <span className="text-muted-foreground">Dossier de preuve</span>
                            <span
                              className="font-mono truncate"
                              title={dm.conventionSignatureStatus.proof_hash || undefined}
                            >
                              {dm.conventionSignatureStatus.proof_hash
                                ? dm.conventionSignatureStatus.proof_hash.substring(0, 24) + "..."
                                : "—"}
                            </span>
                          </div>
                        </div>

                        {dm.conventionSignatureStatus.journey_events &&
                          dm.conventionSignatureStatus.journey_events.length > 0 && (
                            <div className="space-y-1">
                              <span className="font-semibold">
                                Parcours du signataire (
                                {dm.conventionSignatureStatus.journey_events.length} événements)
                              </span>
                              <div className="max-h-40 overflow-y-auto space-y-0.5">
                                {dm.conventionSignatureStatus.journey_events.map((evt, i) => (
                                  <div key={i} className="flex items-center gap-2 py-0.5">
                                    <span className="text-muted-foreground font-mono w-32 shrink-0">
                                      {format(parseISO(evt.timestamp), "HH:mm:ss", { locale: fr })}
                                    </span>
                                    <span>{dm.journeyEventLabels[evt.event] || evt.event}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {dm.verificationResult && (
                          <div className="space-y-2 border-t pt-2">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">Résultat de vérification</span>
                              <span
                                className={`font-semibold ${
                                  dm.verificationResult.summary.overall === "CONFORME"
                                    ? "text-green-600"
                                    : dm.verificationResult.summary.overall === "NON CONFORME"
                                      ? "text-red-600"
                                      : "text-yellow-600"
                                }`}
                              >
                                {dm.verificationResult.summary.overall}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {dm.verificationResult.summary.conforme}/
                              {dm.verificationResult.summary.total_checks} conformes
                              {dm.verificationResult.summary.non_conforme > 0 &&
                                `, ${dm.verificationResult.summary.non_conforme} non conformes`}
                              {dm.verificationResult.summary.partiel_ou_absent > 0 &&
                                `, ${dm.verificationResult.summary.partiel_ou_absent} partiels`}
                            </div>
                            <div className="space-y-0.5">
                              {Object.entries(dm.verificationResult.checks).map(([key, check]) => (
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

                {/* Upload signed convention (manual) */}
                {dm.conventionSignatureStatus?.status !== "signed" && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".pdf,image/*"
                        multiple
                        onChange={dm.handleSignedConventionUpload}
                        disabled={dm.uploadingSignedConvention}
                        className="hidden"
                        id="signed-convention-upload"
                      />
                      <Label htmlFor="signed-convention-upload" className="cursor-pointer">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={dm.uploadingSignedConvention}
                          asChild
                        >
                          <span>
                            {dm.uploadingSignedConvention ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <Upload className="h-4 w-4 mr-1" />
                            )}
                            Uploader la convention signée
                          </span>
                        </Button>
                      </Label>
                    </div>

                    {dm.signedConventionUrls.length > 0 && (
                      <div className="space-y-1">
                        {dm.signedConventionUrls.map((url, index) => {
                          const fileName = decodeURIComponent(
                            url.split("/").pop() || `Fichier ${index + 1}`,
                          );
                          return (
                            <div
                              key={index}
                              className="flex items-center gap-2 p-1.5 bg-muted/50 border border-border rounded text-xs"
                            >
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
                                onClick={() => dm.handleDeleteSignedConvention(url)}
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
                Génère une convention de formation pour l'ensemble des participants
                (intra-entreprise)
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Pour les formations inter-entreprises et e-learning, la convention se génère par
                participant (via l'icône convention dans la liste des participants)
              </p>
            )}
          </div>

          {/* 2. Supports URL */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Lien vers les supports de formation
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="url"
                value={dm.supportsUrl}
                onChange={(e) => dm.setSupportsUrl(e.target.value)}
                onBlur={dm.handleSupportsUrlBlur}
                placeholder="https://drive.google.com/..."
                disabled={dm.savingSupportsUrl}
              />
              {dm.savingSupportsUrl && <Loader2 className="h-4 w-4 animate-spin" />}
            </div>
          </div>

          {/* 3. Attendance Sheets Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <Label className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" />
                  Feuilles d'émargement ({dm.attendanceSheetsUrls.length})
                </Label>
                {dm.documentsSentInfo.sheets && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-primary" />
                    Envoyées le {dm.formatSentDate(dm.documentsSentInfo.sheets)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <AttendanceSheetGenerator
                  trainingName={trainingName}
                  trainerName={trainerName}
                  location={location}
                  startDate={startDate}
                  endDate={endDate}
                  schedules={schedules}
                  participants={participants}
                />
                <div>
                  <Input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,image/*"
                    multiple
                    onChange={dm.handleSheetUpload}
                    disabled={dm.uploadingSheet}
                    className="hidden"
                    id="sheet-upload"
                  />
                  <Label htmlFor="sheet-upload" className="cursor-pointer">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={dm.uploadingSheet}
                      asChild
                    >
                      <span>
                        {dm.uploadingSheet ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4 mr-2" />
                        )}
                        Ajouter
                      </span>
                    </Button>
                  </Label>
                </div>
              </div>
            </div>

            {dm.attendanceSheetsUrls.length > 0 && (
              <div className="space-y-2">
                {dm.attendanceSheetsUrls.map((url, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-sm text-primary hover:underline truncate"
                    >
                      Feuille {index + 1} - {dm.getFileNameFromUrl(url)}
                    </a>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cette feuille ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette action est irréversible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => dm.handleDeleteSheet(url)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Invoice Section */}
          {dm.isInterEntreprise ? (
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Les factures sont gérées par participant (cliquez sur l'icône facture dans la liste
                des participants)
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-1">
                  <Label className="flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Facture
                  </Label>
                  {dm.documentsSentInfo.invoice && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <CheckCircle className="h-3 w-3 text-primary" />
                      Envoyée le {dm.formatSentDate(dm.documentsSentInfo.invoice)}
                    </span>
                  )}
                </div>
                {!dm.invoiceFileUrl && (
                  <div>
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={dm.handleInvoiceUpload}
                      disabled={dm.uploadingInvoice}
                      className="hidden"
                      id="invoice-upload"
                    />
                    <Label htmlFor="invoice-upload" className="cursor-pointer">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={dm.uploadingInvoice}
                        asChild
                      >
                        <span>
                          {dm.uploadingInvoice ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Uploader
                        </span>
                      </Button>
                    </Label>
                  </div>
                )}
              </div>

              {dm.invoiceFileUrl && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                  <a
                    href={dm.invoiceFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm text-primary hover:underline truncate"
                  >
                    {dm.getFileNameFromUrl(dm.invoiceFileUrl)}
                  </a>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer la facture ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={dm.handleDeleteInvoice}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          )}

          {/* Send Documents Section */}
          <div className="pt-4 border-t space-y-3">
            {dm.isInterEntreprise ? (
              dm.attendanceSheetsUrls.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="default"
                      className="w-full"
                      disabled={dm.sendingDocuments}
                    >
                      {dm.sendingDocuments ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 mr-2" />
                      )}
                      Envoyer les émargements
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                      Envoyer à un destinataire
                    </p>
                    <DropdownMenuItem onClick={() => dm.openCustomRecipientDialog("sheets", false)}>
                      <Mail className="h-4 w-4 mr-2" />
                      Feuilles d'émargement
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button type="button" variant="default" className="w-full" disabled>
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer les émargements
                </Button>
              )
            ) : dm.invoiceFileUrl || dm.attendanceSheetsUrls.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="default"
                    className="w-full"
                    disabled={dm.sendingDocuments}
                  >
                    {dm.sendingDocuments ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Envoyer les documents
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72">
                  {sponsorEmail && (
                    <>
                      <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                        Envoyer au commanditaire
                      </p>
                      <p className="px-2 pb-1.5 text-xs text-muted-foreground truncate">
                        {sponsorEmail}
                      </p>
                      {dm.invoiceFileUrl && (
                        <DropdownMenuItem
                          onClick={() => dm.openCustomRecipientDialog("invoice", true)}
                        >
                          <Receipt className="h-4 w-4 mr-2" />
                          Facture
                        </DropdownMenuItem>
                      )}
                      {dm.attendanceSheetsUrls.length > 0 && (
                        <DropdownMenuItem
                          onClick={() => dm.openCustomRecipientDialog("sheets", true)}
                        >
                          <ClipboardList className="h-4 w-4 mr-2" />
                          Feuilles d'émargement
                        </DropdownMenuItem>
                      )}
                      {dm.invoiceFileUrl && dm.attendanceSheetsUrls.length > 0 && (
                        <DropdownMenuItem onClick={() => dm.openCustomRecipientDialog("all", true)}>
                          <FileText className="h-4 w-4 mr-2" />
                          Tous les documents
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <p className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                    Envoyer à un autre destinataire
                  </p>
                  {dm.invoiceFileUrl && (
                    <DropdownMenuItem
                      onClick={() => dm.openCustomRecipientDialog("invoice", false)}
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Facture → autre email
                    </DropdownMenuItem>
                  )}
                  {dm.attendanceSheetsUrls.length > 0 && (
                    <DropdownMenuItem onClick={() => dm.openCustomRecipientDialog("sheets", false)}>
                      <Mail className="h-4 w-4 mr-2" />
                      Émargements → autre email
                    </DropdownMenuItem>
                  )}
                  {dm.invoiceFileUrl && dm.attendanceSheetsUrls.length > 0 && (
                    <DropdownMenuItem onClick={() => dm.openCustomRecipientDialog("all", false)}>
                      <Mail className="h-4 w-4 mr-2" />
                      Tous → autre email
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button type="button" variant="default" className="w-full" disabled>
                <Send className="h-4 w-4 mr-2" />
                Envoyer les documents
              </Button>
            )}
            {!dm.isInterEntreprise &&
              !dm.invoiceFileUrl &&
              dm.attendanceSheetsUrls.length === 0 && (
                <p className="text-xs text-muted-foreground text-center">
                  Uploadez une facture ou des feuilles d'émargement pour les envoyer
                </p>
              )}
            {dm.isInterEntreprise && dm.attendanceSheetsUrls.length === 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Uploadez des feuilles d'émargement pour les envoyer. Les factures sont gérées par
                participant.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Custom Recipient Dialog */}
      <Dialog open={dm.showCustomRecipientDialog} onOpenChange={dm.setShowCustomRecipientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dm.sendToSponsorWithOptions
                ? "Envoyer au commanditaire"
                : "Envoyer à un autre destinataire"}
            </DialogTitle>
            <DialogDescription>
              {dm.sendToSponsorWithOptions
                ? `Envoi de ${dm.pendingDocumentType === "invoice" ? "la facture" : dm.pendingDocumentType === "sheets" ? "les feuilles d'émargement" : "tous les documents"} au commanditaire. Vous pouvez ajouter un email en copie.`
                : `Entrez l'adresse email du destinataire pour ${dm.pendingDocumentType === "invoice" ? "la facture" : dm.pendingDocumentType === "sheets" ? "les feuilles d'émargement" : "tous les documents"}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="customEmail">Email du destinataire</Label>
              <Input
                id="customEmail"
                type="email"
                value={dm.customRecipientEmail}
                onChange={(e) => dm.setCustomRecipientEmail(e.target.value)}
                placeholder="destinataire@exemple.fr"
                disabled={dm.sendToSponsorWithOptions}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ccEmail">Email en copie (CC) - optionnel</Label>
              <Input
                id="ccEmail"
                type="email"
                value={dm.ccEmail}
                onChange={(e) => dm.setCcEmail(e.target.value)}
                placeholder="copie@exemple.fr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                dm.setShowCustomRecipientDialog(false);
                dm.setCustomRecipientEmail("");
                dm.setCcEmail("");
              }}
            >
              Annuler
            </Button>
            <Button
              onClick={() => {
                if (dm.pendingDocumentType && dm.customRecipientEmail) {
                  const emailToPass = dm.sendToSponsorWithOptions
                    ? undefined
                    : dm.customRecipientEmail;
                  dm.handleSendDocuments(
                    dm.pendingDocumentType,
                    emailToPass,
                    dm.ccEmail || undefined,
                  );
                }
              }}
              disabled={!dm.customRecipientEmail || dm.sendingDocuments}
            >
              {dm.sendingDocuments ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Envoyer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default DocumentsManager;
