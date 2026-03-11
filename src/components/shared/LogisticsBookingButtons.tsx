import { Train, Hotel } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BookingButtonProps {
  icon: React.ReactNode;
  label: string;
  booked: boolean;
  href: string;
  onToggle: (booked: boolean) => void;
  toastBooked: string;
  toastUnbooked: string;
}

const BookingButton = ({ icon, label, booked, href, onToggle, toastBooked, toastUnbooked }: BookingButtonProps) => {
  const { toast } = useToast();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={booked}
        title={booked ? "Réservation déjà effectuée" : `Réserver ${label.toLowerCase()}`}
        asChild={!booked}
      >
        {booked ? (
          <span className="flex items-center">
            {icon}
            {label}
          </span>
        ) : (
          <a href={href} target="_blank" rel="noopener">
            {icon}
            {label}
          </a>
        )}
      </Button>
      <Checkbox
        checked={booked}
        onCheckedChange={(checked) => {
          const newValue = checked === true;
          onToggle(newValue);
          toast({
            title: newValue ? toastBooked : toastUnbooked,
          });
        }}
        className="ml-1"
        title="Marquer la réservation comme effectuée"
      />
    </div>
  );
};

interface LogisticsBookingButtonsProps {
  /** Entity table name (trainings, missions, or events) */
  table: "trainings" | "missions" | "events";
  entityId: string;
  location: string | null | undefined;
  trainBooked: boolean;
  hotelBooked: boolean;
  onUpdate: (field: "train_booked" | "hotel_booked", value: boolean) => void;
  /** Compact mode for drawers/mobile */
  compact?: boolean;
}

const LogisticsBookingButtons = ({
  table,
  entityId,
  location,
  trainBooked,
  hotelBooked,
  onUpdate,
  compact = false,
}: LogisticsBookingButtonsProps) => {
  const encodedLocation = encodeURIComponent(location || "");

  const handleToggle = async (field: "train_booked" | "hotel_booked", value: boolean) => {
    const { error } = await supabase
      .from(table)
      .update({ [field]: value } as any)
      .eq("id", entityId);

    if (!error) {
      onUpdate(field, value);
    }
  };

  if (!location) return null;

  return (
    <div className={compact ? "flex items-center gap-2 flex-wrap" : "flex items-center gap-2 flex-wrap"}>
      <BookingButton
        icon={<Train className="h-4 w-4 mr-2" />}
        label="Train"
        booked={trainBooked}
        href={`https://www.trainline.fr/search/${encodedLocation}`}
        onToggle={(v) => handleToggle("train_booked", v)}
        toastBooked="Train réservé"
        toastUnbooked="Réservation train annulée"
      />
      <BookingButton
        icon={<Hotel className="h-4 w-4 mr-2" />}
        label="Hôtel"
        booked={hotelBooked}
        href={`https://www.booking.com/searchresults.fr.html?ss=${encodedLocation}`}
        onToggle={(v) => handleToggle("hotel_booked", v)}
        toastBooked="Hôtel réservé"
        toastUnbooked="Réservation hôtel annulée"
      />
    </div>
  );
};

export default LogisticsBookingButtons;
