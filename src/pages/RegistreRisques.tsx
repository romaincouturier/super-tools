import { useState } from "react";
import { AlertTriangle, Plus, ShieldQuestion } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useIsMobile } from "@/hooks/use-mobile";
import { todayAsISO } from "@/lib/dateFormatters";
import { useConfirm } from "@/hooks/useConfirm";
import { useQualityRisks, type QualityRisk } from "@/hooks/useQualityRisks";
import {
  BAND_LABELS,
  EMPTY_RISK_FORM,
  IMPACT_LEVELS,
  PROBABILITY_LEVELS,
  RISK_MODALITIES,
  RISK_STATUSES,
  criticalityBand,
  isReviewOverdue,
  modalityLabel,
  riskStatusLabel,
  scaleLabel,
  type CriticalityBand,
  type QualityRiskFormValues,
  type RiskStatus,
} from "@/lib/qualityRiskConstants";

/**
 * Registre des risques qualité — indicateur 32, étendu par le décret 2026-728.
 *
 * Le décret demande l'analyse des risques pesant sur la qualité des formations
 * sans fixer de barème : les bandes de criticité colorent l'affichage, elles ne
 * prononcent aucune conformité. Le seul chiffre qui appelle une action est le
 * nombre de risques forts auxquels aucune mesure préventive n'est opposée.
 */

const BAND_VARIANT: Record<CriticalityBand, "default" | "secondary" | "outline" | "destructive"> = {
  critique: "destructive",
  eleve: "destructive",
  modere: "secondary",
  faible: "outline",
};

const BAND_ORDER: CriticalityBand[] = ["critique", "eleve", "modere", "faible"];

