import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { fr } from "date-fns/locale";
import { Receipt, Upload, Check, ExternalLink, Copy } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { resolveContentType } from "@/lib/file-utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { MissionActivity, useUpdateMissionActivity } from "@/hooks/useMissions";
import { supabase } from "@/integrations/supabase/client";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskAmount, maskText } from "@/lib/demoMask";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PennylaneInvoiceFields, { type PennylaneCustomerDraft } from "./PennylaneInvoiceFields";

type InvoiceMode = "pennylane" | "manual";

interface GenerateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activities: MissionActivity[];
  missionId: string;
  missionTitle: string;
}

const GenerateInvoiceDialog = ({
  open,
  onOpenChange,
  activities,
  missionId,
  missionTitle,
}: GenerateInvoiceDialogProps) => {
  const { toast } = useToast();
  const { isDemoMode } = useDemoMode();
  const { copy: copyToClipboard } = useCopyToClipboard({ defaultToastTitle: "Copié dans le presse-papier" });
  const updateActivity = useUpdateMissionActivity();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const unbilledActivities = activities.filter((a) => !a.is_billed && !a.invoice_number && !a.credit_id);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<InvoiceMode>("pennylane");
  const [customer, setCustomer] = useState<PennylaneCustomerDraft | null>(null);
  const [customerSource, setCustomerSource] = useState<"crm" | "mission" | null>(null);
  const [vatRate, setVatRate] = useState("FR_200");
  const queryClient = useQueryClient();
  const prepare = useEdgeFunction<{ customer: PennylaneCustomerDraft; source: "crm" | "mission" }>(
    "create-mission-invoice",
    { errorMessage: "Impossible de retrouver le client de la mission" },
  );
  const createInvoice = useEdgeFunction<{
    invoice_number: string;
    activities_updated: boolean;
    update_error: string | null;
  }>("create-mission-invoice");

  const prepareInvoke = prepare.invoke;
  useEffect(() => {
    if (!open || mode !== "pennylane" || customer) return;
    prepareInvoke({ action: "prepare", mission_id: missionId }).then((res) => {
      if (!res) return;
      setCustomer(res.customer);
      setCustomerSource(res.source);
    });
  }, [open, mode, customer, missionId, prepareInvoke]);

  const customerComplete =
    !!customer &&
    [customer.name, customer.email, customer.address, customer.postal_code, customer.city].every((v) => v.trim());

  const handleCreatePennylane = async () => {
    if (!customer || selectedIds.size === 0) return;
    const res = await createInvoice.invoke({
      action: "create",
      mission_id: missionId,
      activity_ids: Array.from(selectedIds),
      vat_rate: vatRate,
      customer,
    });
    if (!res) return;
    queryClient.invalidateQueries({ queryKey: ["mission-activities", missionId] });
    queryClient.invalidateQueries({ queryKey: ["missions"] });
    if (res.activities_updated) {
      toast({
        title: "Brouillon créé dans Pennylane",
        description: `${res.invoice_number} · ${selectedIds.size} activité(s). À vérifier et finaliser dans Pennylane.`,
      });
    } else {
      toastError(toast, `Brouillon ${res.invoice_number} créé, mais les activités n'ont pas été marquées facturées : ${res.update_error}`);
    }
    setSelectedIds(new Set());
    onOpenChange(false);
  };

  const toggleActivity = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === unbilledActivities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unbilledActivities.map((a) => a.id)));
    }
  };

  const selectedTotal = unbilledActivities
    .filter((a) => selectedIds.has(a.id))
    .reduce((sum, a) => sum + (a.billable_amount || 0), 0);

  const handleFileUpload = async (files: FileList) => {
    const file = files[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "pdf";
      const path = `invoices/${missionId}/${Date.now()}.${ext}`;
      const formData = new FormData();
      formData.append("file", file, file.name);
      formData.append("path", path);
      const { data, error } = await supabase.functions.invoke("upload-mission-file", { body: formData });
      if (error) throw error;
      const publicUrl = (data as { publicUrl?: string } | null)?.publicUrl;
      if (!publicUrl) throw new Error("URL introuvable après l'upload");
      setInvoiceUrl(publicUrl);
      toast({ title: "Fichier uploadé" });
    } catch (err: unknown) {
      toastError(toast, err instanceof Error ? err : "Erreur inconnue", { title: "Erreur d'upload" });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!invoiceNumber.trim()) {
      toastError(toast, "Le numéro de facture est requis");
      return;
    }
    if (selectedIds.size === 0) {
      toastError(toast, "Sélectionnez au moins une activité");
      return;
    }

    setSaving(true);
    try {
      for (const activityId of Array.from(selectedIds)) {
        await updateActivity.mutateAsync({
          id: activityId,
          missionId,
          updates: {
            invoice_number: invoiceNumber.trim(),
            invoice_url: invoiceUrl.trim() || null,
            is_billed: true,
          },
        });
      }

      toast({
        title: "Facture créée",
        description: `${selectedIds.size} activité(s) associée(s) à la facture ${invoiceNumber}`,
      });

      // Reset and close
      setSelectedIds(new Set());
      setInvoiceNumber("");
      setInvoiceUrl("");
      onOpenChange(false);
    } catch (err: unknown) {
      toastError(toast, err instanceof Error ? err : "Erreur inconnue");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Générer une facture
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les activités à facturer pour {isDemoMode ? maskText(missionTitle) : missionTitle}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as InvoiceMode)}>
          <TabsList>
            <TabsTrigger value="pennylane">Brouillon Pennylane</TabsTrigger>
            <TabsTrigger value="manual">Facture existante</TabsTrigger>
          </TabsList>
        </Tabs>

        {unbilledActivities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Check className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>Toutes les activités ont déjà été facturées.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Activity selection table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === unbilledActivities.length && unbilledActivities.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Durée</TableHead>
                    <TableHead className="text-right">Montant</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unbilledActivities.map((activity) => (
                    <TableRow
                      key={activity.id}
                      className={selectedIds.has(activity.id) ? "bg-primary/5" : ""}
                    >
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(activity.id)}
                          onCheckedChange={() => toggleActivity(activity.id)}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {format(parseISO(activity.activity_date), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">
                        {activity.description}
                      </TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap">
                        {activity.duration} {activity.duration_type === "hours" ? "h" : "j"}
                      </TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap">
                        {isDemoMode ? maskAmount(activity.billable_amount ?? 0) : `${activity.billable_amount?.toLocaleString("fr-FR") || "0"} €`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Total */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border gap-3">
                <span className="text-sm font-medium">
                  {selectedIds.size} activité(s) sélectionnée(s)
                </span>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      const selected = unbilledActivities.filter((a) => selectedIds.has(a.id));
                      if (selected.length === 0) return;
                      const sorted = [...selected].sort((a, b) =>
                        a.activity_date.localeCompare(b.activity_date)
                      );
                      const start = parseISO(sorted[0].activity_date);
                      const end = parseISO(sorted[sorted.length - 1].activity_date);
                      const startStr = format(start, "d MMMM yyyy", { locale: fr });
                      const endStr = format(end, "d MMMM yyyy", { locale: fr });
                      const header =
                        sorted[0].activity_date === sorted[sorted.length - 1].activity_date
                          ? `Pour le ${startStr}`
                          : `Pour la période du ${startStr} au ${endStr}`;
                      const lines = sorted.map((a) => `- ${a.description}`).join("\n");
                      const text = `${header}\n${lines}`;
                      await copyToClipboard(text);
                    }}
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copier les intitulés
                  </Button>
                  <span className="text-lg font-bold text-primary">
                    {isDemoMode ? maskAmount(selectedTotal) : `${selectedTotal.toLocaleString("fr-FR")} € HT`}
                  </span>
                </div>
              </div>
            )}

            {mode === "pennylane" && (
              <PennylaneInvoiceFields
                customer={customer}
                loading={prepare.loading}
                source={customerSource}
                onCustomerChange={setCustomer}
                vatRate={vatRate}
                onVatRateChange={setVatRate}
              />
            )}

            {/* Invoice details */}
            {mode === "manual" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>N° de facture *</Label>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="FAC-2026-001"
                />
              </div>
              <div>
                <Label>Lien ou fichier facture</Label>
                <div className="flex gap-2">
                  <Input
                    value={invoiceUrl}
                    onChange={(e) => setInvoiceUrl(e.target.value)}
                    placeholder="https://... ou uploader"
                    className="flex-1"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    className="hidden"
                    onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Spinner />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                  {invoiceUrl && (
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => window.open(invoiceUrl, "_blank")}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          {mode === "pennylane" ? (
            <Button
              onClick={handleCreatePennylane}
              disabled={createInvoice.loading || selectedIds.size === 0 || !customerComplete}
            >
              {createInvoice.loading ? <Spinner className="mr-2" /> : <Receipt className="h-4 w-4 mr-2" />}
              Créer le brouillon dans Pennylane
            </Button>
          ) : (
          <Button
            onClick={handleGenerate}
            disabled={saving || selectedIds.size === 0 || !invoiceNumber.trim()}
          >
            {saving ? (
              <Spinner className="mr-2" />
            ) : (
              <Receipt className="h-4 w-4 mr-2" />
            )}
            Enregistrer la facture
          </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GenerateInvoiceDialog;
