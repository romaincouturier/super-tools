import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { FormationFormula } from "@/types/training";
import type { FormationConfig } from "@/types/formations";

export function useFormationFormulas(formationDemandee: string, formationConfigs: FormationConfig[]) {
  const [formationFormulas, setFormationFormulas] = useState<FormationFormula[]>([]);
  const [selectedFormulaId, setSelectedFormulaId] = useState<string>("");

  const activeFormula = formationFormulas.find(f => f.id === selectedFormulaId);
  const selectedFormula = activeFormula?.name || "";

  // Load formulas for selected formation
  useEffect(() => {
    const loadFormulas = async () => {
      const selectedConfig = formationConfigs.find(f => f.formation_name === formationDemandee);
      if (!selectedConfig) {
        setFormationFormulas([]);
        setSelectedFormulaId("");
        return;
      }
      const { data } = await supabase
        .from("formation_formulas")
        .select("*")
        .eq("formation_config_id", selectedConfig.id)
        .order("display_order");
      const formulas = (data as FormationFormula[]) || [];
      setFormationFormulas(formulas);
      setSelectedFormulaId(formulas.length === 1 ? formulas[0].id : "");
    };
    loadFormulas();
  }, [formationDemandee, formationConfigs]);

  return {
    formationFormulas,
    selectedFormulaId,
    setSelectedFormulaId,
    activeFormula,
    selectedFormula,
  };
}
