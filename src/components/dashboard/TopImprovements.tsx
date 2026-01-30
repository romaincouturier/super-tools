import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

interface Improvement {
  id: string;
  title: string;
  category: string;
  status: string;
}

interface TopImprovementsProps {
  improvements: Improvement[];
}

const categoryLabels: Record<string, string> = {
  content: "Contenu",
  pedagogy: "Pédagogie",
  logistics: "Logistique",
  materials: "Supports",
  other: "Autre",
};

const TopImprovements = ({ improvements }: TopImprovementsProps) => {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          Top 3 améliorations à suivre
        </CardTitle>
      </CardHeader>
      <CardContent>
        {improvements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune amélioration en attente</p>
        ) : (
          <ul className="space-y-3">
            {improvements.map((improvement, index) => (
              <li key={improvement.id} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-sm font-medium flex items-center justify-center">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{improvement.title}</p>
                  <Badge variant="outline" className="mt-1 text-xs">
                    {categoryLabels[improvement.category] || improvement.category}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default TopImprovements;
