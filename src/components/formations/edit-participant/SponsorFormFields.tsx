import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ChevronsUpDown, Check, StickyNote, Loader2, CheckCircle2, ExternalLink, FileText, Upload, Trash2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
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
import type { ConventionSignatureStatus } from "@/services/participants";

interface SponsorFormFieldsProps {
  sponsorFirstName: string;
  setSponsorFirstName: (v: string) => void;
  sponsorLastName: string;
  setSponsorLastName: (v: string) => void;
  sponsorEmail: string;
  setSponsorEmail: (v: string) => void;
  financeurSameAsSponsor: boolean;
  setFinanceurSameAsSponsor: (v: boolean) => void;
  financeurName: string;
  setFinanceurName: (v: string) => void;
  financeurUrl: string;
  setFinanceurUrl: (v: string) => void;
  financeurPopoverOpen: boolean;
  setFinanceurPopoverOpen: (v: boolean) => void;
  existingFinanceurs: string[];
  paymentMode: "online" | "invoice";
  setPaymentMode: (v: "online" | "invoice") => void;
  notes: string;
  setNotes: (v: string) => void;
  signedConventionUrl: string | null;
  uploadingConvention: boolean;
  conventionSignature: ConventionSignatureStatus | null;
  participantId: string;
  handleConventionUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleConventionDelete: () => void;
}

