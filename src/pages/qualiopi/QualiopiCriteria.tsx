import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import QualiopiLayout from "@/components/qualiopi/QualiopiLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ChevronRight,
  Save,
} from "lucide-react";

interface Criterion {
  id: string;
  criterion_number: number;
  title: string;
  description: string;
  compliance_status: string;
  notes: string | null;
}

interface Indicator {
  id: string;
  indicator_number: number;
  title: string;
  description: string | null;
  requirements: string | null;
  compliance_status: string;
  criterion_id: string;
}

export default function QualiopiCriteria() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: criteriaData, error: criteriaError } = await supabase
        .from("qualiopi_criteria")
        .select("*")
        .order("criterion_number");

      if (criteriaError) throw criteriaError;

      const { data: indicatorsData, error: indicatorsError } = await supabase
        .from("qualiopi_indicators")
        .select("*")
        .order("indicator_number");

      if (indicatorsError) throw indicatorsError;

      setCriteria(criteriaData || []);
      setIndicators(indicatorsData || []);
    } catch (error) {
      console.error("Error fetching criteria:", error);
    } finally {
      setLoading(false);
    }
  };

  const initializeQualiopi = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from("users")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      if (!userData?.organization_id) {
        toast({
          title: "Erreur",
          description: "Organisation non trouvee",
          variant: "destructive",
        });
        return;
      }

      // Call the initialization function
      const { error } = await supabase.rpc("initialize_qualiopi_for_organization", {
        org_id: userData.organization_id,
      });

      if (error) throw error;

      toast({
        title: "Initialisation reussie",
        description: "Les 7 criteres et 32 indicateurs ont ete crees",
      });

      fetchData();
    } catch (error: any) {
      console.error("Error initializing Qualiopi:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'initialiser Qualiopi",
        variant: "destructive",
      });
    }
  };

  const updateCriterionStatus = async (
    criterionId: string,
    status: string,
    notes?: string
  ) => {
    setSaving(criterionId);
    try {
      const updates: Record<string, string | null> = { compliance_status: status };
      if (notes !== undefined) {
        updates.notes = notes;
      }

      const { error } = await supabase
        .from("qualiopi_criteria")
        .update(updates)
        .eq("id", criterionId);

      if (error) throw error;

      setCriteria((prev) =>
        prev.map((c) => (c.id === criterionId ? { ...c, ...updates } : c))
      );

      toast({
        title: "Statut mis a jour",
        description: "Le critere a ete mis a jour",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre a jour le critere",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "compliant":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "partial":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "non_compliant":
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <HelpCircle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "compliant":
        return "Conforme";
      case "partial":
        return "Partiel";
      case "non_compliant":
        return "Non conforme";
      default:
        return "A evaluer";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "compliant":
        return "default";
      case "partial":
        return "secondary";
      case "non_compliant":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getCriterionIndicators = (criterionId: string) => {
    return indicators.filter((i) => i.criterion_id === criterionId);
  };

  const getCriterionProgress = (criterionId: string) => {
    const criterionIndicators = getCriterionIndicators(criterionId);
    if (criterionIndicators.length === 0) return 0;

    const compliant = criterionIndicators.filter(
      (i) => i.compliance_status === "compliant"
    ).length;
    const partial = criterionIndicators.filter(
      (i) => i.compliance_status === "partial"
    ).length;

    return Math.round(
      ((compliant + partial * 0.5) / criterionIndicators.length) * 100
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

  if (criteria.length === 0) {
    return (
      <QualiopiLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold">Criteres Qualiopi</h1>
            <p className="text-muted-foreground">
              Les 7 criteres de la certification Qualiopi
            </p>
          </div>

          <Card>
            <CardContent className="py-12 text-center">
              <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                Aucun critere initialise
              </h3>
              <p className="text-muted-foreground mb-6">
                Initialisez les 7 criteres et 32 indicateurs Qualiopi pour votre
                organisation.
              </p>
              <Button onClick={initializeQualiopi}>
                Initialiser Qualiopi
              </Button>
            </CardContent>
          </Card>
        </div>
      </QualiopiLayout>
    );
  }

  return (
    <QualiopiLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Criteres Qualiopi</h1>
          <p className="text-muted-foreground">
            Les 7 criteres de la certification Qualiopi
          </p>
        </div>

        <Accordion type="single" collapsible className="space-y-4">
          {criteria.map((criterion) => {
            const criterionIndicators = getCriterionIndicators(criterion.id);
            const progress = getCriterionProgress(criterion.id);

            return (
              <AccordionItem
                key={criterion.id}
                value={criterion.id}
                className="border rounded-lg px-4"
              >
                <AccordionTrigger className="hover:no-underline py-4">
                  <div className="flex items-center gap-4 flex-1">
                    <Badge variant="outline" className="shrink-0">
                      C{criterion.criterion_number}
                    </Badge>
                    <div className="flex-1 text-left">
                      <p className="font-medium">{criterion.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={progress} className="h-2 w-32" />
                        <span className="text-xs text-muted-foreground">
                          {progress}%
                        </span>
                      </div>
                    </div>
                    {getStatusIcon(criterion.compliance_status)}
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2 pb-4">
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {criterion.description}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium">
                          Statut de conformite
                        </label>
                        <Select
                          value={criterion.compliance_status}
                          onValueChange={(value) =>
                            updateCriterionStatus(criterion.id, value)
                          }
                        >
                          <SelectTrigger className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_evaluated">
                              A evaluer
                            </SelectItem>
                            <SelectItem value="compliant">Conforme</SelectItem>
                            <SelectItem value="partial">Partiel</SelectItem>
                            <SelectItem value="non_compliant">
                              Non conforme
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium">Notes</label>
                      <Textarea
                        value={criterion.notes || ""}
                        onChange={(e) =>
                          setCriteria((prev) =>
                            prev.map((c) =>
                              c.id === criterion.id
                                ? { ...c, notes: e.target.value }
                                : c
                            )
                          )
                        }
                        placeholder="Notes sur ce critere..."
                        className="mt-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() =>
                          updateCriterionStatus(
                            criterion.id,
                            criterion.compliance_status,
                            criterion.notes || ""
                          )
                        }
                        disabled={saving === criterion.id}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Enregistrer les notes
                      </Button>
                    </div>

                    <div>
                      <h4 className="text-sm font-medium mb-3">
                        Indicateurs ({criterionIndicators.length})
                      </h4>
                      <div className="space-y-2">
                        {criterionIndicators.map((indicator) => (
                          <div
                            key={indicator.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() =>
                              navigate(`/qualiopi/indicators?indicator=${indicator.indicator_number}`)
                            }
                          >
                            <div className="flex items-center gap-3">
                              {getStatusIcon(indicator.compliance_status)}
                              <div>
                                <p className="text-sm font-medium">
                                  Indicateur {indicator.indicator_number}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {indicator.title}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={getStatusBadgeVariant(
                                  indicator.compliance_status
                                ) as any}
                              >
                                {getStatusLabel(indicator.compliance_status)}
                              </Badge>
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </QualiopiLayout>
  );
}
