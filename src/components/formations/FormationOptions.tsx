import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";

interface FormationOptionsProps {
  includeCadeau: boolean;
  setIncludeCadeau: (v: boolean) => void;
  fraisDossier: "oui" | "non" | "";
  setFraisDossier: (v: "oui" | "non" | "") => void;
  typeSubrogation: "sans" | "avec" | "les2";
  setTypeSubrogation: (v: "sans" | "avec" | "les2") => void;
}

export default function FormationOptions({
  includeCadeau,
  setIncludeCadeau,
  fraisDossier,
  setFraisDossier,
  typeSubrogation,
  setTypeSubrogation,
}: FormationOptionsProps) {
  return (
    <>
      <div className="space-y-3">
        <Label>Cadeau <span className="text-muted-foreground font-normal text-sm">(ne pas cocher si non applicable)</span></Label>
        <div className="flex items-start space-x-2">
          <Checkbox
            id="cadeau"
            checked={includeCadeau}
            onCheckedChange={(checked) => setIncludeCadeau(checked === true)}
          />
          <Label htmlFor="cadeau" className="font-normal cursor-pointer text-sm leading-relaxed">
            Chaque participant(e) aura : 1 kit de facilitation graphique ainsi qu'un accès illimité et à vie au e-learning de 25h pour continuer sa formation à la facilitation graphique
          </Label>
        </div>
      </div>

      <div className="space-y-3">
        <Label>Afficher les frais de dossier dans le devis * <span className="text-muted-foreground font-normal text-sm">(Oui pour appliquer 150 euros de frais)</span></Label>
        <RadioGroup value={fraisDossier} onValueChange={(v) => setFraisDossier(v as "oui" | "non")} className="flex gap-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="oui" id="frais-oui" />
            <Label htmlFor="frais-oui" className="font-normal cursor-pointer">Oui</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="non" id="frais-non" />
            <Label htmlFor="frais-non" className="font-normal cursor-pointer">Non</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="space-y-3">
        <Label>Type de devis à générer *</Label>
        <RadioGroup value={typeSubrogation} onValueChange={(v) => setTypeSubrogation(v as "sans" | "avec" | "les2")} className="space-y-2">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="sans" id="subrogation-sans" />
            <Label htmlFor="subrogation-sans" className="font-normal cursor-pointer">Devis sans subrogation de paiement</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="avec" id="subrogation-avec" />
            <Label htmlFor="subrogation-avec" className="font-normal cursor-pointer">Devis avec subrogation de paiement (prise en charge OPCO)</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="les2" id="subrogation-les2" />
            <Label htmlFor="subrogation-les2" className="font-normal cursor-pointer">Les 2</Label>
          </div>
        </RadioGroup>
      </div>
    </>
  );
}
