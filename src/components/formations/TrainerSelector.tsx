import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Spinner } from "@/components/ui/spinner";

interface Trainer {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  is_default: boolean;
}

interface TrainerSelectorProps {
  value: string | null;
  onChange: (trainerId: string | null) => void;
  onTrainerSelect?: (trainer: Trainer | null) => void;
}

export default function TrainerSelector({
  value,
  onChange,
  onTrainerSelect,
}: TrainerSelectorProps) {
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrainers();
  }, []);

  const fetchTrainers = async () => {
    try {
      const { data, error } = await supabase
        .from("trainers")
        .select("*")
        .order("is_default", { ascending: false })
        .order("last_name");

      if (error) throw error;

      setTrainers((data || []) as any);

      // Auto-select default trainer if no value set
      if (!value && data && data.length > 0) {
        const defaultTrainer = data.find((t) => t.is_default) || data[0];
        onChange(defaultTrainer.id);
        onTrainerSelect?.(defaultTrainer as any);
      }
    } catch (error) {
      console.error("Error fetching trainers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (trainerId: string) => {
    onChange(trainerId);
    const trainer = trainers.find((t) => t.id === trainerId) || null;
    onTrainerSelect?.(trainer);
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 border rounded-md">
        <Spinner className="text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Chargement...</span>
      </div>
    );
  }

  if (trainers.length === 0) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 border rounded-md text-sm text-muted-foreground">
        Aucun formateur configuré
      </div>
    );
  }

  const selectedTrainer = trainers.find((t) => t.id === value);

  return (
    <Select value={value || undefined} onValueChange={handleChange}>
      <SelectTrigger>
        <SelectValue placeholder="Sélectionner un formateur">
          {selectedTrainer && (
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={selectedTrainer.photo_url || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(
                    selectedTrainer.first_name,
                    selectedTrainer.last_name
                  )}
                </AvatarFallback>
              </Avatar>
              <span>
                {selectedTrainer.first_name} {selectedTrainer.last_name}
              </span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {trainers.map((trainer) => (
          <SelectItem key={trainer.id} value={trainer.id}>
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={trainer.photo_url || undefined} />
                <AvatarFallback className="text-xs">
                  {getInitials(trainer.first_name, trainer.last_name)}
                </AvatarFallback>
              </Avatar>
              <span>
                {trainer.first_name} {trainer.last_name}
              </span>
              {trainer.is_default && (
                <span className="text-xs text-muted-foreground">(défaut)</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
