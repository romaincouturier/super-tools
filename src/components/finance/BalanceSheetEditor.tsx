import { useEffect, useState } from "react";
import { Save, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  type BalanceSheetData,
  type BalanceSheetActif,
  type BalanceSheetPassif,
  type CompteResultat,
} from "@/lib/balanceSheetParser";
import { useUpdateBalanceSheetData, type BalanceSheetRow } from "@/hooks/useBalanceSheets";

interface BalanceSheetEditorProps {
  row: BalanceSheetRow;
  onClose: () => void;
}

const ACTIF_LABELS: Record<keyof BalanceSheetActif, string> = {
  immobilisations_incorporelles: "Immobilisations incorporelles",
  immobilisations_corporelles: "Immobilisations corporelles",
  immobilisations_financieres: "Immobilisations financières",
  stocks: "Stocks",
  creances_clients: "Créances clients",
  autres_creances: "Autres créances",
  disponibilites: "Disponibilités",
  valeurs_mobilieres_placement: "Valeurs mobilières de placement",
  total_actif: "TOTAL ACTIF",
};

const PASSIF_LABELS: Record<keyof BalanceSheetPassif, string> = {
  capital_social: "Capital social",
  reserves: "Réserves",
  resultat_exercice: "Résultat de l'exercice",
  capitaux_propres: "Capitaux propres",
  provisions: "Provisions",
  dettes_financieres_long_terme: "Dettes financières long terme",
  dettes_financieres_court_terme: "Dettes financières court terme",
  dettes_fournisseurs_court_terme: "Dettes fournisseurs court terme",
  dettes_fiscales_sociales_court_terme: "Dettes fiscales et sociales CT",
  autres_dettes_court_terme: "Autres dettes court terme",
  total_passif: "TOTAL PASSIF",
};

const CR_LABELS: Record<keyof CompteResultat, string> = {
  chiffre_affaires: "Chiffre d'affaires",
  charges_exploitation: "Charges d'exploitation",
  resultat_exploitation: "Résultat d'exploitation",
  resultat_financier: "Résultat financier",
  resultat_exceptionnel: "Résultat exceptionnel",
  impot_societes: "Impôt sur les sociétés",
  resultat_net: "Résultat net",
};

function NumberRow<K extends string>({
  field,
  label,
  value,
  onChange,
  emphasize,
}: {
  field: K;
  label: string;
  value: number;
  onChange: (v: number) => void;
  emphasize?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 py-1 ${emphasize ? "font-semibold" : ""}`}>
      <Label htmlFor={field} className="text-xs flex-1">
        {label}
      </Label>
      <Input
        id={field}
        type="number"
        step={1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-32 text-right tabular-nums"
      />
    </div>
  );
}

export default function BalanceSheetEditor({ row, onClose }: BalanceSheetEditorProps) {
  const { toast } = useToast();
  const update = useUpdateBalanceSheetData();
  const [data, setData] = useState<BalanceSheetData>(row.data);

  useEffect(() => {
    setData(row.data);
  }, [row.data]);

  const updateActif = (k: keyof BalanceSheetActif, v: number) => {
    setData((d) => ({ ...d, actif: { ...d.actif, [k]: v } }));
  };
  const updatePassif = (k: keyof BalanceSheetPassif, v: number) => {
    setData((d) => ({ ...d, passif: { ...d.passif, [k]: v } }));
  };
  const updateCR = (k: keyof CompteResultat, v: number) => {
    setData((d) => ({ ...d, compte_resultat: { ...d.compte_resultat, [k]: v } }));
  };

  const handleSave = async () => {
    try {
      await update.mutateAsync({ id: row.id, data });
      toast({ title: "Bilan mis à jour" });
      onClose();
    } catch (err) {
      toastError(toast, err);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Corriger les données extraites — {row.annee}</CardTitle>
        <CardDescription>
          Ajuste les valeurs si l'IA s'est trompée. Le total actif doit être égal au total passif.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Actif</h3>
            {(Object.keys(ACTIF_LABELS) as Array<keyof BalanceSheetActif>).map((k) => (
              <NumberRow
                key={k}
                field={k}
                label={ACTIF_LABELS[k]}
                value={data.actif[k]}
                onChange={(v) => updateActif(k, v)}
                emphasize={k === "total_actif"}
              />
            ))}
          </section>
          <section>
            <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">Passif</h3>
            {(Object.keys(PASSIF_LABELS) as Array<keyof BalanceSheetPassif>).map((k) => (
              <NumberRow
                key={k}
                field={k}
                label={PASSIF_LABELS[k]}
                value={data.passif[k]}
                onChange={(v) => updatePassif(k, v)}
                emphasize={k === "total_passif" || k === "capitaux_propres"}
              />
            ))}
          </section>
        </div>
        <section className="mt-6">
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
            Compte de résultat
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {(Object.keys(CR_LABELS) as Array<keyof CompteResultat>).map((k) => (
              <NumberRow
                key={k}
                field={k}
                label={CR_LABELS[k]}
                value={data.compte_resultat[k]}
                onChange={(v) => updateCR(k, v)}
                emphasize={k === "chiffre_affaires" || k === "resultat_net"}
              />
            ))}
          </div>
        </section>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4 mr-1" />
            Fermer
          </Button>
          <Button onClick={handleSave} disabled={update.isPending}>
            {update.isPending ? <Spinner className="mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Enregistrer
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
