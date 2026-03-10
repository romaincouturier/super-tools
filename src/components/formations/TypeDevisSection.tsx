import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface TypeDevisSectionProps {
  typeDevis: "formation" | "jeu" | "";
  setTypeDevis: (v: "formation" | "jeu" | "") => void;
  isAdministration: "oui" | "non" | "";
  setIsAdministration: (v: "oui" | "non" | "") => void;
  noteDevis: string;
  setNoteDevis: (v: string) => void;
}

export default function TypeDevisSection({
  typeDevis,
  setTypeDevis,
  isAdministration,
  setIsAdministration,
  noteDevis,
  setNoteDevis,
}: TypeDevisSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold border-b pb-2">Type de devis</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-3">
          <Label>S'agit-il d'un devis pour</Label>
          <RadioGroup value={typeDevis} onValueChange={(v) => setTypeDevis(v as "formation" | "jeu")}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="formation" id="type-formation" />
              <Label htmlFor="type-formation" className="font-normal cursor-pointer">Une formation</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="jeu" id="type-jeu" />
              <Label htmlFor="type-jeu" className="font-normal cursor-pointer">Un jeu</Label>
            </div>
          </RadioGroup>
        </div>
        <div className="space-y-3">
          <Label>Le client est une administration *</Label>
          <RadioGroup value={isAdministration} onValueChange={(v) => setIsAdministration(v as "oui" | "non")} className="flex gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="oui" id="admin-oui" />
              <Label htmlFor="admin-oui" className="font-normal cursor-pointer">Oui</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="non" id="admin-non" />
              <Label htmlFor="admin-non" className="font-normal cursor-pointer">Non</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="noteDevis">
          Note à faire figurer impérativement sur le devis
          <span className="text-muted-foreground font-normal text-sm ml-1">(facultatif)</span>
        </Label>
        <Textarea id="noteDevis" placeholder="Notes ou mentions spéciales à inclure dans le devis..." value={noteDevis} onChange={(e) => setNoteDevis(e.target.value)} className="min-h-[80px]" />
      </div>
    </div>
  );
}
