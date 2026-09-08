import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { useConfirm } from "@/hooks/useConfirm";
import { useVhdProcedures, type VhdProcedure } from "@/hooks/useVhdProcedures";
import {
  EMPTY_PROCEDURE_FORM,
  procedureStatusLabel,
  publishBlockers,
  type VhdProcedureFormValues,
} from "@/lib/vhdProcedure";

/**
 * Rédaction et publication de la procédure de prévention (indicateur 12).
 *
 * La version en vigueur est affichée sur la page publique de chaque session,
 * à côté du règlement intérieur : c'est par là que les apprenants en prennent
 * connaissance, le lien de cette page leur étant envoyé avec l'email d'accueil.
 */

export function VhdProcedureEditor() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const {
    procedures,
    active,
    suggestedVersion,
    loading,
    saveDraft,
    publish,
    deleteProcedure,
  } = useVhdProcedures();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<VhdProcedureFormValues>(EMPTY_PROCEDURE_FORM);
  const [saving, setSaving] = useState(false);
  // L'ouverture initiale n'a lieu qu'une fois. Se fier à « aucune version
  // ouverte » rouvrirait la version en vigueur par-dessus le formulaire d'une
  // nouvelle version, qui n'a précisément pas d'identifiant.
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    if (opened || !active) return;
    setEditingId(active.id);
    setForm(toForm(active));
    setOpened(true);
  }, [active, opened]);

  const set = <K extends keyof VhdProcedureFormValues>(key: K, value: VhdProcedureFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const openVersion = (procedure: VhdProcedure) => {
    setOpened(true);
    setEditingId(procedure.id);
    setForm(toForm(procedure));
  };

  const openNew = () => {
    setOpened(true);
    setEditingId(null);
    setForm({ ...EMPTY_PROCEDURE_FORM, version: suggestedVersion });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveDraft(form, user?.id, editingId ?? undefined);
    } catch (err) {
      toastError(toast, err instanceof Error ? err.message : "Enregistrement impossible");
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    const blockers = publishBlockers(form);
    if (blockers.length > 0) {
      toastError(toast, `Il manque ${blockers.join(", ")}.`);
      return;
    }
    if (!editingId) {
      toastError(toast, "Enregistrer le brouillon avant de le publier");
      return;
    }
    const ok = await confirm({
      title: "Publier cette version ?",
      description: active && active.id !== editingId
        ? `La version ${active.version} passe en archivée. La nouvelle apparaît immédiatement sur les pages de session.`
        : "Elle apparaît immédiatement sur les pages publiques de session.",
    });
    if (!ok) return;
    await publish(editingId);
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Spinner size="md" /></div>;
  }

  const editingProcedure = procedures.find((p) => p.id === editingId) ?? null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            {editingId ? `Version ${editingProcedure?.version ?? form.version}` : "Nouvelle version"}
            {editingProcedure && (
              <Badge variant={editingProcedure.status === "active" ? "default" : "outline"}>
                {procedureStatusLabel(editingProcedure.status)}
              </Badge>
            )}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Ce texte est publié tel quel sur la page de session que reçoivent les
            apprenants. Il indique quoi faire face à une situation de violence, de
            harcèlement ou de discrimination, et à qui s'adresser.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="procedure-version">Version</Label>
              <Input
                id="procedure-version"
                value={form.version}
                onChange={(e) => set("version", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="procedure-contact">Interlocuteur</Label>
              <Input
                id="procedure-contact"
                value={form.contact_name}
                onChange={(e) => set("contact_name", e.target.value)}
                placeholder="Prénom Nom"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="procedure-email">Email de signalement</Label>
              <Input
                id="procedure-email"
                type="email"
                value={form.contact_email}
                onChange={(e) => set("contact_email", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="procedure-date">Entrée en vigueur</Label>
            <Input
              id="procedure-date"
              type="date"
              className="sm:w-[220px]"
              value={form.effective_from}
              onChange={(e) => set("effective_from", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="procedure-content">Texte de la procédure</Label>
            <Textarea
              id="procedure-content"
              rows={14}
              value={form.content}
              onChange={(e) => set("content", e.target.value)}
              placeholder={
                "Que faire si vous subissez ou constatez une situation de violence, de harcèlement ou de discrimination pendant la formation.\n\n1. À qui s'adresser\n2. Comment le signalement est traité\n3. Sous quel délai vous recevez une réponse"
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">
              {editingProcedure?.status === "active"
                ? "Cette version est en vigueur : enregistrer la modifie pour tout le monde."
                : "Enregistrer conserve un brouillon, invisible des apprenants."}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSave} disabled={saving}>
                {saving && <Spinner className="mr-2" />}
                Enregistrer
              </Button>
              {editingProcedure?.status !== "active" && (
                <Button onClick={handlePublish} disabled={saving}>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Mettre en vigueur
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-base">Versions</CardTitle>
            <Button variant="outline" size="sm" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1" />
              Nouvelle
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {procedures.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              Aucune version. Rédigez la première et mettez-la en vigueur pour
              qu'elle apparaisse sur les pages de session.
            </p>
          ) : (
            procedures.map((procedure) => (
              <button
                key={procedure.id}
                type="button"
                onClick={() => openVersion(procedure)}
                className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${
                  procedure.id === editingId ? "border-primary bg-muted/40" : ""
                }`}
              >
                <span className="flex-1 truncate">Version {procedure.version}</span>
                {procedure.effective_from && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {new Date(procedure.effective_from).toLocaleDateString("fr-FR")}
                  </span>
                )}
                <Badge variant={procedure.status === "active" ? "default" : "outline"}>
                  {procedureStatusLabel(procedure.status)}
                </Badge>
              </button>
            ))
          )}

          {editingProcedure && editingProcedure.status !== "active" && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-destructive hover:text-destructive"
              onClick={async () => {
                const ok = await confirm({
                  title: `Supprimer la version ${editingProcedure.version} ?`,
                  description: "Une version archivée documente ce qui s'appliquait à une date donnée. La supprimer perd cette trace.",
                });
                if (!ok) return;
                await deleteProcedure(editingProcedure.id);
                setEditingId(null);
                setForm(EMPTY_PROCEDURE_FORM);
              }}
            >
              Supprimer cette version
            </Button>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog />
    </div>
  );
}

function toForm(procedure: VhdProcedure): VhdProcedureFormValues {
  return {
    version: procedure.version,
    content: procedure.content,
    contact_name: procedure.contact_name || "",
    contact_email: procedure.contact_email || "",
    effective_from: procedure.effective_from || "",
  };
}

export default VhdProcedureEditor;
