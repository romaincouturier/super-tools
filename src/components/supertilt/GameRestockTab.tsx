import { useState } from "react";
import { Plus, Pencil, Trash2, Play, Paperclip, Download, ExternalLink, Package, History, X } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useConfirm } from "@/hooks/useConfirm";
import {
  useRestockActions,
  useUpsertRestockAction,
  useDeleteRestockAction,
  useUploadRestockFile,
  useDeleteRestockFile,
  getRestockFileSignedUrl,
  useRestockRuns,
  useLaunchRestock,
  useUpdateRestockItem,
  useUpdateRestockRun,
  useDeleteRestockRun,
  useRestockActionFiles,
  type RestockAction,
  type RestockActionFile,
  type RestockItem,
  type RestockItemStatus,
  type RestockRun,
} from "@/hooks/useGameRestocks";

const EUR = (v: number | null | undefined) =>
  v == null ? "—" : v.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const DT = (s: string | null | undefined) =>
  !s ? "—" : new Date(s).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });

const STATUS_LABELS: Record<RestockItemStatus, string> = {
  todo: "À faire",
  in_progress: "En cours",
  awaiting_delivery: "En attente de livraison",
  received: "Reçu",
};
const STATUS_COLORS: Record<RestockItemStatus, string> = {
  todo: "bg-gray-100 text-gray-800",
  in_progress: "bg-blue-100 text-blue-800",
  awaiting_delivery: "bg-orange-100 text-orange-800",
  received: "bg-green-100 text-green-800",
};

// ── Main tab ─────────────────────────────────────────────────────

