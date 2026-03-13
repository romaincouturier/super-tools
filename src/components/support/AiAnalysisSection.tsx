import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { TicketAiAnalysis, BugAnalysis, EvolutionAnalysis } from "@/types/support";

interface Props {
  analysis: TicketAiAnalysis;
}

export default function AiAnalysisSection({ analysis }: Props) {
  if (analysis.type === "bug") {
    const bug = analysis as BugAnalysis;
    return (
      <Card className="border-red-200 bg-red-50/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Analyse IA — Bug
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <Label className="text-xs text-muted-foreground font-semibold">Constat</Label>
            <p className="whitespace-pre-wrap mt-0.5">{bug.constat}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground font-semibold">Procédure de reproduction</Label>
            <p className="whitespace-pre-wrap mt-0.5">{bug.reproduction}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground font-semibold">Situation désirée</Label>
            <p className="whitespace-pre-wrap mt-0.5">{bug.situation_desiree}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground font-semibold">Procédure de test</Label>
            <p className="whitespace-pre-wrap mt-0.5">{bug.procedure_test}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const evo = analysis as EvolutionAnalysis;
  return (
    <Card className="border-violet-200 bg-violet-50/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Analyse IA — Évolution
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <Label className="text-xs text-muted-foreground font-semibold">User stories</Label>
          <p className="whitespace-pre-wrap mt-0.5">{evo.user_stories}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground font-semibold">Critères d'acceptation</Label>
          <p className="whitespace-pre-wrap mt-0.5">{evo.criteres_acceptation}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground font-semibold">Impact produit</Label>
          <p className="whitespace-pre-wrap mt-0.5">{evo.impact_produit}</p>
        </div>
      </CardContent>
    </Card>
  );
}
