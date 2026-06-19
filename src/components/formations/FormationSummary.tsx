import type { FormationConfig } from "@/types/formations";
import type { FormationFormula } from "@/types/training";

interface FormationSummaryProps {
  formationDemandee: string;
  participants: string;
  typeSubrogation?: "sans" | "avec" | "les2";
  offrirFraisAdmin?: boolean;
  getSelectedFormationConfig: () => FormationConfig | undefined;
  formationFormulas: FormationFormula[];
  selectedFormulaId: string;
  countParticipants: () => number;
}

export default function FormationSummary({
  formationDemandee,
  participants,
  typeSubrogation,
  offrirFraisAdmin,
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
  const showBoth = typeSubrogation === "les2";
  const showAvec = typeSubrogation === "avec" || showBoth;
  const showSans = typeSubrogation === "sans" || showBoth;
  const renderColumn = (variant: "sans" | "avec") => {
    const withSub = variant === "avec";
    const baseFrais = withSub ? 350 : 150;
    const remise = offrirFraisAdmin ? 150 : 0;
    const frais = baseFrais - remise;
    const totalHT = prixFormation + frais;
    const totalTTC = totalHT;
    return (
      <div className="text-sm space-y-1">
        {showBoth && (
          <p className="font-semibold mb-1">
            {withSub ? "Avec subrogation" : "Sans subrogation"}
          </p>
        )}
        <p>Formation : {prixUnitaire}€ × {nbParticipants} = <strong>{prixFormation}€</strong></p>
        {baseFrais > 0 && <p>Frais de dossier : {baseFrais}€{remise > 0 && <span className="text-muted-foreground"> − {remise}€ offerts = <strong>{frais}€</strong></span>}</p>}
        <p>Total HT : <strong>{totalHT}€</strong></p>
        <p>TVA (0%) : Exonéré</p>
        <p className="text-base">Total TTC : <strong>{totalTTC.toFixed(2)}€</strong></p>
      </div>
    );
  };

  return (
    <div className="mt-4 p-3 bg-background rounded border" key={`summary-${formationDemandee}-${participants}-${typeSubrogation}`}>
      <h4 className="font-medium text-sm mb-2">Résumé du devis</h4>
      <div className={showBoth ? "grid grid-cols-1 md:grid-cols-2 gap-4" : ""}>
        {showSans && renderColumn("sans")}
        {showAvec && renderColumn("avec")}
      </div>
    </div>
  );
}
