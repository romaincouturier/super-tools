import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { updateTrainingField, type Training } from "@/data/trainings";
import {
  ExternalLink, Edit2, Map, Train, Hotel, UtensilsCrossed,
  DoorOpen, Copy, MoreHorizontal,
} from "lucide-react";

interface BookingItem {
  key: "train_booked" | "hotel_booked" | "restaurant_booked" | "room_rental_booked";
  icon: typeof Train;
  label: string;
  searchUrl: string;
  toastBooked: string;
  toastUnbooked: string;
}

interface FormationBookingActionsProps {
  training: Training;
  id: string;
  isMobile: boolean;
  onTrainingUpdate: (updates: Partial<Training>) => void;
  onMapOpen: () => void;
  onNavigateEdit: () => void;
  onNavigateParticipantPage: () => void;
}

export function FormationBookingActions({
  training,
  id,
  isMobile,
  onTrainingUpdate,
  onMapOpen,
  onNavigateEdit,
  onNavigateParticipantPage,
}: FormationBookingActionsProps) {
  const { toast } = useToast();

  const isOnline =
    training.location?.toLowerCase().includes("visio") ||
    training.location?.toLowerCase().includes("en ligne") ||
    training.location?.toLowerCase().includes("distanciel");

  const isElearning = training.format_formation === "e_learning";

  const bookingItems: BookingItem[] = [
    ...(!isElearning
      ? [
          {
            key: "train_booked" as const,
            icon: Train,
            label: "Train",
            searchUrl: `https://www.trainline.fr/search/${encodeURIComponent(training.location)}`,
            toastBooked: "Train réservé",
            toastUnbooked: "Réservation train annulée",
          },
          {
            key: "hotel_booked" as const,
            icon: Hotel,
            label: "Hôtel",
            searchUrl: `https://www.booking.com/searchresults.fr.html?ss=${encodeURIComponent(training.location)}`,
            toastBooked: "Hôtel réservé",
            toastUnbooked: "Réservation hôtel annulée",
          },
        ]
      : []),
    ...(training.format_formation === "inter-entreprises"
      ? [
          {
            key: "restaurant_booked" as const,
            icon: UtensilsCrossed,
            label: "Restaurant",
            searchUrl: `https://www.google.com/maps/search/restaurants+near+${encodeURIComponent(training.location)}`,
            toastBooked: "Restaurant réservé",
            toastUnbooked: "Réservation restaurant annulée",
          },
        ]
      : []),
    ...((training.format_formation === "inter-entreprises" || training.format_formation === "intra")
      ? [
          {
            key: "room_rental_booked" as const,
            icon: DoorOpen,
            label: "Salle",
            searchUrl: `https://www.google.com/maps/search/location+salle+reunion+near+${encodeURIComponent(training.location)}`,
            toastBooked: "Salle réservée",
            toastUnbooked: "Réservation salle annulée",
          },
        ]
      : []),
  ];

  const handleToggleBooking = async (item: BookingItem) => {
    const currentValue = training[item.key] as boolean;
    const newValue = !currentValue;
    try {
      await updateTrainingField(training.id, { [item.key]: newValue });
      onTrainingUpdate({ [item.key]: newValue });
      toast({
        title: newValue ? item.toastBooked : item.toastUnbooked,
        description: newValue
          ? "La réservation a été marquée comme effectuée."
          : "Le statut de réservation a été réinitialisé.",
      });
    } catch { /* ignore */ }
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/formation-info/${id}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Lien copié",
      description: "Le lien vers la page participant a été copié.",
    });
  };

  if (isMobile) {
    return (
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={onNavigateParticipantPage}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          onClick={onNavigateEdit}
        >
          <Edit2 className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isElearning && !isOnline && (
              <DropdownMenuItem onClick={onMapOpen}>
                <Map className="h-4 w-4 mr-2" />
                Carte
              </DropdownMenuItem>
            )}
            {bookingItems.map((item) => (
              <DropdownMenuItem
                key={item.key}
                onClick={() => {
                  if (!training[item.key]) {
                    window.open(item.searchUrl, "_blank");
                  }
                }}
                disabled={training[item.key] as boolean}
              >
                <item.icon className="h-4 w-4 mr-2" />
                {item.label} {training[item.key] && "\u2713"}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onClick={handleCopyLink}>
              <Copy className="h-4 w-4 mr-2" />
              Copier lien participant
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Map button */}
      {!isElearning && (
        <Button
          variant="outline"
          size="sm"
          onClick={onMapOpen}
          disabled={isOnline}
          title={isOnline ? "Non disponible pour les formations en ligne" : "Voir la carte"}
        >
          <Map className="h-4 w-4 mr-2" />
          Carte
        </Button>
      )}

      {/* Booking buttons */}
      {bookingItems.map((item) => {
        const booked = training[item.key] as boolean;
        return (
          <div key={item.key} className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={booked}
              title={booked ? "Réservation déjà effectuée" : `Réserver ${item.label.toLowerCase()}`}
              asChild={!booked}
            >
              {booked ? (
                <span className="flex items-center">
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.label}
                </span>
              ) : (
                <a href={item.searchUrl} target="_blank" rel="noopener noreferrer">
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.label}
                </a>
              )}
            </Button>
            <Checkbox
              checked={booked}
              onCheckedChange={() => handleToggleBooking(item)}
              className="ml-1"
              title="Marquer la réservation comme effectuée"
            />
          </div>
        );
      })}

      <Button variant="outline" size="sm" onClick={onNavigateParticipantPage}>
        <ExternalLink className="h-4 w-4 mr-2" />
        Page participant
      </Button>
      <Button variant="outline" onClick={onNavigateEdit}>
        <Edit2 className="h-4 w-4 mr-2" />
        Modifier
      </Button>
    </div>
  );
}
