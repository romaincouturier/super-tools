import { Label } from "@/components/ui/label";
import { VoiceTextarea } from "@/components/ui/voice-textarea";

interface TypeDevisSectionProps {
  noteDevis: string;
  setNoteDevis: (v: string) => void;
}

export default function TypeDevisSection({
  noteDevis,
  setNoteDevis,
}: TypeDevisSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2">Options</h3>
      <div className="space-y-2">
        <Label htmlFor="noteDevis">
          Note à faire figurer impérativement sur le devis
          <span className="text-muted-foreground font-normal text-sm ml-1">(facultatif)</span>
        </Label>
        <VoiceTextarea
          id="noteDevis"
          placeholder="Notes ou mentions spéciales à inclure dans le devis..."
          value={noteDevis}
          onValueChange={setNoteDevis}
          onChange={(e) => setNoteDevis(e.target.value)}
          className="min-h-[80px]"
        />
      </div>
    </div>
  );
}
