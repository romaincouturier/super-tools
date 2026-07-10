import { useState } from "react";
import { ArrowLeft, ExternalLink, Edit2, Map, Copy, MoreHorizontal, Ban, RotateCcw, Trash2, Train, Hotel, UtensilsCrossed, DoorOpen, Package } from "lucide-react";
import { useFeatureTracking } from "@/hooks/useFeatureTracking";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { deleteTraining } from "@/services/trainings";
import { toastError } from "@/lib/toastError";
import type { Training, Schedule } from "@/hooks/useFormationDetail";
import { Input } from "@/components/ui/input";
import { getGoogleMapsNearbyUrl } from "@/lib/googleMaps";
import { openExternalLink } from "@/lib/utils";
import AddFormationToCalendarButton from "@/components/formations/AddFormationToCalendarButton";

import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskText } from "@/lib/demoMask";

interface Props {
  training: Training;
  setTraining: (t: Training) => void;
  schedules: Schedule[];
  id: string;
  isMobile: boolean;
  isPresentiel: boolean;
  isInterSession: boolean;
  formatDateWithSchedule: (s: string | null, e: string | null, sch: Schedule[]) => string;
  navigate: (path: string) => void;
  toast: ReturnType<typeof import("@/hooks/use-toast").useToast>["toast"];
  setMapDialogOpen: (v: boolean) => void;
  setDuplicateDialogOpen: (v: boolean) => void;
  requiredEquipment?: string | null;
}

