import { useState } from "react";
import { CheckCircle2, ClipboardCheck, Download, Play, RefreshCw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useTranscriptInventories, useTranscriptInventoryControl } from "@/hooks/useTranscriptInventory";
import { type TranscriptInventoryRun } from "@/services/transcriptInventory";
import { toast } from "@/lib/toast";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";

const states: Record<string, string> = {
  complete: "Vérifié", missing: "Absent", processing: "En cours", blocked: "Bloqué", error: "En erreur", empty: "Texte vide", summary_only: "Résumé seul", trashed: "À la corbeille", unverified: "Non vérifié", mismatch: "Texte ou durée différent", source_empty: "Source sans phrases",
};
const repairable = new Set(["missing", "error", "empty", "summary_only", "mismatch"]);

function InventorySource({ source, run }: { source: "fireflies" | "google_drive"; run?: TranscriptInventoryRun }) {
  const control = useTranscriptInventoryControl();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [search, setSearch] = useState("");
  const [batchPending, setBatchPending] = useState(false);
  const [progress, setProgress] = useState("");
  const busy = control.isPending || batchPending;
  const issues = (run?.items ?? []).filter((i) => showAll || i.state !== "complete").filter((i) => i.title.toLocaleLowerCase("fr").includes(search.toLocaleLowerCase("fr")));
  const label = source === "fireflies" ? "Fireflies" : "Google Drive";

  const repair = async () => {
    if (!run) return;
    setConfirm(false);
    setBatchPending(true);
    let success = 0;
    const ids = [...selected];
    for (const [index, id] of ids.entries()) {
      setProgress(`${index + 1} / ${ids.length}`);
      try {
        await control.mutateAsync({ action: "repair", run_id: run.id, external_id: id });
        success++;
        setSelected((old) => { const next = new Set(old); next.delete(id); return next; });
      } catch (error) { console.warn("Réparation interrompue", error); break; }
    }
    setProgress("");
    setBatchPending(false);
    if (success) toast.success(`${success} ${source === "fireflies" ? "réparation(s) enregistrée(s)" : "transcription(s) soumise(s)"}`);
  };

  const download = () => {
    if (!run) return;
    const fields = ["title", "date", "state", "detail", "external_id", "transcript_id"] as const;
    const content = [fields.join(";"), ...run.items.map((i) => fields.map((f) => `"${String(i[f] ?? "").replace(/"/g, '""')}"`).join(";"))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `controle-transcripts-${source}-${run.created_at.slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return <section className="border-b border-border py-5 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{label}</h3>
        <Badge variant={run?.status === "complete" ? "outline" : "secondary"}>{run ? run.status === "complete" ? "Inventaire terminé" : run.status === "incomplete" ? "Contrôle incomplet" : "Contrôle en cours" : "Pas de contrôle"}</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {run && <Button variant="ghost" size="icon" title="Exporter le rapport" aria-label={`Exporter ${label}`} onClick={download}><Download className="h-4 w-4" /></Button>}
        {run && <Button disabled={busy} variant="outline" size="sm" onClick={() => control.mutate({ action: "refresh", run_id: run.id })}><RefreshCw className="h-4 w-4 mr-2" />Actualiser les résultats</Button>}
        {run && run.cursor.phase !== "done" ? <Button disabled={busy} size="sm" onClick={() => control.mutate({ action: "continue", run_id: run.id })}>{busy ? <Spinner className="mr-2" /> : <Play className="h-4 w-4 mr-2" />}Poursuivre {label}</Button> : <Button disabled={busy} size="sm" onClick={() => { setSelected(new Set()); control.mutate({ action: "start", source }); }}>{busy ? <Spinner className="mr-2" /> : <ClipboardCheck className="h-4 w-4 mr-2" />}Contrôler {label}</Button>}
      </div>
    </div>
    {run && <>
      <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <span>{run.summary.total ?? run.items.length} éléments inventoriés</span>
        <span className="flex items-center gap-1"><CheckCircle2 className="h-4 w-4" />{run.summary.complete ?? 0} vérifiés</span>
        <span>{run.summary.missing ?? 0} absents</span>
        <span>{(run.summary.empty ?? 0) + (run.summary.error ?? 0) + (run.summary.mismatch ?? 0) + (run.summary.summary_only ?? 0)} anomalies</span>
        <span>{run.summary.unverified ?? 0} non vérifiés</span>
        <span>{run.summary.trashed ?? 0} à la corbeille</span>
      </div>
      <p className="text-xs text-muted-foreground">Contrôle du {new Date(run.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}{run.status === "complete" ? ` · ${run.summary.local_not_in_source ?? 0} fiches locales non retrouvées dans la source accessible` : ` · ${run.cursor.phase === "details" ? `${run.cursor.detail_index ?? 0} textes source comparés` : "Inventaire partiel"}`}</p>
      {run.errors.map((error, index) => <p key={index} className="text-sm text-destructive break-words">{error}</p>)}
      <div className="flex flex-wrap gap-3 items-center">
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher dans le rapport…" className="max-w-xs" />
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={showAll} onCheckedChange={(v) => setShowAll(v === true)} />Inclure les éléments vérifiés</label>
        {selected.size > 0 && <Button disabled={busy} variant="outline" size="sm" onClick={() => setConfirm(true)}><Wrench className="h-4 w-4 mr-2" />Réparer la sélection ({selected.size})</Button>}
        {progress && <span className="text-sm">{progress}</span>}
      </div>
      <div className="max-h-96 overflow-auto border border-border rounded-md">
        <Table><TableHeader><TableRow><TableHead className="w-10" /><TableHead>Réunion / enregistrement</TableHead><TableHead>État</TableHead><TableHead>Contrôle</TableHead></TableRow></TableHeader>
          <TableBody>{issues.map((item) => <TableRow key={item.external_id}>
            <TableCell>{repairable.has(item.state) && <Checkbox aria-label={`Sélectionner ${item.title}`} disabled={busy} checked={selected.has(item.external_id)} onCheckedChange={(checked) => setSelected((old) => { const next = new Set(old); if (checked) next.add(item.external_id); else next.delete(item.external_id); return next; })} />}</TableCell>
            <TableCell className="min-w-48 max-w-sm break-words font-medium">{item.title}</TableCell><TableCell className="whitespace-nowrap">{states[item.state] ?? item.state}</TableCell><TableCell className="text-xs text-muted-foreground min-w-40 max-w-sm break-words">{item.detail ?? "—"}</TableCell>
          </TableRow>)}{issues.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Aucun écart dans les résultats affichés</TableCell></TableRow>}</TableBody>
        </Table>
      </div>
    </>}
    <AlertDialog open={confirm} onOpenChange={setConfirm}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Réparer {selected.size} élément(s) ?</AlertDialogTitle><AlertDialogDescription>Les textes seront récupérés depuis {label}. Aucun email, notification ou contenu social ne sera envoyé ou généré. Les fiches à la corbeille restent inchangées.{source === "google_drive" && " Les nouvelles transcriptions audio consomment le service de transcription."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annuler</AlertDialogCancel><AlertDialogAction onClick={repair}>Confirmer la réparation</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}

export default function TranscriptInventoryPanel() {
  const { data: runs = [], isLoading, error } = useTranscriptInventories();
  if (isLoading) return <Spinner />;
  if (error) return <p className="text-destructive">Impossible de lire les contrôles : {error.message}</p>;
  return <div><h2 className="text-lg font-semibold">Contrôle d’exhaustivité</h2>{(["fireflies", "google_drive"] as const).map((source) => <InventorySource key={source} source={source} run={runs.find((r) => r.source === source)} />)}</div>;
}