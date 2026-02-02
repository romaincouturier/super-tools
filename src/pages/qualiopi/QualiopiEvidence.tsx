import { useState, useEffect } from "react";
import QualiopiLayout from "@/components/qualiopi/QualiopiLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle,
  FileText,
  Users,
  Star,
  TrendingUp,
  Calendar,
  Award,
  Lightbulb,
  BookOpen,
  ClipboardList,
} from "lucide-react";

interface FeatureMapping {
  id: string;
  feature_type: string;
  feature_description: string;
  indicators: number[];
  icon: React.ReactNode;
  autoCompliance: boolean;
}

// Mapping des fonctionnalites de l'application vers les indicateurs Qualiopi
const applicationFeatures: FeatureMapping[] = [
  {
    id: "formations",
    feature_type: "formations",
    feature_description: "Gestion des formations",
    indicators: [1, 5, 6, 8, 17, 19],
    icon: <BookOpen className="h-5 w-5" />,
    autoCompliance: true,
  },
  {
    id: "evaluations",
    feature_type: "evaluations",
    feature_description: "Questionnaires d'evaluation a chaud et a froid",
    indicators: [2, 11, 28, 31],
    icon: <Star className="h-5 w-5" />,
    autoCompliance: true,
  },
  {
    id: "questionnaires",
    feature_type: "questionnaires",
    feature_description: "Analyse des besoins prealables",
    indicators: [4, 5, 10],
    icon: <ClipboardList className="h-5 w-5" />,
    autoCompliance: true,
  },
  {
    id: "certificates",
    feature_type: "certificates",
    feature_description: "Generation des attestations de formation",
    indicators: [3, 11],
    icon: <Award className="h-5 w-5" />,
    autoCompliance: true,
  },
  {
    id: "attendance",
    feature_type: "attendance",
    feature_description: "Emargement electronique",
    indicators: [9, 16],
    icon: <Calendar className="h-5 w-5" />,
    autoCompliance: true,
  },
  {
    id: "participants",
    feature_type: "participants",
    feature_description: "Gestion des participants et suivi",
    indicators: [9, 10, 12, 15],
    icon: <Users className="h-5 w-5" />,
    autoCompliance: true,
  },
  {
    id: "improvements",
    feature_type: "improvements",
    feature_description: "Gestion des ameliorations continues",
    indicators: [30, 32],
    icon: <Lightbulb className="h-5 w-5" />,
    autoCompliance: true,
  },
  {
    id: "bpf",
    feature_type: "bpf",
    feature_description: "Bilan Pedagogique et Financier",
    indicators: [2, 31],
    icon: <FileText className="h-5 w-5" />,
    autoCompliance: true,
  },
  {
    id: "trainers",
    feature_type: "trainers",
    feature_description: "Gestion des formateurs (CV, competences)",
    indicators: [21, 22],
    icon: <Users className="h-5 w-5" />,
    autoCompliance: true,
  },
  {
    id: "crm",
    feature_type: "crm",
    feature_description: "CRM et suivi commercial",
    indicators: [1, 4, 9],
    icon: <TrendingUp className="h-5 w-5" />,
    autoCompliance: false,
  },
];

interface Indicator {
  id: string;
  indicator_number: number;
  title: string;
  compliance_status: string;
}

interface EvidenceLink {
  id: string;
  indicator_id: string;
  feature_type: string;
  feature_description: string;
  auto_compliance: boolean;
}

