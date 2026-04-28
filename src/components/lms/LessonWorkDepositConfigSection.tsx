import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Save, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { updateLessonDepositConfig } from "@/services/lms-work-deposit";
import RichTextEditor from "@/components/content/RichTextEditor";
import {
  DEFAULT_WORK_DEPOSIT_CONFIG,
  DEFAULT_DEPOSIT_FORMATS,
  FORMAT_LABELS,
  withDepositDefaults,
  type DepositFormat,
  type WorkDepositConfig,
} from "@/types/lms-work-deposit";

interface Props {
  lessonId: string;
  /** Initial values (read from lms_lessons row). */
  initialEnabled: boolean;
  initialConfig: WorkDepositConfig;
}

const ALL_FORMATS: DepositFormat[] = ["jpg", "png", "pdf", "video"];

export default function LessonWorkDepositConfigSection({
  lessonId,
  initialEnabled,
  initialConfig,
}: Props) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [config, setConfig] = useState<Required<WorkDepositConfig>>(withDepositDefaults(initialConfig));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(initialEnabled);
    setConfig(withDepositDefaults(initialConfig));
  }, [initialEnabled, initialConfig]);

  const toggleFormat = (fmt: DepositFormat) => {
    setConfig((prev) => {
      const next = prev.accepted_formats.includes(fmt)
        ? prev.accepted_formats.filter((f) => f !== fmt)
        : [...prev.accepted_formats, fmt];
      return { ...prev, accepted_formats: next.length === 0 ? DEFAULT_DEPOSIT_FORMATS : next };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateLessonDepositConfig(lessonId, enabled, config);
      toast({ title: "Dépôt de travail enregistré" });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm">Dépôt de travail</h3>
          <p className="text-xs text-muted-foreground">
            Permet aux apprenants de déposer un fichier rattaché à cette leçon.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="deposit-enabled" checked={enabled} onCheckedChange={setEnabled} />
          <Label htmlFor="deposit-enabled" className="text-sm">{enabled ? "Activé" : "Désactivé"}</Label>
        </div>
      </div>

      {enabled && (
        <div className="space-y-4 pt-2 border-t">
          <div>
            <Label>Titre du bloc</Label>
            <Input
              value={config.title}
              onChange={(e) => setConfig({ ...config, title: e.target.value })}
              placeholder={DEFAULT_WORK_DEPOSIT_CONFIG.title}
            />
          </div>

          <div>
            <Label>Consigne de l'exercice</Label>
            <RichTextEditor
              content={config.instructions_html || ""}
              onChange={(html) => setConfig({ ...config, instructions_html: html })}
              placeholder="Décrivez ce que l'apprenant doit produire et comment…"
            />
          </div>

          <div>
            <Label>Livrable attendu</Label>
            <Textarea
              value={config.expected_deliverable || ""}
              onChange={(e) => setConfig({ ...config, expected_deliverable: e.target.value || null })}
              placeholder="Ex : un visuel exporté en PNG / un PDF d'une page / une vidéo de 2 min…"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Formats acceptés</Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {ALL_FORMATS.map((fmt) => {
                  const active = config.accepted_formats.includes(fmt);
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => toggleFormat(fmt)}
                      aria-pressed={active}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                        active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      {FORMAT_LABELS[fmt]}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label htmlFor="deposit-max-size">
                Taille max (Mo)
                <Upload className="inline h-3 w-3 ml-1 text-muted-foreground" />
              </Label>
              <Input
                id="deposit-max-size"
                type="number"
                min={1}
                max={500}
                value={config.max_size_mb}
                onChange={(e) => setConfig({ ...config, max_size_mb: Math.max(1, +e.target.value || 1) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="flex items-center gap-2">
              <Switch
                id="deposit-sharing"
                checked={config.sharing_allowed}
                onCheckedChange={(v) => setConfig({ ...config, sharing_allowed: v })}
              />
              <Label htmlFor="deposit-sharing" className="text-sm">Partage autorisé</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="deposit-comments"
                checked={config.comments_enabled}
                onCheckedChange={(v) => setConfig({ ...config, comments_enabled: v })}
              />
              <Label htmlFor="deposit-comments" className="text-sm">Commentaires apprenants</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="deposit-feedback"
                checked={config.feedback_enabled}
                onCheckedChange={(v) => setConfig({ ...config, feedback_enabled: v })}
              />
              <Label htmlFor="deposit-feedback" className="text-sm">Retours SuperTilt</Label>
            </div>
          </div>
        </div>
      )}

      <div className="pt-2 border-t flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <Spinner className="mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Enregistrer le dépôt
        </Button>
      </div>
    </div>
  );
}
