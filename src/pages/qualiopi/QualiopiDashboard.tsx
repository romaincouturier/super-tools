import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import QualiopiLayout from "@/components/qualiopi/QualiopiLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Award,
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  FileText,
  Calendar,
  TrendingUp,
  ListChecks,
} from "lucide-react";

interface CriterionStats {
  criterion_number: number;
  title: string;
  total_indicators: number;
  compliant: number;
  partial: number;
  non_compliant: number;
  not_evaluated: number;
}

interface AuditInfo {
  id: string;
  audit_type: string;
  audit_date: string;
  status: string;
  next_audit_date: string | null;
}

export default function QualiopiDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [criteriaStats, setCriteriaStats] = useState<CriterionStats[]>([]);
  const [globalStats, setGlobalStats] = useState({
    total: 32,
    compliant: 0,
    partial: 0,
    non_compliant: 0,
    not_evaluated: 0,
  });
  const [nextAudit, setNextAudit] = useState<AuditInfo | null>(null);
  const [documentsCount, setDocumentsCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch indicators with criteria
      const { data: indicators, error } = await supabase
        .from("qualiopi_indicators")
        .select("*, qualiopi_criteria(criterion_number, title)")
        .order("indicator_number");

      if (error) throw error;

      // Calculate stats per criterion
      const statsMap = new Map<number, CriterionStats>();

      if (indicators && indicators.length > 0) {
        indicators.forEach((ind) => {
          const criterionNum = ind.qualiopi_criteria?.criterion_number || 0;
          const criterionTitle = ind.qualiopi_criteria?.title || "";

          if (!statsMap.has(criterionNum)) {
            statsMap.set(criterionNum, {
              criterion_number: criterionNum,
              title: criterionTitle,
              total_indicators: 0,
              compliant: 0,
              partial: 0,
              non_compliant: 0,
              not_evaluated: 0,
            });
          }

          const stat = statsMap.get(criterionNum)!;
          stat.total_indicators++;

          switch (ind.compliance_status) {
            case "compliant":
              stat.compliant++;
              break;
            case "partial":
              stat.partial++;
              break;
            case "non_compliant":
              stat.non_compliant++;
              break;
            default:
              stat.not_evaluated++;
          }
        });

        const statsArray = Array.from(statsMap.values()).sort(
          (a, b) => a.criterion_number - b.criterion_number
        );
        setCriteriaStats(statsArray);

        // Calculate global stats
        const global = {
          total: indicators.length,
          compliant: indicators.filter((i) => i.compliance_status === "compliant").length,
          partial: indicators.filter((i) => i.compliance_status === "partial").length,
          non_compliant: indicators.filter((i) => i.compliance_status === "non_compliant").length,
          not_evaluated: indicators.filter(
            (i) => i.compliance_status === "not_evaluated" || !i.compliance_status
          ).length,
        };
        setGlobalStats(global);
      }

      // Fetch next audit
      const { data: audits } = await supabase
        .from("qualiopi_audits")
        .select("*")
        .or("status.eq.planned,next_audit_date.not.is.null")
        .order("audit_date", { ascending: true })
        .limit(1);

      if (audits && audits.length > 0) {
        setNextAudit(audits[0]);
      }

      // Fetch documents count
      const { count } = await supabase
        .from("qualiopi_documents")
        .select("*", { count: "exact", head: true });

      setDocumentsCount(count || 0);
    } catch (error) {
      console.error("Error fetching Qualiopi data:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCompliancePercentage = () => {
    if (globalStats.total === 0) return 0;
    return Math.round(
      ((globalStats.compliant + globalStats.partial * 0.5) / globalStats.total) * 100
    );
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "compliant":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "partial":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "non_compliant":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <HelpCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getCriterionProgress = (stat: CriterionStats) => {
    if (stat.total_indicators === 0) return 0;
    return Math.round(
      ((stat.compliant + stat.partial * 0.5) / stat.total_indicators) * 100
    );
  };

  if (loading) {
    return (
      <QualiopiLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </QualiopiLayout>
    );
  }

  return (
    <QualiopiLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Tableau de bord Qualiopi</h1>
          <p className="text-muted-foreground">
            Suivez votre conformite a la certification Qualiopi
          </p>
        </div>

        {/* Global Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-full">
                  <ListChecks className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{globalStats.total}</p>
                  <p className="text-xs text-muted-foreground">Indicateurs</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-full">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{globalStats.compliant}</p>
                  <p className="text-xs text-muted-foreground">Conformes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-full">
                  <AlertTriangle className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{globalStats.partial}</p>
                  <p className="text-xs text-muted-foreground">Partiels</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-full">
                  <XCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{globalStats.non_compliant}</p>
                  <p className="text-xs text-muted-foreground">Non conformes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-full">
                  <HelpCircle className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{globalStats.not_evaluated}</p>
                  <p className="text-xs text-muted-foreground">A evaluer</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Global Progress */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Progression globale vers la certification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Conformite globale
                </span>
                <span className="text-2xl font-bold">
                  {getCompliancePercentage()}%
                </span>
              </div>
              <Progress value={getCompliancePercentage()} className="h-3" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>
                  {globalStats.compliant} conformes + {globalStats.partial} partiels
                </span>
                <span>sur {globalStats.total} indicateurs</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Criteria Progress */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Progression par critere</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {criteriaStats.length === 0 ? (
                  <div className="text-center py-8">
                    <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Aucun critere initialise. Initialisez les criteres Qualiopi
                      pour votre organisation.
                    </p>
                    <Button onClick={() => navigate("/qualiopi/criteria")}>
                      Initialiser les criteres
                    </Button>
                  </div>
                ) : (
                  criteriaStats.map((stat) => (
                    <div
                      key={stat.criterion_number}
                      className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => navigate("/qualiopi/criteria")}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">C{stat.criterion_number}</Badge>
                          <span className="font-medium text-sm">{stat.title}</span>
                        </div>
                        <span className="text-sm font-medium">
                          {getCriterionProgress(stat)}%
                        </span>
                      </div>
                      <Progress
                        value={getCriterionProgress(stat)}
                        className="h-2"
                      />
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          {getStatusIcon("compliant")} {stat.compliant}
                        </span>
                        <span className="flex items-center gap-1">
                          {getStatusIcon("partial")} {stat.partial}
                        </span>
                        <span className="flex items-center gap-1">
                          {getStatusIcon("non_compliant")} {stat.non_compliant}
                        </span>
                        <span className="flex items-center gap-1">
                          {getStatusIcon("not_evaluated")} {stat.not_evaluated}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Side Cards */}
          <div className="space-y-6">
            {/* Next Audit */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Prochain audit
                </CardTitle>
              </CardHeader>
              <CardContent>
                {nextAudit ? (
                  <div className="space-y-2">
                    <Badge
                      variant={
                        nextAudit.status === "planned" ? "default" : "secondary"
                      }
                    >
                      {nextAudit.audit_type === "certification"
                        ? "Certification initiale"
                        : nextAudit.audit_type === "surveillance"
                        ? "Audit de surveillance"
                        : nextAudit.audit_type === "renewal"
                        ? "Renouvellement"
                        : "Audit interne"}
                    </Badge>
                    <p className="text-lg font-medium">
                      {new Date(nextAudit.audit_date).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => navigate("/qualiopi/audits")}
                    >
                      Voir les audits
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground text-sm mb-3">
                      Aucun audit planifie
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate("/qualiopi/audits")}
                    >
                      Planifier un audit
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Documents */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documentation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <p className="text-3xl font-bold">{documentsCount}</p>
                  <p className="text-sm text-muted-foreground">documents</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full mt-4"
                    onClick={() => navigate("/qualiopi/documents")}
                  >
                    Gerer les documents
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle>Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate("/qualiopi/indicators")}
                >
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Evaluer les indicateurs
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate("/qualiopi/evidence")}
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Lier les preuves
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate("/qualiopi/non-conformities")}
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Gerer les NC
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </QualiopiLayout>
  );
}
