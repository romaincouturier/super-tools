import { useMemo, useRef, useState } from "react";
import { FileText, RefreshCw, Download } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { toastError } from "@/lib/toastError";
import { useMonthlyReport, useGenerateMonthlyReport } from "@/hooks/useMonthlyReport";
import MonthlyReportView from "@/components/finance/MonthlyReportView";
import { exportElementToPDF } from "@/components/finance/MonthlyReportPDFExporter";

function buildMonthOptions(count: number = 12): Array<{ value: string; label: string }> {
  const today = new Date();
  const opts: Array<{ value: string; label: string }> = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    opts.push({ value, label });
  }
  return opts;
}

export default function MonthlyReport() {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const monthOptions = useMemo(() => buildMonthOptions(12), []);
  const [month, setMonth] = useState<string>(monthOptions[1]?.value ?? monthOptions[0]?.value ?? "");

  const { data: report, isLoading } = useMonthlyReport(month);
  const { generate, loading: generating } = useGenerateMonthlyReport();
  const reportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleGenerate = async () => {
    if (report) {
      const ok = await confirm({
        title: "Régénérer le rapport ?",
        description: "Le rapport actuel sera remplacé par une nouvelle version basée sur les données du jour.",
        confirmText: "Régénérer",
      });
      if (!ok) return;
    }
    await generate(month);
  };

  const handleExport = async () => {
    if (!reportRef.current || !report) return;
    setExporting(true);
    try {
      await exportElementToPDF(reportRef.current, `rapport-pilotage-${month}.pdf`);
      toast({ title: "PDF exporté" });
    } catch (err) {
      toastError(toast, err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <ConfirmDialog />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Rapport de pilotage mensuel</h2>
          <p className="text-sm text-muted-foreground">
            Snapshot Pennylane × CRM du mois — généré à la demande, exportable en PDF.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={month} onValueChange={setMonth}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? <Spinner className="mr-2" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            {report ? "Régénérer" : "Générer"}
          </Button>
          {report && (
            <Button variant="outline" onClick={handleExport} disabled={exporting}>
              {exporting ? <Spinner className="mr-2" /> : <Download className="h-4 w-4 mr-1" />}
              PDF
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : !report ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Aucun rapport pour ce mois
            </CardTitle>
            <CardDescription>
              Lance une génération pour agréger les factures Pennylane, le P&amp;L mensuel et le pipeline CRM en un
              snapshot persisté.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? <Spinner className="mr-2" /> : null}
              Générer le rapport
            </Button>
          </CardContent>
        </Card>
      ) : (
        <MonthlyReportView ref={reportRef} payload={report.payload} />
      )}
    </div>
  );
}
