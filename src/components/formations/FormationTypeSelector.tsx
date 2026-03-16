import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface FormationTypeSelectorProps {
  formatFormation: "intra" | "inter" | "";
  setFormatFormation: (v: "intra" | "inter" | "") => void;
}

export default function FormationTypeSelector({
  formatFormation,
  setFormatFormation,
}: FormationTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <Label>Type de formation *</Label>
      <RadioGroup value={formatFormation} onValueChange={(v) => setFormatFormation(v as "intra" | "inter")} className="flex gap-6">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="intra" id="format-intra" />
          <Label htmlFor="format-intra" className="font-normal cursor-pointer">
            Intra-entreprise
            <span className="text-xs text-muted-foreground ml-1">(formation sur-mesure)</span>
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="inter" id="format-inter" />
          <Label htmlFor="format-inter" className="font-normal cursor-pointer">
            Inter-entreprises
            <span className="text-xs text-muted-foreground ml-1">(catalogue)</span>
          </Label>
        </div>
      </RadioGroup>
    </div>
  );
}