const FormationDetailHeader = ({
  training,
  setTraining,
  schedules,
  id,
  isMobile,
  isPresentiel,
  isInterSession,
  formatDateWithSchedule,
  navigate,
  toast,
  setMapDialogOpen,
  setDuplicateDialogOpen,
  requiredEquipment,
}: Props) => {
  const { trackFeature } = useFeatureTracking();
  const { copy } = useCopyToClipboard();
  const { isDemoMode } = useDemoMode();
  const isIntra = training.session_type === "intra" || training.format_formation === "intra";

  const isOnline = training.location?.toLowerCase().includes("visio") ||
    training.location?.toLowerCase().includes("en ligne") ||
    training.location?.toLowerCase().includes("distanciel");

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const startRename = () => {
    setRenameValue(training.training_name);
    setRenaming(true);
  };

  const commitRename = async () => {
    const trimmed = renameValue.trim();
    setRenaming(false);
    if (!trimmed || trimmed === training.training_name) return;
    const { error } = await supabase
      .from("trainings")
      .update({ training_name: trimmed })
      .eq("id", training.id);
    if (!error) {
      setTraining({ ...training, training_name: trimmed });
      toast({ title: "Formation renommée" });
    } else {
      toastError(toast, "Erreur lors du renommage.");
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmText !== "SUPPRIMER") return;
    setDeleting(true);
    try {
      trackFeature("delete_training", "formations", { training_id: training.id });
      await deleteTraining(training.id);
      toast({ title: "Formation supprimée" });
      navigate("/formations");
    } catch {
      toastError(toast, "Erreur lors de la suppression.");
    } finally {
      setDeleting(false);
    }
  };

  const TRAINING_CANCELLATION_REASONS = [
    { value: "manque_participants", label: "Pas assez de participants" },
    { value: "report", label: "Reportée" },
    { value: "client_annulation", label: "Annulation client" },
    { value: "formateur_indisponible", label: "Formateur indisponible" },
    { value: "autre", label: "Autre" },
  ];

  const handleCancel = async () => {
    if (!cancellationReason) return;
    trackFeature("cancel_training", "formations", { training_id: training.id, reason: cancellationReason });
    const { error } = await supabase
      .from("trainings")
      .update({
        is_cancelled: true,
        cancellation_reason: cancellationReason,
        cancelled_at: new Date().toISOString(),
      })
      .eq("id", training.id);
    if (!error) {
      setTraining({ ...training, is_cancelled: true, cancellation_reason: cancellationReason, cancelled_at: new Date().toISOString() });
      toast({ title: "Session annulée" });
      setCancelDialogOpen(false);
      setCancellationReason("");
    }
  };

  const handleReactivate = async () => {
    trackFeature("reactivate_training", "formations", { training_id: training.id });
    const { error } = await supabase
      .from("trainings")
      .update({
        is_cancelled: false,
        cancellation_reason: null,
        cancelled_at: null,
      })
      .eq("id", training.id);
    if (!error) {
      setTraining({ ...training, is_cancelled: false, cancellation_reason: null, cancelled_at: null });
      toast({ title: "Session réactivée" });
    }
  };

  return (
    <div className="mb-4 md:mb-6 space-y-3">
      {/* Cancelled banner */}
      {training.is_cancelled && (
        <div className="flex items-center justify-between gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-destructive flex-shrink-0" />
            <div>
              <p className="font-medium text-destructive">Session annulée</p>
              {training.cancellation_reason && (
                <p className="text-sm text-destructive/80">
                  Raison : {TRAINING_CANCELLATION_REASONS.find((r) => r.value === training.cancellation_reason)?.label || training.cancellation_reason}
                </p>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleReactivate}>
            <RotateCcw className="h-4 w-4 mr-1" />
            Réactiver
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => {
          // Preserve the tab the user came from via URL search params
          const params = new URLSearchParams(window.location.search);
          const tab = params.get("tab");
          navigate(tab ? `/formations?tab=${tab}` : "/formations");
        }}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            {renaming ? (
              <input
                className="text-lg md:text-2xl font-bold bg-transparent border-b-2 border-primary outline-none w-full"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                  if (e.key === "Escape") setRenaming(false);
                }}
                autoFocus
              />
            ) : (
              <>
                <h1 className={`text-lg md:text-2xl font-bold truncate ${training.is_cancelled ? "line-through text-muted-foreground" : ""}`}>
                  {isDemoMode && isIntra ? maskText(training.training_name) : training.training_name}
                </h1>
                {!isDemoMode && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground" onClick={startRename} title="Renommer">
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
            {training.is_cancelled && <Badge variant="destructive">Annulée</Badge>}
          </div>
          <p className="text-xs md:text-sm text-muted-foreground truncate">
            {formatDateWithSchedule(training.start_date, training.end_date, schedules)}
          </p>
        </div>
      </div>

      {isMobile ? (
        <div className="flex items-center gap-1 shrink-0">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => window.open(`${window.location.origin}/formation-info/${id}`, "_blank")}>
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigate(`/formations/${id}/edit`)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isPresentiel && !isOnline && (
                <DropdownMenuItem onClick={() => setMapDialogOpen(true)}>
                  <Map className="h-4 w-4 mr-2" />Carte
                </DropdownMenuItem>
              )}
              {isPresentiel && (
                <DropdownMenuItem onClick={() => { if (!training.train_booked) openExternalLink(`https://www.trainline.fr/search/${encodeURIComponent(training.location)}`); }} disabled={training.train_booked}>
                  <Train className="h-4 w-4 mr-2" />Train {training.train_booked && "✓"}
                </DropdownMenuItem>
              )}
              {isPresentiel && (
                <DropdownMenuItem onClick={() => { if (!training.hotel_booked) openExternalLink(`https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(training.location)}`); }} disabled={training.hotel_booked}>
                  <Hotel className="h-4 w-4 mr-2" />Hôtel {training.hotel_booked && "✓"}
                </DropdownMenuItem>
              )}
              {isPresentiel && isInterSession && (
                <DropdownMenuItem onClick={() => { if (!training.restaurant_booked) openExternalLink(getGoogleMapsNearbyUrl("restaurants", training.location)); }} disabled={training.restaurant_booked}>
                  <UtensilsCrossed className="h-4 w-4 mr-2" />Restaurant {training.restaurant_booked && "✓"}
                </DropdownMenuItem>
              )}
              {isPresentiel && (isInterSession || training.session_type === "intra" || training.format_formation === "intra") && (
                <DropdownMenuItem onClick={() => { if (!training.room_rental_booked) openExternalLink(getGoogleMapsNearbyUrl("location+salle+reunion", training.location)); }} disabled={training.room_rental_booked}>
                  <DoorOpen className="h-4 w-4 mr-2" />Salle {training.room_rental_booked && "✓"}
                </DropdownMenuItem>
              )}
              {requiredEquipment && (
                <DropdownMenuItem onClick={async () => {
                  const newValue = !training.equipment_ready;
                  const { error } = await supabase.from("trainings").update({ equipment_ready: newValue }).eq("id", training.id);
                  if (!error) {
                    setTraining({ ...training, equipment_ready: newValue });
                    toast({ title: newValue ? "Matériel prêt ✓" : "Matériel non prêt" });
                  }
                }}>
                  <Package className="h-4 w-4 mr-2" />Matériel {training.equipment_ready && "✓"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => { trackFeature("copy_participant_link", "formations", { training_id: id }); copy(`${window.location.origin}/formation-info/${id}`, { title: "Lien copié", description: "Le lien vers la page participant a été copié." }); }}>
                <Copy className="h-4 w-4 mr-2" />Copier lien participant
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { trackFeature("duplicate_training", "formations", { training_id: id }); setDuplicateDialogOpen(true); }}>
                <Copy className="h-4 w-4 mr-2" />Dupliquer
              </DropdownMenuItem>
              {isInterSession && !training.is_cancelled && (
                <DropdownMenuItem onClick={() => setCancelDialogOpen(true)} className="text-orange-600">
                  <Ban className="h-4 w-4 mr-2" />Annuler la session
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setDeleteDialogOpen(true)} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          {isPresentiel && (
            <Button variant="outline" size="sm" onClick={() => setMapDialogOpen(true)} disabled={isOnline} title={isOnline ? "Non disponible pour les formations en ligne" : "Voir la carte"}>
              <Map className="h-4 w-4 mr-2" />Carte
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => window.open(`${window.location.origin}/formation-info/${id}`, "_blank")}>
            <ExternalLink className="h-4 w-4 mr-2" />Page participant
          </Button>
          <Button variant="outline" onClick={() => navigate(`/formations/${id}/edit`)}>
            <Edit2 className="h-4 w-4 mr-2" />Modifier
          </Button>
          <Button variant="outline" onClick={() => setDuplicateDialogOpen(true)}>
            <Copy className="h-4 w-4 mr-2" />Dupliquer
          </Button>
          {isInterSession && !training.is_cancelled && (
            <Button variant="outline" className="text-orange-600 hover:text-orange-600" onClick={() => setCancelDialogOpen(true)}>
              <Ban className="h-4 w-4 mr-1" />
              Annuler
            </Button>
          )}
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={() => setDeleteDialogOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" />
            Supprimer
          </Button>
        </div>
      )}
      </div>

      {/* Cancel dialog (shared mobile/desktop) */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Annuler cette session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Raison de l'annulation *</Label>
              <Select value={cancellationReason} onValueChange={setCancellationReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une raison..." />
                </SelectTrigger>
                <SelectContent>
                  {TRAINING_CANCELLATION_REASONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
                Retour
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={!cancellationReason}
              >
                Confirmer l'annulation
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => { setDeleteDialogOpen(open); if (!open) setDeleteConfirmText(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Supprimer cette formation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cette action est <strong>irréversible</strong>. Toutes les données associées seront supprimées (participants, signatures, évaluations, documents, etc.).
            </p>
            <div className="space-y-2">
              <Label>Tapez <strong>SUPPRIMER</strong> pour confirmer</Label>
              <Input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="SUPPRIMER"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Retour
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteConfirmText !== "SUPPRIMER" || deleting}
              >
                {deleting ? "Suppression..." : "Supprimer définitivement"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FormationDetailHeader;
