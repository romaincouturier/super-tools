import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import QualiopiLayout from "@/components/qualiopi/QualiopiLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Search,
  Filter,
  FileCheck,
  Save,
} from "lucide-react";

interface Indicator {
  id: string;
  indicator_number: number;
  title: string;
  description: string | null;
  requirements: string | null;
  evidence_required: string | null;
  compliance_status: string;
  notes: string | null;
  action_plan: string | null;
  due_date: string | null;
  criterion_id: string;
  qualiopi_criteria?: {
    criterion_number: number;
    title: string;
  };
}

export default function QualiopiIndicators() {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [criterionFilter, setCriterionFilter] = useState<string>("all");
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(
    null
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchIndicators();
  }, []);

  useEffect(() => {
    const indicatorNum = searchParams.get("indicator");
    if (indicatorNum && indicators.length > 0) {
      const indicator = indicators.find(
        (i) => i.indicator_number === parseInt(indicatorNum)
      );
      if (indicator) {
        setSelectedIndicator(indicator);
      }
    }
  }, [searchParams, indicators]);

  const fetchIndicators = async () => {
    try {
      const { data, error } = await supabase
        .from("qualiopi_indicators")
        .select("*, qualiopi_criteria(criterion_number, title)")
        .order("indicator_number");

      if (error) throw error;
      setIndicators(data || []);
    } catch (error) {
      console.error("Error fetching indicators:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateIndicator = async () => {
    if (!selectedIndicator) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("qualiopi_indicators")
        .update({
          compliance_status: selectedIndicator.compliance_status,
          notes: selectedIndicator.notes,
          action_plan: selectedIndicator.action_plan,
          due_date: selectedIndicator.due_date,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", selectedIndicator.id);

      if (error) throw error;

      setIndicators((prev) =>
        prev.map((i) =>
          i.id === selectedIndicator.id ? selectedIndicator : i
        )
      );

      toast({
        title: "Indicateur mis a jour",
        description: "Les modifications ont ete enregistrees",
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de mettre a jour l'indicateur",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getStatusIcon = (status: string, size = "h-4 w-4") => {
    switch (status) {
      case "compliant":
        return <CheckCircle className={`${size} text-green-500`} />;
      case "partial":
        return <AlertTriangle className={`${size} text-yellow-500`} />;
      case "non_compliant":
        return <XCircle className={`${size} text-red-500`} />;
      case "not_applicable":
        return <HelpCircle className={`${size} text-blue-500`} />;
      default:
        return <HelpCircle className={`${size} text-gray-400`} />;
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
      case "not_applicable":
        return "Non applicable";
      default:
        return "A evaluer";
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "compliant":
        return "bg-green-100 text-green-800";
      case "partial":
        return "bg-yellow-100 text-yellow-800";
      case "non_compliant":
        return "bg-red-100 text-red-800";
      case "not_applicable":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredIndicators = indicators.filter((indicator) => {
    const matchesSearch =
      indicator.title.toLowerCase().includes(search.toLowerCase()) ||
      indicator.indicator_number.toString().includes(search);

    const matchesStatus =
      statusFilter === "all" || indicator.compliance_status === statusFilter;

    const matchesCriterion =
      criterionFilter === "all" ||
      indicator.qualiopi_criteria?.criterion_number.toString() === criterionFilter;

    return matchesSearch && matchesStatus && matchesCriterion;
  });

  // Stats
  const stats = {
    total: indicators.length,
    compliant: indicators.filter((i) => i.compliance_status === "compliant")
      .length,
    partial: indicators.filter((i) => i.compliance_status === "partial").length,
    non_compliant: indicators.filter(
      (i) => i.compliance_status === "non_compliant"
    ).length,
    not_evaluated: indicators.filter(
      (i) =>
        i.compliance_status === "not_evaluated" || !i.compliance_status
    ).length,
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
          <h1 className="text-2xl font-bold">Indicateurs Qualiopi</h1>
          <p className="text-muted-foreground">
            Les 32 indicateurs a evaluer pour la certification
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="text-xl font-bold">{stats.total}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-xl font-bold">{stats.compliant}</p>
                  <p className="text-xs text-muted-foreground">Conformes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-xl font-bold">{stats.partial}</p>
                  <p className="text-xs text-muted-foreground">Partiels</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-xl font-bold">{stats.non_compliant}</p>
                  <p className="text-xs text-muted-foreground">Non conformes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-xl font-bold">{stats.not_evaluated}</p>
                  <p className="text-xs text-muted-foreground">A evaluer</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un indicateur..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={criterionFilter} onValueChange={setCriterionFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Critere" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les criteres</SelectItem>
              {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                <SelectItem key={num} value={num.toString()}>
                  Critere {num}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="compliant">Conforme</SelectItem>
              <SelectItem value="partial">Partiel</SelectItem>
              <SelectItem value="non_compliant">Non conforme</SelectItem>
              <SelectItem value="not_evaluated">A evaluer</SelectItem>
              <SelectItem value="not_applicable">Non applicable</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">N</TableHead>
                  <TableHead>Indicateur</TableHead>
                  <TableHead className="hidden md:table-cell">Critere</TableHead>
                  <TableHead className="w-[120px]">Statut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredIndicators.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8">
                      <p className="text-muted-foreground">
                        Aucun indicateur trouve
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredIndicators.map((indicator) => (
                    <TableRow
                      key={indicator.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedIndicator(indicator)}
                    >
                      <TableCell>
                        <Badge variant="outline">{indicator.indicator_number}</Badge>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{indicator.title}</p>
                        <p className="text-xs text-muted-foreground md:hidden">
                          C{indicator.qualiopi_criteria?.criterion_number}
                        </p>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="secondary">
                          C{indicator.qualiopi_criteria?.criterion_number}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getStatusBadgeClass(indicator.compliance_status)}>
                          {getStatusIcon(indicator.compliance_status)}
                          <span className="ml-1 hidden sm:inline">
                            {getStatusLabel(indicator.compliance_status)}
                          </span>
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Detail Dialog */}
        <Dialog
          open={!!selectedIndicator}
          onOpenChange={(open) => !open && setSelectedIndicator(null)}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Badge variant="outline">
                  Indicateur {selectedIndicator?.indicator_number}
                </Badge>
                {selectedIndicator?.title}
              </DialogTitle>
            </DialogHeader>

            {selectedIndicator && (
              <div className="space-y-4 pt-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-1">Description</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedIndicator.description || "Pas de description"}
                  </p>
                </div>

                {selectedIndicator.requirements && (
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium mb-1 text-blue-800">
                      Exigences
                    </p>
                    <p className="text-sm text-blue-700">
                      {selectedIndicator.requirements}
                    </p>
                  </div>
                )}

                {selectedIndicator.evidence_required && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm font-medium mb-1 text-green-800">
                      Preuves a fournir
                    </p>
                    <p className="text-sm text-green-700">
                      {selectedIndicator.evidence_required}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Statut de conformite</Label>
                    <Select
                      value={selectedIndicator.compliance_status}
                      onValueChange={(value) =>
                        setSelectedIndicator({
                          ...selectedIndicator,
                          compliance_status: value,
                        })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_evaluated">A evaluer</SelectItem>
                        <SelectItem value="compliant">Conforme</SelectItem>
                        <SelectItem value="partial">Partiel</SelectItem>
                        <SelectItem value="non_compliant">Non conforme</SelectItem>
                        <SelectItem value="not_applicable">
                          Non applicable
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Date d'echeance</Label>
                    <Input
                      type="date"
                      value={selectedIndicator.due_date || ""}
                      onChange={(e) =>
                        setSelectedIndicator({
                          ...selectedIndicator,
                          due_date: e.target.value || null,
                        })
                      }
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={selectedIndicator.notes || ""}
                    onChange={(e) =>
                      setSelectedIndicator({
                        ...selectedIndicator,
                        notes: e.target.value,
                      })
                    }
                    placeholder="Notes sur cet indicateur..."
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div>
                  <Label>Plan d'action</Label>
                  <Textarea
                    value={selectedIndicator.action_plan || ""}
                    onChange={(e) =>
                      setSelectedIndicator({
                        ...selectedIndicator,
                        action_plan: e.target.value,
                      })
                    }
                    placeholder="Actions a mettre en place..."
                    className="mt-1"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => setSelectedIndicator(null)}
                  >
                    Annuler
                  </Button>
                  <Button onClick={updateIndicator} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    Enregistrer
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </QualiopiLayout>
  );
}
