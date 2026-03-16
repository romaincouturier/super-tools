import type { FormationConfig } from "@/types/formations";
import type { FormationFormula } from "@/types/training";

interface FormationSummaryProps {
  formationDemandee: string;
  participants: string;
  fraisDossier: "oui" | "non" | "";
  getSelectedFormationConfig: () => FormationConfig | undefined;
  formationFormulas: FormationFormula[];
  selectedFormulaId: string;
  countParticipants: () => number;
}

export default function FormationSummary({
  formationDemandee,
  participants,
  fraisDossier,
  getSelectedFormationConfig,
  formationFormulas,
  selectedFormulaId,
  countParticipants,
}: FormationSummaryProps) {
  if (!formationDemandee) return null;

  const config = getSelectedFormationConfig();
  if (!config) return null;

  const activeFormula = formationFormulas.find(f => f.id === selectedFormulaId);
  const prixUnitaire = activeFormula?.prix ?? config.prix;
  const nbParticipants = countParticipants();
  const prixFormation = prixUnitaire * nbParticipants;
  const frais = fraisDossier === "oui" ? 150 : 0;
  const totalHT = prixFormation + frais;
  const tva = 0;
  const totalTTC = totalHT + tva;

  return (
    <div className="mt-4 p-3 bg-background rounded border" key={`summary-${formationDemandee}-${participants}-${fraisDossier}`}>
      <h4 className="font-medium text-sm mb-2">Résumé du devis</h4>
      <div className="text-sm space-y-1">
        <p>Formation : {prixUnitaire}€ × {nbParticipants} = <strong>{prixFormation}€</strong></p>
        {frais > 0 && <p>Frais de dossier : {frais}€</p>}
        <p>Total HT : <strong>{totalHT}€</strong></p>
        <p>TVA (0%) : Exonéré</p>
        <p className="text-base">Total TTC : <strong>{totalTTC.toFixed(2)}€</strong></p>
      </div>
    </div>
  );
}