const RegistreRisques = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const {
    risks,
    formations,
    reclamations,
    improvements,
    summary,
    loading,
    statusFilter,
    setStatusFilter,
    saveRisk,
    deleteRisk,
    changeStatus,
  } = useQualityRisks();
  const { confirm, ConfirmDialog } = useConfirm();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<QualityRiskFormValues>(EMPTY_RISK_FORM);
  const [saving, setSaving] = useState(false);

  const today = todayAsISO();

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_RISK_FORM);
    setDialogOpen(true);
  };

  const openEdit = (risk: QualityRisk) => {
    setEditingId(risk.id);
    setForm({
      label: risk.label,
      formation_config_id: risk.formation_config_id || "",
      modality: risk.modality || "",
      cause: risk.cause || "",
      probability: risk.probability,
      impact: risk.impact,
      preventive_measure: risk.preventive_measure || "",
      owner: risk.owner || "",
      review_date: risk.review_date || "",
      status: risk.status,
      reclamation_id: risk.reclamation_id || "",
      improvement_id: risk.improvement_id || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.label.trim()) {
      toastError(toast, "Le risque doit avoir un intitulé");
      return;
    }
    setSaving(true);
    try {
      await saveRisk(form, user?.id, editingId ?? undefined);
      setDialogOpen(false);
    } catch (err) {
      toastError(toast, err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof QualityRiskFormValues>(key: K, value: QualityRiskFormValues[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Aperçu de ce que la base calculera : la valeur enregistrée reste celle de
  // la colonne générée, jamais celle-ci.
  const previewCriticality = form.probability * form.impact;

  return (
    <ModuleLayout>
      <main className="max-w-7xl mx-auto p-6">
        <PageHeader
          icon={ShieldQuestion}
          title="Risques qualité"
          subtitle="Analyse des risques pesant sur la qualité des formations"
          actions={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {!isMobile && "Nouveau risque"}
            </Button>
          }
        />

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[220px]" aria-label="Filtrer par statut">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Risques actifs</SelectItem>
                  <SelectItem value="all">Tous les risques</SelectItem>
                  {RISK_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{summary.active} risque{summary.active > 1 ? "s" : ""} actif{summary.active > 1 ? "s" : ""}</span>
                {BAND_ORDER.filter((band) => summary.byBand[band] > 0).map((band) => (
                  <Badge key={band} variant={BAND_VARIANT[band]}>
                    {summary.byBand[band]} {BAND_LABELS[band].toLowerCase()}
                  </Badge>
                ))}
                {summary.unmitigated > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {summary.unmitigated} sans mesure
                  </Badge>
                )}
                {summary.overdue > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {summary.overdue} à revoir
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Spinner size="md" /></div>
            ) : risks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Aucun risque enregistré. Le registre reste consultable vide :
                c'est ce qui permet de montrer que l'analyse a bien lieu.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Risque</TableHead>
                      <TableHead className="w-[170px]">Formation</TableHead>
                      <TableHead className="w-[150px]">Modalité</TableHead>
                      <TableHead className="w-[130px]">Criticité</TableHead>
                      <TableHead className="w-[190px]">Mesure préventive</TableHead>
                      <TableHead className="w-[110px]">Revue</TableHead>
                      <TableHead className="w-[180px]">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {risks.map((risk) => (
                      <TableRow
                        key={risk.id}
                        className="cursor-pointer"
                        onClick={() => openEdit(risk)}
                      >
                        <TableCell className="font-medium">{risk.label}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {risk.formation_configs?.formation_name || "Transverse"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {modalityLabel(risk.modality)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={BAND_VARIANT[criticalityBand(risk.criticality)]}>
                            {risk.criticality} · {BAND_LABELS[criticalityBand(risk.criticality)]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {risk.preventive_measure ? (
                            <span className="line-clamp-2">{risk.preventive_measure}</span>
                          ) : (
                            <span className="text-destructive">Aucune</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {risk.review_date ? (
                            <span className={isReviewOverdue(risk, today) ? "text-destructive font-medium" : ""}>
                              {new Date(risk.review_date).toLocaleDateString("fr-FR")}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={risk.status}
                            onValueChange={(v) => changeStatus(risk.id, v as RiskStatus)}
                          >
                            <SelectTrigger className="h-8 w-[170px]">
                              <Badge variant={risk.status === "closed" ? "outline" : "secondary"}>
                                {riskStatusLabel(risk.status)}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {RISK_STATUSES.map((s) => (
                                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Risque qualité" : "Nouveau risque"}</DialogTitle>
              <DialogDescription>
                La criticité est calculée par la base à partir de la probabilité
                et de l'impact : elle ne se saisit pas.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="risk-label">Intitulé du risque</Label>
                <Input
                  id="risk-label"
                  value={form.label}
                  onChange={(e) => set("label", e.target.value)}
                  placeholder="Ex : perte de connexion du formateur en distanciel"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Formation concernée</Label>
                  <Select
                    value={form.formation_config_id || "none"}
                    onValueChange={(v) => set("formation_config_id", v === "none" ? "" : v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Transverse</SelectItem>
                      {formations.map((f) => (
                        <SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Modalité</Label>
                  <Select
                    value={form.modality || "none"}
                    onValueChange={(v) => set("modality", v === "none" ? "" : v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Toutes modalités</SelectItem>
                      {RISK_MODALITIES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="risk-cause">Cause identifiée</Label>
                <Textarea
                  id="risk-cause"
                  value={form.cause}
                  onChange={(e) => set("cause", e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Probabilité</Label>
                  <Select
                    value={String(form.probability)}
                    onValueChange={(v) => set("probability", Number(v))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROBABILITY_LEVELS.map((l) => (
                        <SelectItem key={l.value} value={String(l.value)}>
                          {l.value} · {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Impact</Label>
                  <Select
                    value={String(form.impact)}
                    onValueChange={(v) => set("impact", Number(v))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {IMPACT_LEVELS.map((l) => (
                        <SelectItem key={l.value} value={String(l.value)}>
                          {l.value} · {l.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Criticité</Label>
                  <div className="flex h-10 items-center">
                    <Badge variant={BAND_VARIANT[criticalityBand(previewCriticality)]}>
                      {previewCriticality} · {BAND_LABELS[criticalityBand(previewCriticality)]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {scaleLabel(PROBABILITY_LEVELS, form.probability)} ×{" "}
                    {scaleLabel(IMPACT_LEVELS, form.impact)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="risk-measure">Mesure préventive</Label>
                <Textarea
                  id="risk-measure"
                  value={form.preventive_measure}
                  onChange={(e) => set("preventive_measure", e.target.value)}
                  rows={2}
                  placeholder="Ce qui est mis en place pour que le risque ne se réalise pas"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="risk-owner">Responsable</Label>
                  <Input
                    id="risk-owner"
                    value={form.owner}
                    onChange={(e) => set("owner", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="risk-review">Prochaine revue</Label>
                  <Input
                    id="risk-review"
                    type="date"
                    value={form.review_date}
                    onChange={(e) => set("review_date", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Statut</Label>
                  <Select value={form.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RISK_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Réclamation à l'origine</Label>
                  <Select
                    value={form.reclamation_id || "none"}
                    onValueChange={(v) => set("reclamation_id", v === "none" ? "" : v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {reclamations.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Action d'amélioration engagée</Label>
                  <Select
                    value={form.improvement_id || "none"}
                    onValueChange={(v) => set("improvement_id", v === "none" ? "" : v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {improvements.map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              {editingId && (
                <Button
                  variant="destructive"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Supprimer ce risque ?",
                      description: "Le registre perd la trace de cette analyse. Clôturer le risque le conserve.",
                    });
                    if (!ok) return;
                    await deleteRisk(editingId);
                    setDialogOpen(false);
                  }}
                >
                  Supprimer
                </Button>
              )}
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Annuler</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving && <Spinner className="mr-2" />}
                  Enregistrer
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <ConfirmDialog />
      </main>
    </ModuleLayout>
  );
};

export default RegistreRisques;
