import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { FormationFormula } from "@/types/training";

interface Props {
  trainingId: string;
  isPermanent: boolean;
  availableFormulas: FormationFormula[];
}

type ConflictMap = Record<string, { otherTrainingName: string; otherIsPermanent: boolean }>;

export default function TrainingFormulasManager({ trainingId, isPermanent, availableFormulas }: Props) {
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictMap>({});
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const formulaIds = availableFormulas.map((f) => f.id);
      const [{ data: links }, { data: otherLinks }] = await Promise.all([
        (supabase as any).from("training_formulas").select("formula_id").eq("training_id", trainingId),
        formulaIds.length
          ? (supabase as any)
              .from("training_formulas")
              .select("formula_id, training_id, trainings:training_id(training_name, start_date)")
              .in("formula_id", formulaIds)
              .neq("training_id", trainingId)
          : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;
      setLinkedIds(new Set(((links ?? []) as { formula_id: string }[]).map((r) => r.formula_id)));

      // Build conflict map : pour chaque formule, si elle est liée ailleurs à un type opposé
      const conflictMap: ConflictMap = {};
      for (const row of (otherLinks ?? []) as Array<{
        formula_id: string;
        trainings: { training_name: string; start_date: string | null } | null;
      }>) {
        const other = row.trainings;
        if (!other) continue;
        const otherIsPermanent = other.start_date === null;
        if (otherIsPermanent !== isPermanent) {
          conflictMap[row.formula_id] = {
            otherTrainingName: other.training_name,
            otherIsPermanent,
          };
        }
      }
      setConflicts(conflictMap);
      setLoading(false);
    };
    if (trainingId && availableFormulas.length > 0) load();
    else setLoading(false);
    return () => { cancelled = true; };
  }, [trainingId, isPermanent, availableFormulas]);

  const toggle = async (formulaId: string, checked: boolean) => {
    setSavingId(formulaId);
    try {
      if (checked) {
        const { error } = await (supabase as any)
          .from("training_formulas")
          .insert({ training_id: trainingId, formula_id: formulaId });
        if (error) throw error;
        setLinkedIds((prev) => new Set(prev).add(formulaId));
      } else {
        const { error } = await (supabase as any)
          .from("training_formulas")
          .delete()
          .eq("training_id", trainingId)
          .eq("formula_id", formulaId);
        if (error) throw error;
        setLinkedIds((prev) => {
          const n = new Set(prev);
          n.delete(formulaId);
          return n;
        });
      }
    } catch (e: any) {
      toast({
        title: "Impossible de modifier la liaison",
        description: e?.message ?? String(e),
        variant: "destructive",
      });
    } finally {
      setSavingId(null);
    }
  };

  if (availableFormulas.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-base">
          Formules associées à cette session
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {isPermanent
              ? "Session permanente — les formules cochées seront routées ici par défaut."
              : "Session programmée — les achats de ces formules atterriront sur cette cohorte."}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Chargement…
          </div>
        ) : (
          availableFormulas.map((f) => {
            const checked = linkedIds.has(f.id);
            const conflict = conflicts[f.id];
            const disabled = !!conflict && !checked;
            return (
              <div key={f.id} className="flex items-start gap-3 py-1">
                <Checkbox
                  id={`formula-${f.id}`}
                  checked={checked}
                  disabled={disabled || savingId === f.id}
                  onCheckedChange={(v) => toggle(f.id, !!v)}
                />
                <div className="flex-1">
                  <Label htmlFor={`formula-${f.id}`} className="font-medium cursor-pointer">
                    {f.name}
                    {f.prix != null && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">{f.prix} €</span>
                    )}
                    {f.woocommerce_product_id && (
                      <span className="ml-2 text-xs text-muted-foreground font-normal">
                        Woo #{f.woocommerce_product_id}
                      </span>
                    )}
                    {checked && <Check className="inline h-3.5 w-3.5 ml-2 text-primary" />}
                  </Label>
                  {disabled && conflict && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      Déjà liée à une session {conflict.otherIsPermanent ? "permanente" : "programmée"}
                      {" "}({conflict.otherTrainingName}). Détache-la pour pouvoir la cocher ici.
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