const SponsorFormFields = ({
  sponsorFirstName,
  setSponsorFirstName,
  sponsorLastName,
  setSponsorLastName,
  sponsorEmail,
  setSponsorEmail,
  financeurSameAsSponsor,
  setFinanceurSameAsSponsor,
  financeurName,
  setFinanceurName,
  financeurUrl,
  setFinanceurUrl,
  financeurPopoverOpen,
  setFinanceurPopoverOpen,
  existingFinanceurs,
  paymentMode,
  setPaymentMode,
  notes,
  setNotes,
  signedConventionUrl,
  uploadingConvention,
  conventionSignature,
  participantId,
  handleConventionUpload,
  handleConventionDelete,
}: SponsorFormFieldsProps) => {
  return (
    <>
      {/* Sponsor/Commanditaire fields */}
      <div className="pt-4 border-t">
        <Label className="text-sm font-medium text-muted-foreground">
          Commanditaire (facturation)
        </Label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-sponsorFirstName">Prénom</Label>
          <Input
            id="edit-sponsorFirstName"
            value={sponsorFirstName}
            onChange={(e) => setSponsorFirstName(e.target.value)}
            placeholder="Marie"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="edit-sponsorLastName">Nom</Label>
          <Input
            id="edit-sponsorLastName"
            value={sponsorLastName}
            onChange={(e) => setSponsorLastName(e.target.value)}
            placeholder="Martin"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="edit-sponsorEmail">Email du commanditaire</Label>
        <Input
          id="edit-sponsorEmail"
          type="email"
          value={sponsorEmail}
          onChange={(e) => setSponsorEmail(e.target.value)}
          placeholder="marie.martin@example.com"
        />
      </div>

      {/* Funder section */}
      <div className="pt-4 border-t">
        <Label className="text-sm font-medium text-muted-foreground">
          Financeur
        </Label>
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox
          id="edit-financeurSameAsSponsor"
          checked={financeurSameAsSponsor}
          onCheckedChange={(checked) =>
            setFinanceurSameAsSponsor(checked === true)
          }
        />
        <Label
          htmlFor="edit-financeurSameAsSponsor"
          className="text-sm font-normal cursor-pointer"
        >
          Le financeur est identique au commanditaire
        </Label>
      </div>
      {!financeurSameAsSponsor && (
        <>
          <div className="space-y-2">
            <Label htmlFor="edit-financeurName">Nom du financeur</Label>
            <Popover
              open={financeurPopoverOpen}
              onOpenChange={setFinanceurPopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={financeurPopoverOpen}
                  className="w-full justify-between font-normal truncate"
                >
                  <span className="truncate">
                    {financeurName ||
                      "Sélectionner ou saisir un financeur..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Command>
                  <CommandInput
                    placeholder="Rechercher ou saisir un financeur..."
                    value={financeurName}
                    onValueChange={setFinanceurName}
                  />
                  <CommandList>
                    <CommandEmpty>
                      <div className="p-2 text-sm text-muted-foreground">
                        Appuyez sur Entrée pour utiliser &quot;{financeurName}&quot;
                      </div>
                    </CommandEmpty>
                    <CommandGroup>
                      {existingFinanceurs.map((f) => (
                        <CommandItem
                          key={f}
                          value={f}
                          onSelect={(value) => {
                            setFinanceurName(value);
                            setFinanceurPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              financeurName === f
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {f}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-financeurUrl">URL du financeur</Label>
            <Input
              id="edit-financeurUrl"
              type="url"
              value={financeurUrl}
              onChange={(e) => setFinanceurUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
        </>
      )}

      {/* Payment mode */}
      <div className="pt-4 border-t">
        <Label className="text-sm font-medium text-muted-foreground">
          Mode de paiement
        </Label>
      </div>
      <RadioGroup
        value={paymentMode}
        onValueChange={(v) => setPaymentMode(v as "online" | "invoice")}
        className="flex gap-4"
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="online" id="edit-paymentOnline" />
          <Label
            htmlFor="edit-paymentOnline"
            className="font-normal cursor-pointer"
          >
            Payé en ligne
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="invoice" id="edit-paymentInvoice" />
          <Label
            htmlFor="edit-paymentInvoice"
            className="font-normal cursor-pointer"
          >
            À facturer
          </Label>
        </div>
      </RadioGroup>

      {/* Convention signée section */}
      <div className="pt-4 border-t">
        <Label className="text-sm font-medium text-muted-foreground">
          Convention signée
        </Label>
      </div>

      {/* Electronic signature status */}
      {conventionSignature?.status === "signed" &&
        conventionSignature.signed_pdf_url && (
          <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Signée électroniquement
              </p>
              {conventionSignature.signed_at && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  le{" "}
                  {new Date(
                    conventionSignature.signed_at,
                  ).toLocaleDateString("fr-FR")}
                </p>
              )}
            </div>
            <a
              href={conventionSignature.signed_pdf_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button type="button" variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-1" />
                Voir
              </Button>
            </a>
          </div>
        )}

      {conventionSignature?.status === "pending" && !signedConventionUrl && (
        <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
          <Loader2 className="h-5 w-5 text-amber-600 animate-spin flex-shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            En attente de signature électronique
          </p>
        </div>
      )}

      {/* Manual upload for signed convention */}
      <div className="space-y-2">
        <Label className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Convention signée (upload manuel)
        </Label>

        {signedConventionUrl ? (
          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <button
              type="button"
              className="flex-1 text-sm text-primary hover:underline truncate text-left"
              onClick={async () => {
                try {
                  const response = await fetch(signedConventionUrl);
                  const blob = await response.blob();
                  const url = window.URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "convention_signee.pdf";
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  window.URL.revokeObjectURL(url);
                } catch {
                  window.open(signedConventionUrl, "_blank");
                }
              }}
            >
              <Download className="h-3 w-3 inline mr-1" />
              Télécharger la convention signée
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Supprimer la convention signée ?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleConventionDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ) : (
          <Label
            htmlFor={`signed-convention-${participantId}`}
            className="cursor-pointer"
          >
            <input
              id={`signed-convention-${participantId}`}
              type="file"
              accept=".pdf"
              className="hidden"
              disabled={uploadingConvention}
              onChange={handleConventionUpload}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploadingConvention}
              asChild
            >
              <span>
                {uploadingConvention ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Uploader une convention signée
              </span>
            </Button>
          </Label>
        )}
      </div>

      {/* Notes libres */}
      <div className="pt-4 border-t">
        <Label className="text-sm font-medium text-muted-foreground flex items-center gap-1">
          <StickyNote className="h-4 w-4" />
          Notes
        </Label>
      </div>
      <div className="space-y-2">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes libres sur ce participant..."
          rows={3}
        />
      </div>
    </>
  );
};

export default SponsorFormFields;