export function GameRestockTab({ gameId }: { gameId: string }) {
  const { data: actions, isLoading } = useRestockActions(gameId);
  const { data: runs } = useRestockRuns(gameId);
  const [editing, setEditing] = useState<Partial<RestockAction> | null | undefined>(undefined);
  const [openRun, setOpenRun] = useState<RestockRun | null>(null);
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const del = useDeleteRestockAction();
  const launch = useLaunchRestock();
  const delRun = useDeleteRestockRun();

  const activeRun = (runs ?? []).find((r) => r.status === "in_progress");

  const onLaunch = async () => {
    if (activeRun) {
      setOpenRun(activeRun);
      return;
    }
    try {
      const res = await launch.mutateAsync({ gameId });
      // Fetch the created run then open it
      const created = (await (await fetchRun(res.runId)) as RestockRun);
      setOpenRun(created);
    } catch (e) {
      toastError(toast, e instanceof Error ? e.message : "Erreur");
    }
  };

  return (
    <div className="space-y-6">
      {/* Actions template */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Actions de réassort</h3>
            <p className="text-xs text-muted-foreground">Modèles utilisés à chaque lancement de réassort.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditing({})}>
            <Plus className="h-4 w-4 mr-1" />Ajouter une action
          </Button>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-6"><Spinner className="h-5 w-5" /></div>
        ) : !actions?.length ? (
          <div className="text-sm text-muted-foreground border rounded-md p-6 text-center">
            Aucune action. Ajoutez-en pour pouvoir lancer un réassort.
          </div>
        ) : (
          <div className="space-y-2">
            {actions.map((a) => (
              <div key={a.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{a.label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
                    {a.unit_price_ht != null && <span>PU HT : {EUR(a.unit_price_ht)}</span>}
                    {a.url && (
                      <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                        <ExternalLink className="h-3 w-3" />Lien
                      </a>
                    )}
                    {(a.files?.length ?? 0) > 0 && (
                      <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{a.files!.length}</span>
                    )}
                  </div>
                  {a.instructions && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-wrap">{a.instructions}</p>}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" onClick={async () => {
                    if (!(await confirm({ title: "Supprimer l'action ?", description: a.label }))) return;
                    try { await del.mutateAsync({ id: a.id, gameId }); }
                    catch { toastError(toast, "Erreur"); }
                  }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Historique */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Historique des réassorts</h3>
        </div>
        {!runs?.length ? (
          <div className="text-sm text-muted-foreground border rounded-md p-4 text-center">Aucun réassort</div>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => {
              const done = (r.items ?? []).filter((i) => i.status === "received").length;
              const tot = (r.items ?? []).length;
              const totalCostHT = (r.items ?? []).reduce((s, i) => s + (i.final_cost_ht ?? 0), 0);
              const totalCostTTC = (r.items ?? []).reduce((s, i) => s + (i.final_cost_ttc ?? 0), 0);
              return (
                <div key={r.id} className="border rounded-md p-3 flex items-center justify-between gap-3">
                  <button className="flex-1 text-left" onClick={() => setOpenRun(r)}>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.status === "completed" ? "default" : r.status === "in_progress" ? "outline" : "secondary"}>
                        {r.status === "completed" ? "Terminé" : r.status === "in_progress" ? "En cours" : "Annulé"}
                      </Badge>
                      <span className="text-sm">{DT(r.started_at)}</span>
                      <span className="text-xs text-muted-foreground">{done}/{tot} action(s) reçue(s)</span>
                    </div>
                    {r.status === "completed" && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Coût final : {EUR(totalCostHT)} HT · {EUR(totalCostTTC)} TTC
                      </div>
                    )}
                  </button>
                  <Button variant="ghost" size="icon" onClick={async () => {
                    if (!(await confirm({ title: "Supprimer ce réassort ?" }))) return;
                    try { await delRun.mutateAsync({ id: r.id, gameId }); }
                    catch { toastError(toast, "Erreur"); }
                  }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CTA launch */}
      <div className="border-t pt-4">
        <Button
          className="w-full"
          onClick={onLaunch}
          disabled={launch.isPending || (!activeRun && !(actions?.length))}
        >
          {launch.isPending ? <Spinner className="mr-2" /> : <Play className="h-4 w-4 mr-2" />}
          {activeRun ? "Continuer le réassort en cours" : "Lancer le réassort"}
        </Button>
        {!actions?.length && !activeRun && (
          <p className="text-xs text-muted-foreground text-center mt-2">Ajoutez au moins une action pour lancer un réassort.</p>
        )}
      </div>

      {editing !== undefined && (
        <RestockActionDialog
          gameId={gameId}
          action={editing}
          onClose={() => setEditing(undefined)}
        />
      )}
      {openRun && (
        <RestockRunDialog
          gameId={gameId}
          runId={openRun.id}
          onClose={() => setOpenRun(null)}
        />
      )}
      <ConfirmDialog />
    </div>
  );
}

// Helper to reload a single run
async function fetchRun(id: string): Promise<RestockRun | null> {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await (supabase as any)
    .from("game_restocks")
    .select("*, items:game_restock_items(*)")
    .eq("id", id)
    .maybeSingle();
  return data as RestockRun | null;
}

// ── Action template dialog ───────────────────────────────────────

function RestockActionDialog({
  gameId,
  action,
  onClose,
}: {
  gameId: string;
  action: Partial<RestockAction> | null;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Partial<RestockAction>>(action ?? {});
  const upsert = useUpsertRestockAction();
  const upload = useUploadRestockFile();
  const delFile = useDeleteRestockFile();
  const { toast } = useToast();

  const save = async () => {
    if (!form.label?.trim()) return;
    try {
      await upsert.mutateAsync({ ...form, game_id: gameId, label: form.label.trim() } as any);
      toast({ title: "Action enregistrée" });
      onClose();
    } catch (e) {
      toastError(toast, e instanceof Error ? e.message : "Erreur");
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !form.id) return;
    try {
      await upload.mutateAsync({ actionId: form.id, gameId, file });
      // Reflect in local form immediately: refetch on parent handles list
      toast({ title: "Fichier ajouté" });
    } catch (err) {
      toastError(toast, err instanceof Error ? err.message : "Erreur");
    }
    e.target.value = "";
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? "Modifier l'action" : "Nouvelle action de réassort"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Libellé *</Label>
            <Input value={form.label ?? ""} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="Ex: Commander plateaux chez XYZ" />
          </div>
          <div className="space-y-1">
            <Label>URL</Label>
            <Input type="url" value={form.url ?? ""} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value || null }))} placeholder="https://…" />
          </div>
          <div className="space-y-1">
            <Label>Prix unitaire HT (€)</Label>
            <Input type="number" step="0.01" min="0"
              value={form.unit_price_ht ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, unit_price_ht: e.target.value ? parseFloat(e.target.value) : null }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Instructions à suivre</Label>
            <Textarea rows={4} value={form.instructions ?? ""} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value || null }))} />
          </div>
          {form.id && (
            <div className="space-y-2">
              <Label>Fichiers joints</Label>
              <div className="space-y-1">
                {(action?.files ?? []).map((f) => (
                  <FileRow key={f.id} file={f} onDelete={async () => {
                    try { await delFile.mutateAsync({ id: f.id, path: f.file_url, gameId }); }
                    catch { toastError(toast, "Erreur"); }
                  }} />
                ))}
                {!(action?.files?.length) && <p className="text-xs text-muted-foreground">Aucun fichier</p>}
              </div>
              <Input type="file" onChange={onFile} disabled={upload.isPending} />
              <p className="text-xs text-muted-foreground">Tous types acceptés.</p>
            </div>
          )}
          {!form.id && <p className="text-xs text-muted-foreground">Enregistrez l'action pour pouvoir joindre des fichiers.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={save} disabled={upsert.isPending || !form.label?.trim()}>
            {upsert.isPending ? <Spinner /> : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FileRow({ file, onDelete }: { file: RestockActionFile; onDelete: () => void }) {
  const [loading, setLoading] = useState(false);
  const download = async () => {
    setLoading(true);
    const url = await getRestockFileSignedUrl(file.file_url);
    setLoading(false);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
  };
  return (
    <div className="flex items-center justify-between gap-2 text-sm border rounded px-2 py-1">
      <span className="truncate flex-1">{file.file_name}</span>
      <Button variant="ghost" size="icon" onClick={download} disabled={loading}>
        {loading ? <Spinner className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete}><X className="h-3.5 w-3.5 text-destructive" /></Button>
    </div>
  );
}

// ── Run dialog ───────────────────────────────────────────────────

function RestockRunDialog({
  gameId,
  runId,
  onClose,
}: {
  gameId: string;
  runId: string;
  onClose: () => void;
}) {
  const { data: runs } = useRestockRuns(gameId);
  const run = (runs ?? []).find((r) => r.id === runId);
  const updateItem = useUpdateRestockItem();
  const updateRun = useUpdateRestockRun();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const STATUS_ORDER: Record<RestockItemStatus, number> = { todo: 0, in_progress: 1, awaiting_delivery: 2, received: 3 };
  const items = (run?.items ?? []).slice().sort((a, b) => {
    const s = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    return s !== 0 ? s : a.position - b.position;
  });
  const templateIds = items.map((i) => i.template_action_id).filter(Boolean) as string[];
  const { data: allFiles } = useRestockActionFiles(templateIds);
  const filesByAction = (allFiles ?? []).reduce<Record<string, RestockActionFile[]>>((acc, f) => {
    (acc[f.action_id] ??= []).push(f);
    return acc;
  }, {});

  const allReceived = items.length > 0 && items.every((i) => i.status === "received");
  const canClose = items.every((i) => i.status !== "received" || (i.final_cost_ht != null && i.final_cost_ttc != null));

  const complete = async () => {
    if (!allReceived) {
      if (!(await confirm({ title: "Toutes les actions ne sont pas reçues", description: "Terminer quand même ce réassort ?" }))) return;
    }
    if (!canClose) {
      toastError(toast, "Renseignez le coût HT et TTC final de chaque action reçue.");
      return;
    }
    try {
      await updateRun.mutateAsync({ id: runId, gameId, patch: { status: "completed", completed_at: new Date().toISOString() } as any });
      toast({ title: "Réassort terminé" });
      onClose();
    } catch (err) { toastError(toast, "Erreur", { cause: err }); }
  };

  const cancel = async () => {
    if (!(await confirm({ title: "Annuler ce réassort ?" }))) return;
    try {
      await updateRun.mutateAsync({ id: runId, gameId, patch: { status: "cancelled", completed_at: new Date().toISOString() } as any });
      onClose();
    } catch (err) { toastError(toast, "Erreur", { cause: err }); }
  };

  if (!run) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Réassort du {DT(run.started_at)}
            <Badge variant={run.status === "completed" ? "default" : run.status === "in_progress" ? "outline" : "secondary"} className="ml-2">
              {run.status === "completed" ? "Terminé" : run.status === "in_progress" ? "En cours" : "Annulé"}
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {items.map((item) => (
            <RunItemRow
              key={item.id}
              item={item}
              gameId={gameId}
              readonly={run.status !== "in_progress"}
              files={item.template_action_id ? filesByAction[item.template_action_id] ?? [] : []}
              onPatch={(patch) => updateItem.mutateAsync({ id: item.id, gameId, patch })}
            />
          ))}
          {!items.length && <p className="text-sm text-muted-foreground text-center py-6">Aucune action.</p>}
        </div>
        <DialogFooter className="flex gap-2 sm:justify-between">
          {run.status === "in_progress" ? (
            <>
              <Button variant="ghost" onClick={cancel} className="text-destructive">Annuler le réassort</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>Fermer</Button>
                <Button onClick={complete} disabled={updateRun.isPending}>
                  {updateRun.isPending ? <Spinner /> : "Terminer le réassort"}
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={onClose}>Fermer</Button>
          )}
        </DialogFooter>
        <ConfirmDialog />
      </DialogContent>
    </Dialog>
  );
}

function RunItemRow({
  item,
  gameId: _gameId,
  files,
  readonly,
  onPatch,
}: {
  item: RestockItem;
  gameId: string;
  files: RestockActionFile[];
  readonly: boolean;
  onPatch: (patch: Partial<RestockItem>) => Promise<unknown>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [costHT, setCostHT] = useState<string>(item.final_cost_ht?.toString() ?? "");
  const [costTTC, setCostTTC] = useState<string>(item.final_cost_ttc?.toString() ?? "");
  const [instructions, setInstructions] = useState<string>(item.instructions ?? "");
  const [etaDate, setEtaDate] = useState<string>(item.estimated_delivery_date ?? "");
  const { toast } = useToast();

  const onStatus = async (status: RestockItemStatus) => {
    if (status === "received") {
      if (item.final_cost_ht == null || item.final_cost_ttc == null) {
        setExpanded(true);
        toastError(toast, "Renseignez le coût final HT et TTC avant de marquer comme reçu.");
        return;
      }
      await onPatch({ status, completed_at: new Date().toISOString() } as any);
    } else if (status === "awaiting_delivery") {
      await onPatch({ status, completed_at: null } as any);
      setExpanded(true);
      if (!item.estimated_delivery_date) {
        toast({ title: "Indiquez la date estimée de livraison" });
      }
    } else {
      await onPatch({ status, completed_at: null } as any);
    }
  };

  const saveEta = async () => {
    await onPatch({ estimated_delivery_date: etaDate || null } as any);
    toast({ title: "Date estimée enregistrée" });
  };


  const saveCosts = async () => {
    const ht = costHT ? parseFloat(costHT) : null;
    const ttc = costTTC ? parseFloat(costTTC) : null;
    await onPatch({ final_cost_ht: ht, final_cost_ttc: ttc } as any);
    toast({ title: "Coûts enregistrés" });
  };

  const saveInstructions = async () => {
    await onPatch({ instructions: instructions.trim() || null } as any);
    toast({ title: "Instructions enregistrées" });
  };

  return (
    <div className={`border rounded-md p-3 ${STATUS_COLORS[item.status]}/30`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <button className="text-left w-full" onClick={() => setExpanded((v) => !v)}>
            <div className="font-medium">{item.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
              {item.unit_price_ht != null && <span>PU HT prévu : {EUR(item.unit_price_ht)}</span>}
              {item.url && <span className="inline-flex items-center gap-1"><ExternalLink className="h-3 w-3" />Lien</span>}
              {files.length > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="h-3 w-3" />{files.length} fichier(s)</span>}
            </div>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={STATUS_COLORS[item.status]} variant="secondary">{STATUS_LABELS[item.status]}</Badge>
          {!readonly && (
            <Select value={item.status} onValueChange={(v) => onStatus(v as RestockItemStatus)}>
              <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["todo", "in_progress", "awaiting_delivery", "received"] as RestockItemStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          {item.url && (
            <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
              <ExternalLink className="h-3.5 w-3.5" />{item.url}
            </a>
          )}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Instructions</div>
            <Textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              disabled={readonly}
              placeholder="Ajouter ou compléter les instructions pour cette action…"
            />
            {!readonly && (
              <div className="mt-2">
                <Button size="sm" variant="outline" onClick={saveInstructions} disabled={instructions === (item.instructions ?? "")}>
                  Enregistrer les instructions
                </Button>
              </div>
            )}
          </div>
          {item.status === "awaiting_delivery" && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Date estimée de livraison</div>
              <div className="flex items-center gap-2">
                <Input type="date" value={etaDate} onChange={(e) => setEtaDate(e.target.value)} disabled={readonly} className="w-[200px]" />
                {!readonly && (
                  <Button size="sm" variant="outline" onClick={saveEta} disabled={etaDate === (item.estimated_delivery_date ?? "")}>
                    Enregistrer la date
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Tant que l'action n'est pas reçue, elle apparaîtra dans le récap quotidien.</p>
            </div>
          )}
          {files.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase mb-1">Ressources</div>
              <div className="space-y-1">
                {files.map((f) => (
                  <FileRow key={f.id} file={f} onDelete={() => {}} />
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Coût final HT (€)</Label>
              <Input type="number" step="0.01" min="0" value={costHT} onChange={(e) => setCostHT(e.target.value)} disabled={readonly} />
            </div>
            <div className="space-y-1">
              <Label>Coût final TTC (€)</Label>
              <Input type="number" step="0.01" min="0" value={costTTC} onChange={(e) => setCostTTC(e.target.value)} disabled={readonly} />
            </div>
            {!readonly && (
              <div className="col-span-2">
                <Button size="sm" variant="outline" onClick={saveCosts}>Enregistrer les coûts</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Hide unused import warnings
export const _dummy = { FileRow, RestockActionDialog, RestockRunDialog };
