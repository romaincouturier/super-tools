import { useState } from "react";
import { format, parseISO } from "date-fns";
import {
  Plus,
  Clock,
  Calendar,
  FileText,
  Trash2,
  Edit2,
  Receipt,
  Loader2,
  ExternalLink,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  useMissionActivities,
  useCreateMissionActivity,
  useUpdateMissionActivity,
  useDeleteMissionActivity,
  MissionActivity,
} from "@/hooks/useMissions";
import { Mission } from "@/types/missions";
import GenerateInvoiceDialog from "./GenerateInvoiceDialog";
import ImportGoogleEventsDialog from "./ImportGoogleEventsDialog";

interface MissionActivityTrackerProps {
  mission: Mission;
  onCreatePageForActivity?: (activityId: string, description: string) => void;
}

const MissionActivityTracker = ({ mission, onCreatePageForActivity }: MissionActivityTrackerProps) => {
  const { toast } = useToast();
  const { data: activities, isLoading } = useMissionActivities(mission.id);
  const createActivity = useCreateMissionActivity();
  const updateActivity = useUpdateMissionActivity();
  const deleteActivity = useDeleteMissionActivity();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [editingActivity, setEditingActivity] = useState<MissionActivity | null>(null);
  

  // Form state
  const [description, setDescription] = useState("");
  const [activityDate, setActivityDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [durationType, setDurationType] = useState<"hours" | "days">("hours");
  const [duration, setDuration] = useState("");
  const [billableAmount, setBillableAmount] = useState("");
  const [invoiceUrl, setInvoiceUrl] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [isBilled, setIsBilled] = useState(false);
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setDescription("");
    setActivityDate(format(new Date(), "yyyy-MM-dd"));
    setDurationType("hours");
    setDuration("");
    setBillableAmount("");
    setInvoiceUrl("");
    setInvoiceNumber("");
    setIsBilled(false);
    setNotes("");
    setEditingActivity(null);
  };

  const openAddDialog = () => {
    resetForm();
    setShowAddDialog(true);
  };

  const openEditDialog = (activity: MissionActivity) => {
    setEditingActivity(activity);
    setDescription(activity.description);
    setActivityDate(activity.activity_date);
    setDurationType(activity.duration_type);
    setDuration(String(activity.duration));
    setBillableAmount(activity.billable_amount ? String(activity.billable_amount) : "");
    setInvoiceUrl(activity.invoice_url || "");
    setInvoiceNumber(activity.invoice_number || "");
    setIsBilled(activity.is_billed);
    setNotes(activity.notes || "");
    setShowAddDialog(true);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({ title: "Erreur", description: "La description est requise", variant: "destructive" });
      return;
    }

    const activityData = {
      mission_id: mission.id,
      description: description.trim(),
      activity_date: activityDate,
      duration_type: durationType,
      duration: parseFloat(duration) || 0,
      billable_amount: billableAmount ? parseFloat(billableAmount) : null,
      invoice_url: invoiceUrl.trim() || null,
      invoice_number: invoiceNumber.trim() || null,
      is_billed: isBilled,
      notes: notes.trim() || null,
    };

    try {
      if (editingActivity) {
        await updateActivity.mutateAsync({
          id: editingActivity.id,
          missionId: mission.id,
          updates: activityData,
        });
        toast({ title: "Activité modifiée" });
      } else {
        await createActivity.mutateAsync(activityData);
        toast({ title: "Activité ajoutée" });
      }
      setShowAddDialog(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (activity: MissionActivity) => {
    if (!confirm("Supprimer cette activité ?")) return;

    try {
      await deleteActivity.mutateAsync({ id: activity.id, missionId: mission.id });
      toast({ title: "Activité supprimée" });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };

  const toggleBilled = async (activity: MissionActivity) => {
    try {
      await updateActivity.mutateAsync({
        id: activity.id,
        missionId: mission.id,
        updates: { is_billed: !activity.is_billed },
      });
    } catch (error: any) {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    }
  };


  // Calculate totals
  const totalConsumed = activities?.reduce((sum, a) => sum + (a.billable_amount || 0), 0) || 0;
  const totalBilled = activities?.reduce((sum, a) => a.is_billed ? sum + (a.billable_amount || 0) : sum, 0) || 0;
  const remainingToBill = (mission.initial_amount || 0) - totalBilled;
  const totalHours = activities?.filter(a => a.duration_type === "hours").reduce((sum, a) => sum + a.duration, 0) || 0;
  const totalDays = activities?.filter(a => a.duration_type === "days").reduce((sum, a) => sum + a.duration, 0) || 0;
  const unbilledCount = activities?.filter(a => !a.is_billed && !a.invoice_number).length || 0;

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <div className="text-xs text-blue-600 font-medium">Budget initial HT</div>
          <div className="text-lg font-bold text-blue-700">
            {mission.initial_amount?.toLocaleString("fr-FR") || "0"} €
          </div>
        </div>
        <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
          <div className="text-xs text-orange-600 font-medium">Consommé HT</div>
          <div className="text-lg font-bold text-orange-700">
            {totalConsumed.toLocaleString("fr-FR")} €
          </div>
        </div>
        <div className="p-3 bg-green-50 rounded-lg border border-green-100">
          <div className="text-xs text-green-600 font-medium">Facturé HT</div>
          <div className="text-lg font-bold text-green-700">
            {totalBilled.toLocaleString("fr-FR")} €
          </div>
        </div>
        <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
          <div className="text-xs text-purple-600 font-medium">Reste à facturer HT</div>
          <div className="text-lg font-bold text-purple-700">
            {remainingToBill.toLocaleString("fr-FR")} €
          </div>
        </div>
      </div>

      {/* Time Summary */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" />
          {totalHours}h
        </span>
        <span className="flex items-center gap-1">
          <Calendar className="h-4 w-4" />
          {totalDays}j
        </span>
      </div>

      {/* Activity List Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Activités ({activities?.length || 0})</h4>
        <div className="flex items-center gap-2">
          {unbilledCount > 0 && (
            <Button size="sm" variant="outline" onClick={() => setShowInvoiceDialog(true)}>
              <Receipt className="h-4 w-4 mr-1" />
              Générer une facture
              <Badge variant="secondary" className="ml-1 text-xs">{unbilledCount}</Badge>
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowImportDialog(true)}>
            <Download className="h-4 w-4 mr-1" />
            Google Agenda
          </Button>
          <Button size="sm" onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-1" />
            Ajouter
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : activities && activities.length > 0 ? (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Durée</TableHead>
                <TableHead className="text-right">Montant</TableHead>
                <TableHead className="text-center">Facturé</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activities.map((activity) => (
                <TableRow key={activity.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(parseISO(activity.activity_date), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="max-w-[200px] truncate flex items-center gap-1" title={activity.description}>
                      {activity.google_event_link ? (
                        <a
                          href={activity.google_event_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600 shrink-0"
                          title="Voir dans Google Agenda"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                        </a>
                      ) : activity.google_event_id ? (
                        <Calendar className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                      ) : null}
                      {activity.description}
                    </div>
                    {activity.invoice_number && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Receipt className="h-3 w-3" />
                        {activity.invoice_url ? (
                          <a
                            href={activity.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center gap-0.5"
                          >
                            {activity.invoice_number}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          activity.invoice_number
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {activity.duration} {activity.duration_type === "hours" ? "h" : "j"}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {activity.billable_amount?.toLocaleString("fr-FR") || "-"} €
                  </TableCell>
                  <TableCell className="text-center">
                    <Checkbox
                      checked={activity.is_billed}
                      onCheckedChange={() => toggleBilled(activity)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {onCreatePageForActivity && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Créer une page pour cette activité"
                          onClick={() => onCreatePageForActivity(activity.id, activity.description)}
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditDialog(activity)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(activity)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Aucune activité enregistrée
        </div>
      )}

      {/* Import Google Events Dialog */}
      <ImportGoogleEventsDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        mission={mission}
      />

      {/* Generate Invoice Dialog */}
      <GenerateInvoiceDialog
        open={showInvoiceDialog}
        onOpenChange={setShowInvoiceDialog}
        activities={activities || []}
        missionId={mission.id}
        missionTitle={mission.title}
      />

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingActivity ? "Modifier l'activité" : "Nouvelle activité"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Description *</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Description de l'activité"
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={activityDate}
                  onChange={(e) => setActivityDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Type de durée</Label>
                <Select value={durationType} onValueChange={(v) => setDurationType(v as "hours" | "days")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Heures</SelectItem>
                    <SelectItem value="days">Jours</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Durée ({durationType === "hours" ? "heures" : "jours"})</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div>
                <Label>Montant facturable (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={billableAmount}
                  onChange={(e) => setBillableAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>N° Facture</Label>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="FAC-2026-001"
                />
              </div>
              <div>
                <Label>Lien facture</Label>
                <Input
                  type="url"
                  value={invoiceUrl}
                  onChange={(e) => setInvoiceUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="is-billed"
                checked={isBilled}
                onCheckedChange={(checked) => setIsBilled(checked as boolean)}
              />
              <Label htmlFor="is-billed">Facturé</Label>
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes additionnelles..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createActivity.isPending || updateActivity.isPending}
            >
              {(createActivity.isPending || updateActivity.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingActivity ? "Modifier" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MissionActivityTracker;
