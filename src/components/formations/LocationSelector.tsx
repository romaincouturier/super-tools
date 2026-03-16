import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LIEUX } from "@/lib/formationConstants";

interface LocationSelectorProps {
  lieu: string;
  setLieu: (v: string) => void;
  lieuAutre: string;
  setLieuAutre: (v: string) => void;
}

export default function LocationSelector({
  lieu,
  setLieu,
  lieuAutre,
  setLieuAutre,
}: LocationSelectorProps) {
  return (
    <div className="space-y-3">
      <Label>Lieu *</Label>
      <RadioGroup value={lieu} onValueChange={setLieu} className="space-y-2">
        {LIEUX.map((l) => (
          <div key={l} className="flex items-center space-x-2">
            <RadioGroupItem value={l} id={`lieu-${l}`} />
            <Label htmlFor={`lieu-${l}`} className="font-normal cursor-pointer text-sm">
              {l}
            </Label>
          </div>
        ))}
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="autre" id="lieu-autre" />
          <Label htmlFor="lieu-autre" className="font-normal cursor-pointer text-sm">Autre :</Label>
          <Input
            placeholder="Adresse personnalisée"
            value={lieuAutre}
            onChange={(e) => {
              setLieuAutre(e.target.value);
              if (e.target.value) setLieu("autre");
            }}
            className="flex-1 max-w-md"
            disabled={lieu !== "autre"}
          />
        </div>
      </RadioGroup>
    </div>
  );
}
