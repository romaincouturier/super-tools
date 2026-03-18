import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ParticipantInputProps {
  participants: string;
  setParticipants: (v: string) => void;
  prenomCommanditaire: string;
  nomCommanditaire: string;
  emailCommanditaire: string;
  countParticipants: () => number;
}

export default function ParticipantInput({
  participants,
  setParticipants,
  prenomCommanditaire,
  nomCommanditaire,
  emailCommanditaire,
  countParticipants,
}: ParticipantInputProps) {
  const handleAddCommanditaire = () => {
    const commanditaireEntry = [prenomCommanditaire, nomCommanditaire, emailCommanditaire].filter(Boolean).join(" ");
    if (participants.trim()) {
      if (!participants.includes(emailCommanditaire)) {
        setParticipants(participants + "\n" + commanditaireEntry);
      }
    } else {
      setParticipants(commanditaireEntry);
    }
  };

  const canAdd = (prenomCommanditaire || nomCommanditaire) && emailCommanditaire;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="participants">
          Liste des participants
          <span className="text-muted-foreground font-normal text-sm ml-1">(Prénom Nom e-mail ;,)</span>
        </Label>
        {canAdd && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleAddCommanditaire}
          >
            <Plus className="w-3 h-3 mr-1" />
            Ajouter le commanditaire
          </Button>
        )}
      </div>
      <Textarea
        id="participants"
        placeholder="Jean Dupont jean@exemple.com, Marie Martin marie@exemple.com"
        value={participants}
        onChange={(e) => setParticipants(e.target.value)}
        className="min-h-[100px] font-mono text-sm"
      />
      {participants && (
        <p className="text-sm text-muted-foreground">
          {countParticipants()} participant(s) détecté(s)
        </p>
      )}
    </div>
  );
}
