import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { REMISE_FRAIS_ADMIN } from "@/lib/devisPricing";
import { Info } from "lucide-react";

interface FormationOptionsProps {
  includeCadeau: boolean;
  setIncludeCadeau: (v: boolean) => void;
  typeSubrogation: "sans" | "avec" | "les2";
  setTypeSubrogation: (v: "sans" | "avec" | "les2") => void;
  remiseFraisAdmin: number;
  setRemiseFraisAdmin: (v: number) => void;
  publicSectorNotice?: string | null;
}

export default function FormationOptions({
  includeCadeau,
  setIncludeCadeau,
  typeSubrogation,
  setTypeSubrogation,
  remiseFraisAdmin,
  setRemiseFraisAdmin,
  publicSectorNotice,
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
        {publicSectorNotice && (
          <div className="flex gap-2 items-start rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
            <span className="text-muted-foreground">{publicSectorNotice}</span>
          </div>
        )}
        <Label>Type de devis à générer * <span className="text-muted-foreground font-normal text-sm">(150€ de frais de dossier sans subrogation, 350€ avec)</span></Label>
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

      <div className="space-y-3">
        <Label htmlFor="remise-frais-admin">Remise sur les frais de dossier</Label>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRemiseFraisAdmin(REMISE_FRAIS_ADMIN)}
          >
            Offrir les frais administratifs (150€)
          </Button>
          <div className="flex items-center gap-2">
            <Input
              id="remise-frais-admin"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
              className="w-28"
              value={remiseFraisAdmin === 0 ? "" : remiseFraisAdmin}
              placeholder="0"
              onChange={(e) => {
                const v = Number.parseFloat(e.target.value);
                setRemiseFraisAdmin(Number.isFinite(v) && v > 0 ? v : 0);
              }}
            />
            <span className="text-sm text-muted-foreground">€ offerts</span>
          </div>
          {remiseFraisAdmin > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setRemiseFraisAdmin(0)}>
              Retirer
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          La remise est plafonnée au montant des frais de dossier (150€ sans subrogation, 350€ avec).
        </p>
      </div>
    </>
  );
}
