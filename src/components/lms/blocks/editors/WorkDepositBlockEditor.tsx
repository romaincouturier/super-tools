import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Upload } from "lucide-react";
import RichTextEditor from "@/components/content/RichTextEditor";
import type { WorkDepositBlockContent } from "@/types/lms-blocks";

interface Props {
  content: WorkDepositBlockContent;
  onChange: (content: WorkDepositBlockContent) => void;
}

const ALL_FORMATS: string[] = ["jpg", "png", "pdf", "video"];
const FORMAT_LABELS: Record<string, string> = {
  jpg: "JPG",
  png: "PNG",
  pdf: "PDF",
  video: "Vidéo",
};

export default function WorkDepositBlockEditor({ content, onChange }: Props) {
  const formats = content.accepted_formats || ALL_FORMATS;
  const maxSize = content.max_size_mb ?? 50;
  const sharingAllowed = content.sharing_allowed !== false;
  const commentsEnabled = content.comments_enabled !== false;
  const feedbackEnabled = content.feedback_enabled !== false;

  const toggleFormat = (fmt: string) => {
    const next = formats.includes(fmt) ? formats.filter((f) => f !== fmt) : [...formats, fmt];
    onChange({ ...content, accepted_formats: next.length === 0 ? ALL_FORMATS : next });
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Permet aux apprenants de déposer un fichier rattaché à cette leçon. La configuration ci-dessous
        contrôle ce que les apprenants voient et peuvent faire.
      </p>

      <div>
        <Label>Titre du bloc</Label>
        <Input
          value={content.title || ""}
          onChange={(e) => onChange({ ...content, title: e.target.value || "Déposer mon travail" })}
          placeholder="Déposer mon travail"
        />
      </div>

      <div>
        <Label>Consigne de l'exercice</Label>
        <RichTextEditor
          content={content.instructions_html || ""}
          onChange={(html) => onChange({ ...content, instructions_html: html })}
          placeholder="Décrivez ce que l'apprenant doit produire et comment…"
        />
      </div>

      <div>
        <Label>Livrable attendu</Label>
        <Textarea
          value={content.expected_deliverable || ""}
          onChange={(e) => onChange({ ...content, expected_deliverable: e.target.value || null })}
          placeholder="Ex : un visuel exporté en PNG / un PDF d'une page / une vidéo de 2 min…"
          rows={2}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Formats acceptés</Label>
          <div className="flex flex-wrap gap-2 mt-1">
            {ALL_FORMATS.map((fmt) => {
              const active = formats.includes(fmt);
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
            value={maxSize}
            onChange={(e) => onChange({ ...content, max_size_mb: Math.max(1, +e.target.value || 1) })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
        <div className="flex items-center gap-2">
          <Switch
            id="block-sharing"
            checked={sharingAllowed}
            onCheckedChange={(v) => onChange({ ...content, sharing_allowed: v })}
          />
          <Label htmlFor="block-sharing" className="text-sm">Partage autorisé</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="block-comments"
            checked={commentsEnabled}
            onCheckedChange={(v) => onChange({ ...content, comments_enabled: v })}
          />
          <Label htmlFor="block-comments" className="text-sm">Commentaires apprenants</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="block-feedback"
            checked={feedbackEnabled}
            onCheckedChange={(v) => onChange({ ...content, feedback_enabled: v })}
          />
          <Label htmlFor="block-feedback" className="text-sm">Retours SuperTilt</Label>
        </div>
      </div>
    </div>
  );
}
