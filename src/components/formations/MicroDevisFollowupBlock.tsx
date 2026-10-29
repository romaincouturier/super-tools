import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";
import {
  averageHourlyPrice, followupAmount, totalHours, type MicroDevisFollowup,
} from "../../../supabase/functions/_shared/micro-devis-followup";

interface Props {
  value: MicroDevisFollowup;
  onChange: (v: MicroDevisFollowup) => void;
  includedSessions: number;
  baseHours: number;
  unitPrice: number;
  alertThreshold: number;
}

const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const h = (n: number) => `${String(n).replace(".", ",")} h`;

export default function MicroDevisFollowupBlock({ value, onChange, includedSessions, baseHours, unitPrice, alertThreshold }: Props) {
  const avg = averageHourlyPrice(unitPrice, baseHours, value);
  const amount = followupAmount(value);
  return (
    <div className="space-y-3 rounded-md border p-3 bg-background">
      <p className="font-medium">Suivi pédagogique individuel</p>
      <p className="text-sm text-muted-foreground">
        Compris dans la formule : {includedSessions > 0 ? `${includedSessions} séance(s) × 1 h = ${h(includedSessions)}` : "aucune séance"}
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label htmlFor="fu-sessions" className="text-xs text-muted-foreground">Séances ajoutées (1 h)</Label>
          <Input id="fu-sessions" type="number" min={0} step={1} value={value.addedSessions || ""} placeholder="0"
            onChange={(e) => onChange({ ...value, addedSessions: Math.max(0, parseInt(e.target.value) || 0) })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fu-rate" className="text-xs text-muted-foreground">Tarif horaire HT</Label>
          <Input id="fu-rate" type="number" min={0} step="any" value={value.hourlyRate}
            onChange={(e) => onChange({ ...value, hourlyRate: Math.max(0, parseFloat(e.target.value) || 0) })} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Montant ajouté / participant</Label>
          <p className="h-10 flex items-center font-medium">{fmt(amount)}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox id="fu-single" checked={value.singleLine} onCheckedChange={(c) => onChange({ ...value, singleLine: c === true })} />
        <Label htmlFor="fu-single" className="font-normal cursor-pointer">Afficher sur une seule ligne</Label>
      </div>
      <p className="text-sm">
        Durée du devis : <strong>{h(totalHours(baseHours, value))}</strong>
        {avg !== null && <> · Prix moyen : <strong>{fmt(avg)} HT/h</strong> <span className="text-muted-foreground">(non affiché sur le devis)</span></>}
      </p>
      {avg !== null && avg > alertThreshold && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>Prix moyen supérieur au seuil de {fmt(alertThreshold)} HT/h.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
