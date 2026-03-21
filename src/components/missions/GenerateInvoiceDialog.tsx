import { useState, useRef } from "react";
import { format, parseISO } from "date-fns";
import {
  Receipt,
  Loader2,
  Upload,
  Check,
  ExternalLink,
} from "lucide-react";
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
import { MissionActivity, useUpdateMissionActivity } from "@/hooks/useMissions";
import { supabase } from "@/integrations/supabase/client";

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
  const updateActivity = useUpdateMissionActivity();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const unbilledActivities = activities.filter((a) => !a.is_billed && !a.invoice_number);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

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
      const fileName = `invoices/${missionId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("mission-media")
        .upload(fileName, file, { contentType: resolveContentType(file) });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("mission-media")
        .getPublicUrl(fileName);

      setInvoiceUrl(urlData.publicUrl);
      toast({ title: "Fichier uploadé" });
    } catch (err: unknown) {
      toast({ title: "Erreur d'upload", description: (err instanceof Error ? err.message : "Erreur inconnue"), variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!invoiceNumber.trim()) {
      toast({ title: "Erreur", description: "Le numéro de facture est requis", variant: "destructive" });
      return;
    }
    if (selectedIds.size === 0) {
      toast({ title: "Erreur", description: "Sélectionnez au moins une activité", variant: "destructive" });
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
      toast({ title: "Erreur", description: (err instanceof Error ? err.message : "Erreur inconnue"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Générer une facture
          </DialogTitle>
          <DialogDescription>
            Sélectionnez les activités à facturer pour {missionTitle}
          </DialogDescription>
        </DialogHeader>

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
                        {activity.billable_amount?.toLocaleString("fr-FR") || "0"} €
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Total */}
            {selectedIds.size > 0 && (
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border">
                <span className="text-sm font-medium">
                  {selectedIds.size} activité(s) sélectionnée(s)
                </span>
                <span className="text-lg font-bold text-primary">
                  {selectedTotal.toLocaleString("fr-FR")} € HT
                </span>
              </div>
            )}

            {/* Invoice details */}
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
                      <Loader2 className="h-4 w-4 animate-spin" />
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
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={saving || selectedIds.size === 0 || !invoiceNumber.trim()}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Receipt className="h-4 w-4 mr-2" />
            )}
            Générer la facture
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GenerateInvoiceDialog;
