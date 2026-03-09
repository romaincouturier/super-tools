import { ArrowLeft, ExternalLink, Edit2, Map, Train, Hotel, UtensilsCrossed, DoorOpen, Copy, MoreHorizontal, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import LogisticsBookingButtons from "@/components/shared/LogisticsBookingButtons";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import type { Training, Schedule } from "@/hooks/useFormationDetail";

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
}: Props) => {
  const isOnline = training.location?.toLowerCase().includes("visio") ||
    training.location?.toLowerCase().includes("en ligne") ||
    training.location?.toLowerCase().includes("distanciel");

  return (
    <div className="flex items-center justify-between mb-4 md:mb-6 gap-2">
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/formations")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0">
          <h1 className="text-lg md:text-2xl font-bold truncate">{training.training_name}</h1>
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
                <DropdownMenuItem onClick={() => { if (!training.train_booked) window.open(`https://www.trainline.fr/search/${encodeURIComponent(training.location)}`, "_blank"); }} disabled={training.train_booked}>
                  <Train className="h-4 w-4 mr-2" />Train {training.train_booked && "✓"}
                </DropdownMenuItem>
              )}
              {isPresentiel && (
                <DropdownMenuItem onClick={() => { if (!training.hotel_booked) window.open(`https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(training.location)}`, "_blank"); }} disabled={training.hotel_booked}>
                  <Hotel className="h-4 w-4 mr-2" />Hôtel {training.hotel_booked && "✓"}
                </DropdownMenuItem>
              )}
              {isPresentiel && isInterSession && (
                <DropdownMenuItem onClick={() => { if (!training.restaurant_booked) window.open(`https://www.google.com/maps/search/restaurants+near+${encodeURIComponent(training.location)}`, "_blank"); }} disabled={training.restaurant_booked}>
                  <UtensilsCrossed className="h-4 w-4 mr-2" />Restaurant {training.restaurant_booked && "✓"}
                </DropdownMenuItem>
              )}
              {isPresentiel && (isInterSession || training.session_type === "intra" || training.format_formation === "intra") && (
                <DropdownMenuItem onClick={() => { if (!training.room_rental_booked) window.open(`https://www.google.com/maps/search/location+salle+reunion+near+${encodeURIComponent(training.location)}`, "_blank"); }} disabled={training.room_rental_booked}>
                  <DoorOpen className="h-4 w-4 mr-2" />Salle {training.room_rental_booked && "✓"}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/formation-info/${id}`); toast({ title: "Lien copié", description: "Le lien vers la page participant a été copié." }); }}>
                <Copy className="h-4 w-4 mr-2" />Copier lien participant
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setDuplicateDialogOpen(true)}>
                <Copy className="h-4 w-4 mr-2" />Dupliquer
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
                  <a href={`https://www.google.com/maps/search/restaurants+near+${encodeURIComponent(training.location)}`} target="_blank" rel="noopener noreferrer">
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
                  <a href={`https://www.google.com/maps/search/location+salle+reunion+near+${encodeURIComponent(training.location)}`} target="_blank" rel="noopener noreferrer">
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
          <Button variant="outline" size="sm" onClick={() => window.open(`${window.location.origin}/formation-info/${id}`, "_blank")}>
            <ExternalLink className="h-4 w-4 mr-2" />Page participant
          </Button>
          <Button variant="outline" onClick={() => navigate(`/formations/${id}/edit`)}>
            <Edit2 className="h-4 w-4 mr-2" />Modifier
          </Button>
          <Button variant="outline" onClick={() => setDuplicateDialogOpen(true)}>
            <Copy className="h-4 w-4 mr-2" />Dupliquer
          </Button>
        </div>
      )}
    </div>
  );
};

export default FormationDetailHeader;
