import { useMemo, useState } from "react";
import { Pencil, Trash2, AlertTriangle, Wallet, Percent, Target, BadgeCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { toastError } from "@/lib/toastError";
import KpiCard from "@/components/finance/KpiCard";
import { EUR } from "@/components/finance/InvoicesTable";
import BalanceSheetUploader from "@/components/finance/BalanceSheetUploader";
import BalanceSheetEditor from "@/components/finance/BalanceSheetEditor";
import BalanceSheetMultiYearComparison from "@/components/finance/BalanceSheetMultiYearComparison";
import { useBalanceSheets, useDeleteBalanceSheet, type BalanceSheetRow } from "@/hooks/useBalanceSheets";
import { computeMetrics, isBalanceConsistent } from "@/lib/balanceSheetParser";

const MAX_COMPARED = 3;

export default function BalanceSheetAnalyzer() {
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const { data, isLoading } = useBalanceSheets();
  const deleteMutation = useDeleteBalanceSheet();
  const [editing, setEditing] = useState<BalanceSheetRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const rows = data ?? [];
  const selected = useMemo(() => rows.filter((r) => selectedIds.includes(r.id)), [rows, selectedIds]);
  const latestSelected = selected[0] ?? rows[0];
  const latestMetrics = latestSelected ? computeMetrics(latestSelected.data) : null;

  const toggleSelect = (id: string) => {
    setSelectedIds((ids) => {
      if (ids.includes(id)) return ids.filter((i) => i !== id);
      if (ids.length >= MAX_COMPARED) return [...ids.slice(1), id];
      return [...ids, id];
    });
  };

  const handleDelete = async (row: BalanceSheetRow) => {
    const ok = await confirm({
      title: `Supprimer le bilan ${row.annee} ?`,
      description: "Cette action est irréversible. Le PDF sera également supprimé du stockage.",
      confirmText: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    try {
      await deleteMutation.mutateAsync(row);
      setSelectedIds((ids) => ids.filter((i) => i !== row.id));
      if (editing?.id === row.id) setEditing(null);
      toast({ title: "Bilan supprimé" });
    } catch (err) {
      toastError(toast, err);
    }
  };

  if (editing) {
    return <BalanceSheetEditor row={editing} onClose={() => setEditing(null)} />;
  }

  return (
    <div className="space-y-4">
      <ConfirmDialog />

      <BalanceSheetUploader onUploaded={() => undefined} />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Aucun bilan n'a encore été analysé. Importe un PDF ci-dessus pour commencer.
          </CardContent>
        </Card>
      ) : (
        <>
          {latestMetrics && latestSelected && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                  title="BFR"
                  value={EUR.format(latestMetrics.bfr)}
                  icon={Wallet}
                  tone={latestMetrics.bfr >= 0 ? "default" : "negative"}
                  hint={`Année ${latestSelected.annee}`}
                />
                <KpiCard
                  title="Trésorerie nette"
                  value={EUR.format(latestMetrics.tresorerieNette)}
                  icon={Target}
                  tone={latestMetrics.tresorerieNette >= 0 ? "positive" : "negative"}
                />
                <KpiCard
                  title="Ratio d'autonomie"
                  value={`${latestMetrics.ratioAutonomie.toFixed(1)} %`}
                  icon={BadgeCheck}
                  tone={latestMetrics.ratioAutonomie >= 20 ? "positive" : "negative"}
                  hint="Capitaux propres / Total passif"
                />
                <KpiCard
                  title="Rentabilité nette"
                  value={`${latestMetrics.rentabiliteNette.toFixed(1)} %`}
                  icon={Percent}
                  tone={latestMetrics.rentabiliteNette >= 0 ? "positive" : "negative"}
                  hint="Résultat net / CA"
                />
              </div>

              {(latestMetrics.bfr < 0 || latestMetrics.ratioAutonomie < 20) && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Points de vigilance</AlertTitle>
                  <AlertDescription>
                    {latestMetrics.bfr < 0 && (
                      <div>BFR négatif — le cycle d'exploitation finance la trésorerie, à surveiller.</div>
                    )}
                    {latestMetrics.ratioAutonomie < 20 && (
                      <div>
                        Ratio d'autonomie financière à {latestMetrics.ratioAutonomie.toFixed(1)}% (sous le seuil de
                        20%) — la dépendance aux financements externes est élevée.
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bilans disponibles</CardTitle>
              <CardDescription>
                Sélectionne jusqu'à {MAX_COMPARED} années pour les comparer (par défaut le bilan le plus récent
                alimente les KPI).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {rows.map((row) => {
                  const consistent = isBalanceConsistent(row.data);
                  const isSelected = selectedIds.includes(row.id);
                  return (
                    <div
                      key={row.id}
                      className={`flex items-center gap-3 p-3 rounded-md border ${
                        isSelected ? "border-primary bg-primary/5" : ""
                      }`}
                    >
                      <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(row.id)} />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium flex items-center gap-2">
                          Bilan {row.annee}
                          {!consistent && (
                            <Badge variant="destructive" className="text-xs">
                              Actif ≠ Passif
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          CA : {EUR.format(row.data.compte_resultat.chiffre_affaires)} • Résultat net :{" "}
                          {EUR.format(row.data.compte_resultat.resultat_net)}
                          {row.pdf_filename && <> • PDF : {row.pdf_filename}</>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(row)} title="Corriger">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(row)} title="Supprimer">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <BalanceSheetMultiYearComparison rows={selected.length > 0 ? selected : rows.slice(0, MAX_COMPARED)} />
        </>
      )}
    </div>
  );
}