export default function QualiopiEvidence() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [evidenceLinks, setEvidenceLinks] = useState<EvidenceLink[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: indicatorsData } = await supabase
        .from("qualiopi_indicators")
        .select("id, indicator_number, title, compliance_status")
        .order("indicator_number");

      const { data: linksData } = await supabase
        .from("qualiopi_evidence_links")
        .select("*");

      setIndicators(indicatorsData || []);
      setEvidenceLinks(linksData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const isFeatureLinked = (featureType: string, indicatorNumber: number) => {
    const indicator = indicators.find(
      (i) => i.indicator_number === indicatorNumber
    );
    if (!indicator) return false;

    return evidenceLinks.some(
      (link) =>
        link.indicator_id === indicator.id &&
        link.feature_type === featureType
    );
  };

  const toggleFeatureLink = async (
    feature: FeatureMapping,
    indicatorNumber: number
  ) => {
    const indicator = indicators.find(
      (i) => i.indicator_number === indicatorNumber
    );
    if (!indicator) return;

    setSaving(true);
    try {
      const existingLink = evidenceLinks.find(
        (link) =>
          link.indicator_id === indicator.id &&
          link.feature_type === feature.feature_type
      );

      if (existingLink) {
        // Remove link
        const { error } = await supabase
          .from("qualiopi_evidence_links")
          .delete()
          .eq("id", existingLink.id);

        if (error) throw error;

        setEvidenceLinks((prev) =>
          prev.filter((link) => link.id !== existingLink.id)
        );
      } else {
        // Add link
        const { data, error } = await supabase
          .from("qualiopi_evidence_links")
          .insert({
            indicator_id: indicator.id,
            feature_type: feature.feature_type,
            feature_description: feature.feature_description,
            auto_compliance: feature.autoCompliance,
          })
          .select()
          .single();

        if (error) throw error;

        setEvidenceLinks((prev) => [...prev, data]);
      }

      toast({
        title: "Lien mis a jour",
        description: "La relation preuve-indicateur a ete mise a jour",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre a jour le lien",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const autoLinkAllFeatures = async () => {
    setSaving(true);
    try {
      const linksToCreate: {
        indicator_id: string;
        feature_type: string;
        feature_description: string;
        auto_compliance: boolean;
      }[] = [];

      for (const feature of applicationFeatures) {
        for (const indicatorNum of feature.indicators) {
          const indicator = indicators.find(
            (i) => i.indicator_number === indicatorNum
          );
          if (!indicator) continue;

          const exists = evidenceLinks.some(
            (link) =>
              link.indicator_id === indicator.id &&
              link.feature_type === feature.feature_type
          );

          if (!exists) {
            linksToCreate.push({
              indicator_id: indicator.id,
              feature_type: feature.feature_type,
              feature_description: feature.feature_description,
              auto_compliance: feature.autoCompliance,
            });
          }
        }
      }

      if (linksToCreate.length > 0) {
        const { data, error } = await supabase
          .from("qualiopi_evidence_links")
          .insert(linksToCreate)
          .select();

        if (error) throw error;

        setEvidenceLinks((prev) => [...prev, ...(data || [])]);
      }

      toast({
        title: "Liens crees",
        description: `${linksToCreate.length} liens ont ete crees automatiquement`,
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de creer les liens automatiques",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getLinkedIndicatorsCount = (feature: FeatureMapping) => {
    return feature.indicators.filter((num) =>
      isFeatureLinked(feature.feature_type, num)
    ).length;
  };

  // Group indicators by criterion
  const indicatorsByCriterion: Record<number, number[]> = {
    1: [1, 2, 3],
    2: [4, 5, 6, 7, 8],
    3: [9, 10, 11, 12, 13, 14, 15, 16],
    4: [17, 18, 19, 20],
    5: [21, 22],
    6: [23, 24, 25, 26, 27],
    7: [28, 29, 30, 31, 32],
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Preuves applicatives</h1>
            <p className="text-muted-foreground">
              Liez les fonctionnalites de l'application aux indicateurs Qualiopi
            </p>
          </div>
          <Button onClick={autoLinkAllFeatures} disabled={saving}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Lier automatiquement
          </Button>
        </div>

        {/* Features Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {applicationFeatures.map((feature) => {
            const linkedCount = getLinkedIndicatorsCount(feature);
            const totalCount = feature.indicators.length;
            const isFullyLinked = linkedCount === totalCount;

            return (
              <Card
                key={feature.id}
                className={isFullyLinked ? "border-green-200 bg-green-50/50" : ""}
              >
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div
                      className={`p-3 rounded-full ${
                        isFullyLinked ? "bg-green-100" : "bg-muted"
                      }`}
                    >
                      {feature.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{feature.feature_description}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {linkedCount}/{totalCount} indicateurs lies
                      </p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {feature.indicators.map((num) => (
                          <Badge
                            key={num}
                            variant={
                              isFeatureLinked(feature.feature_type, num)
                                ? "default"
                                : "outline"
                            }
                            className="text-xs"
                          >
                            {num}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Detailed Mapping */}
        <Card>
          <CardHeader>
            <CardTitle>Mapping detaille par critere</CardTitle>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="space-y-2">
              {Object.entries(indicatorsByCriterion).map(([criterion, nums]) => (
                <AccordionItem key={criterion} value={criterion}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Critere {criterion}</Badge>
                      <span className="text-sm">
                        {nums.length} indicateurs
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {nums.map((indicatorNum) => {
                        const indicator = indicators.find(
                          (i) => i.indicator_number === indicatorNum
                        );
                        if (!indicator) return null;

                        const linkedFeatures = applicationFeatures.filter(
                          (f) => f.indicators.includes(indicatorNum)
                        );

                        return (
                          <div
                            key={indicatorNum}
                            className="border rounded-lg p-4"
                          >
                            <div className="flex items-start justify-between gap-4 mb-3">
                              <div>
                                <Badge variant="outline" className="mb-1">
                                  Indicateur {indicatorNum}
                                </Badge>
                                <p className="text-sm font-medium">
                                  {indicator.title}
                                </p>
                              </div>
                            </div>

                            {linkedFeatures.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Aucune fonctionnalite correspondante
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {linkedFeatures.map((feature) => (
                                  <div
                                    key={feature.id}
                                    className="flex items-center gap-3"
                                  >
                                    <Checkbox
                                      id={`${feature.id}-${indicatorNum}`}
                                      checked={isFeatureLinked(
                                        feature.feature_type,
                                        indicatorNum
                                      )}
                                      onCheckedChange={() =>
                                        toggleFeatureLink(feature, indicatorNum)
                                      }
                                      disabled={saving}
                                    />
                                    <label
                                      htmlFor={`${feature.id}-${indicatorNum}`}
                                      className="text-sm flex items-center gap-2 cursor-pointer"
                                    >
                                      {feature.icon}
                                      {feature.feature_description}
                                      {feature.autoCompliance && (
                                        <Badge
                                          variant="secondary"
                                          className="text-xs"
                                        >
                                          Auto
                                        </Badge>
                                      )}
                                    </label>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </QualiopiLayout>
  );
}
