import { useState } from "react";
import { Link } from "react-router-dom";
import { DatabaseBackup } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskEmail } from "@/lib/demoMask";
import { useNocrmImportRunner, useNocrmImportRuns } from "@/hooks/useNocrmImport";
import type { NocrmImportRun } from "@/services/nocrmImport";

const EUR = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);
const DATE = (s: string | null) => (s ? new Date(s).toLocaleString("fr-FR", { timeZone: "Europe/Paris" }) : "—");
const MODE_LABEL = { simulation: "Simulation", test: "Test 50 fiches", full: "Import complet" } as const;
const STATUS_LABEL = { running: "En cours", done: "Terminé", error: "Erreur", reconciliation_failed: "Écart au rapprochement" } as const;
const CHECK_LABEL: Record<string, string> = {
  leads: "Fiches noCRM retrouvées", wonCount: "Fiches gagnées", wonValue: "Montant des fiches gagnées", notes: "Notes importées", activities: "Activités importées",
};

function Reconciliation({ run }: { run: NocrmImportRun }) {
  const rec = run.reconciliation;
  if (!rec) return null;
  const fmt = (k: string, v: number) => (k === "wonValue" ? EUR(v) : v.toLocaleString("fr-FR"));
  return (
    <div className="space-y-2">
      <p className={rec.ok ? "font-medium text-primary" : "font-medium text-destructive"}>
        {rec.ok ? "Rapprochement conforme." : "Écart au rapprochement : l'import n'est pas validé."}
      </p>
      <Table>
        <TableHeader><TableRow><TableHead>Contrôle</TableHead><TableHead>Attendu (spec)</TableHead><TableHead>Attendu (fichiers)</TableHead><TableHead>Dans SuperTools</TableHead><TableHead /></TableRow></TableHeader>
        <TableBody>
          {rec.checks.map((c) => (
            <TableRow key={c.key}>
              <TableCell>{CHECK_LABEL[c.key] ?? c.key}</TableCell>
              <TableCell>{fmt(c.key, c.expected_spec)}</TableCell>
              <TableCell>{fmt(c.key, c.expected_file)}</TableCell>
              <TableCell>{fmt(c.key, c.actual)}</TableCell>
              <TableCell>{c.ok ? <Badge variant="secondary">OK</Badge> : <Badge variant="destructive">Écart</Badge>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">Montant gagné tel qu'enregistré dans les opportunités (les fiches fusionnées gardent leur montant SuperTools) : {EUR(rec.won_value_in_crm)}</p>
    </div>
  );
}

function SimulationReport({ report }: { report: any }) {
  const { isDemoMode } = useDemoMode();
  if (!report) return null;
  const exp = report.expected_from_file;
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div><p className="text-muted-foreground">Fiches dans le fichier</p><p className="text-lg font-semibold">{report.leads}</p></div>
        <div><p className="text-muted-foreground">À créer</p><p className="text-lg font-semibold">{report.to_create}</p></div>
        <div><p className="text-muted-foreground">À mettre à jour (déjà importées)</p><p className="text-lg font-semibold">{report.to_update}</p></div>
        <div><p className="text-muted-foreground">Fusions avec SuperTools</p><p className="text-lg font-semibold">{report.to_merge}</p></div>
        <div><p className="text-muted-foreground">Notes</p><p className="text-lg font-semibold">{report.notes}</p></div>
        <div><p className="text-muted-foreground">Activités</p><p className="text-lg font-semibold">{report.activities}</p></div>
        <div><p className="text-muted-foreground">Gagnées</p><p className="text-lg font-semibold">{exp.wonCount} · {EUR(exp.wonValue)}</p></div>
        <div><p className="text-muted-foreground">Tags à créer</p><p className="font-semibold">{report.tags_to_create.length ? report.tags_to_create.join(", ") : "Aucun"}</p></div>
      </div>
      <p className="text-xs text-muted-foreground">
        Attendu selon la spec : {report.expected_from_spec.leads} fiches, {report.expected_from_spec.wonCount} gagnées pour {EUR(report.expected_from_spec.wonValue)}, {report.expected_from_spec.notes} notes, {report.expected_from_spec.activities} activités.
      </p>

      <div>
        <p className="mb-1 font-medium">Fusions prévues ({report.merges.length})</p>
        <div className="max-h-80 overflow-auto rounded border">
          <Table>
            <TableHeader><TableRow><TableHead>noCRM</TableHead><TableHead>Email</TableHead><TableHead>Fiche SuperTools conservée</TableHead></TableRow></TableHeader>
            <TableBody>
              {report.merges.map((m: any) => (
                <TableRow key={m.nocrm_id}>
                  <TableCell>#{m.nocrm_id} {m.nocrm_title}<br /><span className="text-xs text-muted-foreground">{DATE(m.nocrm_created_at)}</span></TableCell>
                  <TableCell>{isDemoMode ? maskEmail(m.email) : m.email}</TableCell>
                  <TableCell><Link className="underline" to={`/crm/card/${m.card_id}`}>{m.card_title}</Link><br /><span className="text-xs text-muted-foreground">{DATE(m.card_created_at)}</span></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {report.unknown_values.length > 0 && (
        <div>
          <p className="mb-1 font-medium">Valeurs sans correspondance de tag (conservées dans la fiche d'origine)</p>
          <ul className="list-disc pl-5">{report.unknown_values.map((u: any) => <li key={u.value}>{u.value} ({u.count})</li>)}</ul>
        </div>
      )}
      <div>
        <p className="mb-1 font-medium">Anomalies ({report.anomalies.length})</p>
        {report.anomalies.length === 0 ? <p className="text-muted-foreground">Aucune.</p> : (
          <div className="max-h-60 overflow-auto rounded border p-2">
            <ul className="space-y-1">{report.anomalies.map((a: any, i: number) => <li key={i}><span className="font-mono">{a.nocrm_id}</span> : {a.issue}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );
}

function RunProgress({ run }: { run: NocrmImportRun }) {
  const total = run.total_leads || run.lead_limit || 0;
  const pct = total ? Math.round((run.cursor / total) * 100) : run.status === "done" ? 100 : 0;
  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <Badge variant="outline">{MODE_LABEL[run.mode]}</Badge>
        <Badge variant={run.status === "done" ? "secondary" : run.status === "running" ? "outline" : "destructive"}>{STATUS_LABEL[run.status]}</Badge>
        <span className="text-muted-foreground">{run.cursor} / {total || "?"} fiches · {run.batches_done} lots</span>
      </div>
      <Progress value={pct} />
      <p>Créées {run.created_count} · mises à jour {run.updated_count} · fusionnées {run.merged_count} · ignorées {run.skipped_count} · notes {run.notes_count} · activités {run.activities_count}</p>
      {run.errors?.length > 0 && (
        <div className="max-h-48 overflow-auto rounded border p-2 text-xs text-destructive">
          {run.errors.map((e, i) => <p key={i}>{e.nocrm_id ? `#${e.nocrm_id} : ` : ""}{e.error}</p>)}
        </div>
      )}
    </div>
  );
}

export default function CrmNocrmImport() {
  const { isAdmin, loading } = useModuleAccess();
  const { toast } = useToast();
  const { data: runs = [] } = useNocrmImportRuns();
  const runner = useNocrmImportRunner();
  const [leadsFile, setLeadsFile] = useState<File | null>(null);
  const [commentsFile, setCommentsFile] = useState<File | null>(null);
  const [paths, setPaths] = useState<{ leads: string; comments: string } | null>(null);

  const lastSimulation = runs.find((r) => r.mode === "simulation" && r.status === "done");
  const activePaths = paths ?? (lastSimulation ? { leads: lastSimulation.leads_path, comments: lastSimulation.comments_path } : null);
  const running = runs.find((r) => r.mode !== "simulation" && r.status === "running");
  const lastTest = runs.find((r) => r.mode === "test" && r.status === "done");
  const shown = runner.current ?? runs[0] ?? null;

  const guard = async (fn: () => Promise<unknown>, title: string) => {
    try { await fn(); } catch (e) { toastError(toast, e, { title }); }
  };

  if (loading) return <ModuleLayout><div className="flex justify-center p-10"><Spinner /></div></ModuleLayout>;
  if (!isAdmin) return <ModuleLayout><main className="p-6">Page réservée aux administrateurs.</main></ModuleLayout>;

  return (
    <ModuleLayout>
      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
        <PageHeader icon={DatabaseBackup} title="Import noCRM" subtitle="Historique 2020-2026 de l'ancien CRM : fiches, notes et activités" backTo="/crm" />

        <Card>
          <CardHeader><CardTitle className="text-base">1. Fichiers</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1"><Label>nocrm_leads.csv</Label><Input type="file" accept=".csv,text/csv" onChange={(e) => setLeadsFile(e.target.files?.[0] ?? null)} /></div>
              <div className="space-y-1"><Label>nocrm_comments.csv</Label><Input type="file" accept=".csv,text/csv" onChange={(e) => setCommentsFile(e.target.files?.[0] ?? null)} /></div>
            </div>
            <Button disabled={!leadsFile || !commentsFile || runner.busy} onClick={() => guard(async () => {
              const r = await runner.upload(leadsFile!, commentsFile!);
              setPaths({ leads: r.leads_path, comments: r.comments_path });
              toast({ title: "Fichiers envoyés" });
            }, "Échec de l'envoi")}>Envoyer les fichiers</Button>
            {activePaths && <p className="text-xs text-muted-foreground">Fichiers utilisés : {activePaths.leads} et {activePaths.comments}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">2. Simulation puis import</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground">La simulation n'écrit rien dans le CRM. L'import ne déclenche aucun email, relance, action quotidienne ni notification Slack. Relancer un import met les fiches à jour sans doublon.</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!activePaths || runner.busy} onClick={() => guard(() => runner.simulate(activePaths!.leads, activePaths!.comments), "Échec de la simulation")}>Lancer la simulation</Button>
              <Button variant="outline" disabled={!activePaths || !lastSimulation || runner.busy || !!running} onClick={() => guard(() => runner.start("test", activePaths!.leads, activePaths!.comments), "Échec de l'import test")}>Importer 50 fiches (test)</Button>
              <Button disabled={!activePaths || !lastTest || runner.busy || !!running} onClick={() => guard(async () => {
                if (!window.confirm("Lancer l'import complet de toutes les fiches noCRM ?")) return;
                await runner.start("full", activePaths!.leads, activePaths!.comments);
              }, "Échec de l'import")}>Import complet</Button>
              {running && !runner.busy && <Button variant="secondary" onClick={() => guard(() => runner.resume(running), "Échec de la reprise")}>Reprendre l'import en cours</Button>}
              {runner.busy && <Button variant="ghost" onClick={runner.stop}>Mettre en pause</Button>}
              {shown && shown.mode === "full" && !runner.busy && shown.status !== "running" && (
                <Button variant="ghost" onClick={() => guard(() => runner.reconcile(shown.id), "Échec du rapprochement")}>Refaire le rapprochement</Button>
              )}
            </div>
            {!lastSimulation && <p className="text-xs text-muted-foreground">Lancez d'abord une simulation. L'import complet est disponible après un import test.</p>}
            {runner.busy && <p className="flex items-center gap-2"><Spinner />Traitement en cours, gardez la page ouverte. En cas de fermeture, l'import reprendra là où il s'est arrêté.</p>}
          </CardContent>
        </Card>

        {shown && (
          <Card>
            <CardHeader><CardTitle className="text-base">3. Rapport — {MODE_LABEL[shown.mode]} du {DATE(shown.started_at)}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {shown.mode === "simulation" ? <SimulationReport report={shown.report} /> : <RunProgress run={shown} />}
              <Reconciliation run={shown} />
            </CardContent>
          </Card>
        )}

        {runs.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Historique des exécutions</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Mode</TableHead><TableHead>Statut</TableHead><TableHead>Lots</TableHead><TableHead>Créées</TableHead><TableHead>Fusionnées</TableHead><TableHead>Ignorées</TableHead><TableHead>Erreurs</TableHead></TableRow></TableHeader>
                <TableBody>
                  {runs.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{DATE(r.started_at)}</TableCell><TableCell>{MODE_LABEL[r.mode]}</TableCell><TableCell>{STATUS_LABEL[r.status]}</TableCell>
                      <TableCell>{r.batches_done}</TableCell><TableCell>{r.created_count}</TableCell><TableCell>{r.merged_count}</TableCell><TableCell>{r.skipped_count}</TableCell><TableCell>{r.errors?.length ?? 0}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </ModuleLayout>
  );
}
