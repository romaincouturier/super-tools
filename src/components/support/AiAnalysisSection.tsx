import { useState } from "react";
import { Sparkles, Pencil, Trash2, RefreshCw, Check, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { TicketAiAnalysis, BugAnalysis, EvolutionAnalysis } from "@/types/support";

interface Props {
  analysis: TicketAiAnalysis;
  onUpdate?: (analysis: TicketAiAnalysis) => void;
  onDelete?: () => void;
  onReanalyze?: () => void;
  reanalyzing?: boolean;
}

interface FieldDef {
  key: string;
  label: string;
}

const BUG_FIELDS: FieldDef[] = [
  { key: "constat", label: "Constat" },
  { key: "reproduction", label: "Procédure de reproduction" },
  { key: "situation_desiree", label: "Situation désirée" },
  { key: "procedure_test", label: "Procédure de test" },
];

const EVO_FIELDS: FieldDef[] = [
  { key: "user_stories", label: "User stories" },
  { key: "criteres_acceptation", label: "Critères d'acceptation" },
  { key: "impact_produit", label: "Impact produit" },
];

export default function AiAnalysisSection({ analysis, onUpdate, onDelete, onReanalyze, reanalyzing }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});

  const isBug = analysis.type === "bug";
  const fields = isBug ? BUG_FIELDS : EVO_FIELDS;
  const colorClass = isBug ? "border-red-200 bg-red-50/30" : "border-violet-200 bg-violet-50/30";
  const typeLabel = isBug ? "Bug" : "Évolution";

  const startEditing = () => {
    const initial: Record<string, string> = {};
    for (const f of fields) {
      initial[f.key] = (analysis as unknown as Record<string, string>)[f.key] || "";
    }
    setDraft(initial);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setDraft({});
  };

  const saveEditing = () => {
    if (!onUpdate) return;
    const updated = { ...analysis, ...draft } as TicketAiAnalysis;
    onUpdate(updated);
    setEditing(false);
    setDraft({});
  };

  return (
    <Card className={colorClass}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Analyse IA — {typeLabel}
          </CardTitle>
          <div className="flex items-center gap-1">
            {editing ? (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={saveEditing} title="Valider">
                  <Check className="h-3.5 w-3.5 text-green-600" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={cancelEditing} title="Annuler">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <>
                {onUpdate && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={startEditing} title="Modifier l'analyse">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                )}
                {onReanalyze && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onReanalyze} disabled={reanalyzing} title="Relancer l'analyse IA">
                    {reanalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  </Button>
                )}
                {onDelete && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete} title="Supprimer l'analyse">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {fields.map((f) => (
          <div key={f.key}>
            <Label className="text-xs text-muted-foreground font-semibold">{f.label}</Label>
            {editing ? (
              <Textarea
                value={draft[f.key] || ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, [f.key]: e.target.value }))}
                className="mt-1 text-sm"
                rows={3}
              />
            ) : (
              <p className="whitespace-pre-wrap mt-0.5">
                {(analysis as unknown as Record<string, string>)[f.key] || "—"}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
