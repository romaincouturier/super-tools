import { useEffect, useState } from "react";
import { ShieldAlert, Plus, AlertTriangle } from "lucide-react";
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
import {
  useVhdReports,
  EMPTY_VHD_FORM,
  type VhdReport,
  type VhdReportForm,
} from "@/hooks/useVhdReports";
import {
  VHD_CATEGORIES,
  VHD_CHANNELS,
  VHD_STATUSES,
  categoryLabel,
  channelLabel,
  statusLabel,
  isOverdue,
} from "@/lib/vhdConstants";

/**
 * Registre des signalements de violences, harcèlement et discriminations.
 *
 * Indicateur 12 du référentiel qualité, étendu par le décret 2026-728. L'accès
 * est réservé aux administrateurs par la politique de sécurité des tables : un
 * utilisateur non administrateur ne voit aucune ligne, quel que soit l'écran.
 */

const statusVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
  if (status === "cloture") return "outline";
  if (status === "mesures_prises") return "secondary";
  return "default";
};

const Signalements = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const {
    reports,
    stats,
    loading,
    statusFilter,
    setStatusFilter,
    fetchNarrative,
    saveReport,
    deleteReport,
    changeStatus,
    trainings,
  } = useVhdReports();
  const { confirm, ConfirmDialog } = useConfirm();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VhdReportForm>(EMPTY_VHD_FORM);
  const [saving, setSaving] = useState(false);
  const [narrativeLoaded, setNarrativeLoaded] = useState(true);

  const today = todayAsISO();

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_VHD_FORM, reported_at: today });
    setNarrativeLoaded(true);
    setDialogOpen(true);
  };

  const openEdit = async (report: VhdReport) => {
    setEditingId(report.id);
    setForm({
      reported_at: report.reported_at,
      training_id: report.training_id || "",
      channel: report.channel,
      category: report.category,
      handled_by: report.handled_by || "",
      actions_taken: report.actions_taken || "",
      due_date: report.due_date || "",
      status: report.status,
      narrative: "",
    });
    setNarrativeLoaded(false);
    setDialogOpen(true);
    const narrative = await fetchNarrative(report.id);
    // L'utilisateur a pu commencer à écrire pendant le chargement : sa saisie
    // prime sur le récit stocké.
    setForm((prev) => (prev.narrative ? prev : { ...prev, narrative }));
    setNarrativeLoaded(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveReport(form, user?.id, editingId ?? undefined, narrativeLoaded);
      setDialogOpen(false);
    } catch (err) {
      toastError(toast, err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof VhdReportForm>(key: K, value: VhdReportForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <ModuleLayout>
      <main className="max-w-7xl mx-auto p-6">
        <PageHeader
          icon={ShieldAlert}
          title="Signalements"
          subtitle="Violences, harcèlement et discriminations — registre confidentiel"
          actions={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {!isMobile && "Nouveau signalement"}
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
                  <SelectItem value="open">En cours de traitement</SelectItem>
                  <SelectItem value="all">Tous les signalements</SelectItem>
                  {VHD_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <span>{stats.total} signalement{stats.total > 1 ? "s" : ""}</span>
                {stats.overdue > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {stats.overdue} en retard
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Spinner size="md" /></div>
            ) : reports.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Aucun signalement enregistré. Un registre vide est un résultat
                normal — il doit rester consultable pour le prouver.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[110px]">Date</TableHead>
                      <TableHead className="w-[190px]">Catégorie</TableHead>
                      <TableHead>Formation</TableHead>
                      <TableHead className="w-[110px]">Canal</TableHead>
                      <TableHead className="w-[150px]">En charge</TableHead>
                      <TableHead className="w-[110px]">Échéance</TableHead>
                      <TableHead className="w-[180px]">Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow
                        key={report.id}
                        className="cursor-pointer"
                        onClick={() => openEdit(report)}
                      >
                        <TableCell className="tabular-nums">
                          {new Date(report.reported_at).toLocaleDateString("fr-FR")}
                        </TableCell>
                        <TableCell>{categoryLabel(report.category)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {report.trainings?.training_name || "Hors session"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {channelLabel(report.channel)}
                        </TableCell>
                        <TableCell>{report.handled_by || "—"}</TableCell>
                        <TableCell>
                          {report.due_date ? (
                            <span className={isOverdue(report, today) ? "text-destructive font-medium" : ""}>
                              {new Date(report.due_date).toLocaleDateString("fr-FR")}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={report.status}
                            onValueChange={(v) => changeStatus(report.id, v as typeof VHD_STATUSES[number]["value"])}
                          >
                            <SelectTrigger className="h-8 w-[170px]">
                              <Badge variant={statusVariant(report.status)}>
                                {statusLabel(report.status)}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {VHD_STATUSES.map((s) => (
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
              <DialogTitle>
                {editingId ? "Signalement" : "Nouveau signalement"}
              </DialogTitle>
              <DialogDescription>
                Le récit est conservé en base mais exclu de la sauvegarde
                externe. N'y consigner que ce qui est nécessaire au traitement.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="reported_at">Date du signalement</Label>
                  <Input
                    id="reported_at"
                    type="date"
                    value={form.reported_at}
                    onChange={(e) => set("reported_at", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="due_date">Échéance de traitement</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={form.due_date}
                    onChange={(e) => set("due_date", e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="category">Catégorie</Label>
                  <Select value={form.category} onValueChange={(v) => set("category", v)}>
                    <SelectTrigger id="category"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VHD_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="channel">Canal de signalement</Label>
                  <Select value={form.channel} onValueChange={(v) => set("channel", v)}>
                    <SelectTrigger id="channel"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VHD_CHANNELS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="training_id">Formation concernée</Label>
                <Select
                  value={form.training_id || "none"}
                  onValueChange={(v) => set("training_id", v === "none" ? "" : v)}
                >
                  <SelectTrigger id="training_id">
                    <SelectValue placeholder="Hors session" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Hors session</SelectItem>
                    {trainings.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.training_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="narrative">Description confidentielle</Label>
                <Textarea
                  id="narrative"
                  value={form.narrative}
                  onChange={(e) => set("narrative", e.target.value)}
                  rows={5}
                  placeholder="Faits rapportés, dates, personnes concernées."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="handled_by">Personne en charge du traitement</Label>
                  <Input
                    id="handled_by"
                    value={form.handled_by}
                    onChange={(e) => set("handled_by", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Statut</Label>
                  <Select value={form.status} onValueChange={(v) => set("status", v)}>
                    <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VHD_STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="actions_taken">Actions engagées</Label>
                <Textarea
                  id="actions_taken"
                  value={form.actions_taken}
                  onChange={(e) => set("actions_taken", e.target.value)}
                  rows={3}
                  placeholder="Mesures prises, personnes informées, suites données."
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:justify-between">
              {editingId && (
                <Button
                  variant="destructive"
                  onClick={async () => {
                    const ok = await confirm({
                      title: "Supprimer ce signalement ?",
                      description: "Le récit associé est supprimé avec lui. Cette action est définitive.",
                    });
                    if (!ok) return;
                    await deleteReport(editingId);
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

export default Signalements;
