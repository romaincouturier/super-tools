import { useState } from "react";
import { ArrowLeft, ExternalLink, Edit2, Map, Train, Hotel, UtensilsCrossed, DoorOpen, Copy, MoreHorizontal, Package, Ban, RotateCcw, Trash2 } from "lucide-react";
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
  DialogTrigger,
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
import LogisticsBookingButtons from "@/components/shared/LogisticsBookingButtons";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { deleteTraining } from "@/services/trainings";
import type { Training, Schedule } from "@/hooks/useFormationDetail";
import { Input } from "@/components/ui/input";
import { getGoogleMapsNearbyUrl } from "@/lib/googleMaps";

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
  toast: (opts: any) => void;
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
  const isOnline = training.location?.toLowerCase().includes("visio") ||
    training.location?.toLowerCase().includes("en ligne") ||
    training.location?.toLowerCase().includes("distanciel");

  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (deleteConfirmText !== "SUPPRIMER") return;
    setDeleting(true);
    try {
      await deleteTraining(training.id);
      toast({ title: "Formation supprimée" });
      navigate("/formations");
    } catch {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
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
    const { error } = await supabase
      .from("trainings")
      .update({
        is_cancelled: true,
        cancellation_reason: cancellationReason,
        cancelled_at: new Date().toISOString(),
      } as any)
      .eq("id", training.id);
    if (!error) {
      setTraining({ ...training, is_cancelled: true, cancellation_reason: cancellationReason, cancelled_at: new Date().toISOString() });
      toast({ title: "Session annulée" });
      setCancelDialogOpen(false);
      setCancellationReason("");
    }
  };

  const handleReactivate = async () => {
    const { error } = await supabase
      .from("trainings")
      .update({
        is_cancelled: false,
        cancellation_reason: null,
        cancelled_at: null,
      } as any)
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
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/formations")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className={`text-lg md:text-2xl font-bold truncate ${training.is_cancelled ? "line-through text-muted-foreground" : ""}`}>{training.training_name}</h1>
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
                <DropdownMenuItem onClick={() => { if (!training.train_booked) { const a = document.createElement("a"); a.href = `https://www.trainline.fr/search/${encodeURIComponent(training.location)}`; a.target = "_blank"; a.rel = "noopener"; a.click(); } }} disabled={training.train_booked}>
                  <Train className="h-4 w-4 mr-2" />Train {training.train_booked && "✓"}
                </DropdownMenuItem>
              )}
              {isPresentiel && (
                <DropdownMenuItem onClick={() => { if (!training.hotel_booked) { const a = document.createElement("a"); a.href = `https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(training.location)}`; a.target = "_blank"; a.rel = "noopener"; a.click(); } }} disabled={training.hotel_booked}>
                  <Hotel className="h-4 w-4 mr-2" />Hôtel {training.hotel_booked && "✓"}
                </DropdownMenuItem>
              )}
              {isPresentiel && isInterSession && (
                <DropdownMenuItem onClick={() => { if (!training.restaurant_booked) { const a = document.createElement("a"); a.href = getGoogleMapsNearbyUrl("restaurants", training.location); a.target = "_blank"; a.rel = "noopener"; a.click(); } }} disabled={training.restaurant_booked}>
                  <UtensilsCrossed className="h-4 w-4 mr-2" />Restaurant {training.restaurant_booked && "✓"}
                </DropdownMenuItem>
              )}
              {isPresentiel && (isInterSession || training.session_type === "intra" || training.format_formation === "intra") && (
                <DropdownMenuItem onClick={() => { if (!training.room_rental_booked) { const a = document.createElement("a"); a.href = getGoogleMapsNearbyUrl("location+salle+reunion", training.location); a.target = "_blank"; a.rel = "noopener"; a.click(); } }} disabled={training.room_rental_booked}>
                  <DoorOpen className="h-4 w-4 mr-2" />Salle {training.room_rental_booked && "✓"}
                </DropdownMenuItem>
              )}
              {requiredEquipment && (
                <DropdownMenuItem onClick={async () => {
                  const newValue = !training.equipment_ready;
                  const { error } = await supabase.from("trainings").update({ equipment_ready: newValue } as any).eq("id", training.id);
                  if (!error) {
                    setTraining({ ...training, equipment_ready: newValue });
                    toast({ title: newValue ? "Matériel prêt ✓" : "Matériel non prêt" });
                  }
                }}>
                  <Package className="h-4 w-4 mr-2" />Matériel {training.equipment_ready && "✓"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/formation-info/${id}`); toast({ title: "Lien copié", description: "Le lien vers la page participant a été copié." }); }}>
                <Copy className="h-4 w-4 mr-2" />Copier lien participant
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDuplicateDialogOpen(true)}>
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
          {isPresentiel && (
            <LogisticsBookingButtons
              table="trainings"
              entityId={training.id}
              location={training.location}
              trainBooked={training.train_booked}
              hotelBooked={training.hotel_booked}
              onUpdate={(field, value) => setTraining({ ...training, [field]: value })}
            />
          )}
          {isPresentiel && isInterSession && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={training.restaurant_booked} title={training.restaurant_booked ? "Réservation déjà effectuée" : "Réserver un restaurant"} asChild={!training.restaurant_booked}>
                {training.restaurant_booked ? (
                  <span className="flex items-center"><UtensilsCrossed className="h-4 w-4 mr-2" />Restaurant</span>
                ) : (
                  <a href={getGoogleMapsNearbyUrl("restaurants", training.location)} target="_blank" rel="noopener noreferrer">
                    <UtensilsCrossed className="h-4 w-4 mr-2" />Restaurant
                  </a>
                )}
              </Button>
              <Checkbox
                checked={training.restaurant_booked}
                onCheckedChange={async (checked) => {
                  const newValue = checked === true;
                  const { error } = await supabase.from("trainings").update({ restaurant_booked: newValue }).eq("id", training.id);
                  if (!error) {
                    setTraining({ ...training, restaurant_booked: newValue });
                    toast({ title: newValue ? "Restaurant réservé" : "Réservation restaurant annulée", description: newValue ? "La réservation restaurant a été marquée comme effectuée." : "Le statut de réservation a été réinitialisé." });
                  }
                }}
                className="ml-1"
                title="Marquer la réservation comme effectuée"
              />
            </div>
          )}
          {isPresentiel && (isInterSession || training.session_type === "intra" || training.format_formation === "intra") && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" disabled={training.room_rental_booked} title={training.room_rental_booked ? "Location déjà effectuée" : "Rechercher une salle"} asChild={!training.room_rental_booked}>
                {training.room_rental_booked ? (
                  <span className="flex items-center"><DoorOpen className="h-4 w-4 mr-2" />Salle</span>
                ) : (
                  <a href={getGoogleMapsNearbyUrl("location+salle+reunion", training.location)} target="_blank" rel="noopener noreferrer">
                    <DoorOpen className="h-4 w-4 mr-2" />Salle
                  </a>
                )}
              </Button>
              <Checkbox
                checked={training.room_rental_booked}
                onCheckedChange={async (checked) => {
                  const newValue = checked === true;
                  const { error } = await supabase.from("trainings").update({ room_rental_booked: newValue } as any).eq("id", training.id);
                  if (!error) {
                    setTraining({ ...training, room_rental_booked: newValue });
                    toast({ title: newValue ? "Salle réservée" : "Réservation salle annulée", description: newValue ? "La location de salle a été marquée comme effectuée." : "Le statut de location a été réinitialisé." });
                  }
                }}
                className="ml-1"
                title="Marquer la location comme effectuée"
              />
            </div>
          )}
          {requiredEquipment && (
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={training.equipment_ready}
                title={training.equipment_ready ? "Matériel prêt" : `Matériel requis : ${requiredEquipment}`}
              >
                <Package className="h-4 w-4 mr-2" />Matériel
              </Button>
              <Checkbox
                checked={training.equipment_ready}
                onCheckedChange={async (checked) => {
                  const newValue = checked === true;
                  const { error } = await supabase.from("trainings").update({ equipment_ready: newValue } as any).eq("id", training.id);
                  if (!error) {
                    setTraining({ ...training, equipment_ready: newValue });
                    toast({
                      title: newValue ? "Matériel prêt" : "Matériel non prêt",
                      description: newValue ? `Le matériel requis a été marqué comme prêt.` : "Le statut du matériel a été réinitialisé.",
                    });
                  }
                }}
                className="ml-1"
                title={`Matériel requis : ${requiredEquipment}`}
              />
            </div>
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
