import type { ShortcodeBlockContent, ShortcodeKind } from "@/types/lms-blocks";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Code2 } from "lucide-react";

interface Props {
  content: ShortcodeBlockContent;
  onChange: (c: ShortcodeBlockContent) => void;
}

const CODE_LABELS: Record<ShortcodeKind, { label: string; desc: string }> = {
  besoins: {
    label: "Recueil des besoins",
    desc: "Formulaire pré-formation pour identifier les attentes",
  },
  evaluation: {
    label: "Évaluation / avis",
    desc: "Formulaire d'évaluation post-formation",
  },
};

export default function ShortcodeBlockEditor({ content, onChange }: Props) {
  const code = content.code ?? "besoins";
  const previewShort = `[supertilt_formulaire type="${code}"${
    content.course_id ? ` course_id="${content.course_id}"` : ""
  }]`;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Type de formulaire</Label>
        <Select
          value={code}
          onValueChange={(v) => onChange({ ...content, code: v as ShortcodeKind })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CODE_LABELS) as ShortcodeKind[]).map((k) => (
              <SelectItem key={k} value={k}>
                <div className="flex flex-col">
                  <span>{CODE_LABELS[k].label}</span>
                  <span className="text-xs text-muted-foreground">
                    {CODE_LABELS[k].desc}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="sc-title">Titre affiché (optionnel)</Label>
        <Input
          id="sc-title"
          value={content.title ?? ""}
          onChange={(e) => onChange({ ...content, title: e.target.value || null })}
          placeholder={CODE_LABELS[code].label}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="sc-course">ID cours LearnDash (optionnel)</Label>
        <Input
          id="sc-course"
          value={content.course_id ?? ""}
          onChange={(e) =>
            onChange({ ...content, course_id: e.target.value.trim() || null })
          }
          placeholder="ex. 12345"
        />
        <p className="text-xs text-muted-foreground">
          Laissez vide pour utiliser le cours LearnDash associé à l'apprenant
          lorsqu'il est connu.
        </p>
      </div>

      <div className="flex items-start gap-2 rounded-md border bg-muted/40 p-3 text-xs font-mono">
        <Code2 className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
        <span className="break-all">{previewShort}</span>
      </div>
    </div>
  );
}
