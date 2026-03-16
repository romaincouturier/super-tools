import { Clock, CheckCircle, ClipboardCheck, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EvaluationSummaryBarProps {
  evalTotal: number;
  evalSoumis: number;
  evalEnvoye: number;
  avgRating: number;
  participantCount: number;
}

const EvaluationSummaryBar = ({
  evalTotal,
  evalSoumis,
  evalEnvoye,
  avgRating,
  participantCount,
}: EvaluationSummaryBarProps) => {
  if (evalTotal <= 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-3 p-3 bg-muted/50 rounded-lg text-sm">
      <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
      <span className="font-medium">{"\u00c9"}valuations :</span>
      <Badge variant={evalSoumis === participantCount ? "default" : "secondary"} className="gap-1">
        <CheckCircle className="h-3 w-3" />
        {evalSoumis} soumise{evalSoumis !== 1 ? "s" : ""}
      </Badge>
      {evalEnvoye > 0 && (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          {evalEnvoye} en attente
        </Badge>
      )}
      {participantCount - evalTotal > 0 && (
        <span className="text-muted-foreground">
          {participantCount - evalTotal} non envoy{"\u00e9"}e{participantCount - evalTotal !== 1 ? "s" : ""}
        </span>
      )}
      {avgRating > 0 && (
        <span className="flex items-center gap-1 ml-auto">
          <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
          <span className="font-medium">{avgRating.toFixed(1)}/5</span>
        </span>
      )}
    </div>
  );
};

export default EvaluationSummaryBar;
