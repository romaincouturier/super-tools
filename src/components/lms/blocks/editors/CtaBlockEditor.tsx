import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import RichTextEditor from "@/components/content/RichTextEditor";
import { TagsInput } from "@/components/ui/tags-input";
import { uploadLmsImage } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { cn } from "@/lib/utils";
import type { CtaBlockContent } from "@/types/lms-blocks";

interface Props {
  lessonId: string;
  content: CtaBlockContent;
  onChange: (content: CtaBlockContent) => void;
  slim?: boolean;
}

const ACCENT_PRESETS = [
  { value: "#FFD100", label: "Jaune SuperTilt" },
  { value: "#101820", label: "Noir SuperTilt" },
  { value: "#14B8A6", label: "Teal" },
  { value: "#FF6B6B", label: "Corail" },
];

export default function CtaBlockEditor({ lessonId, content, onChange, slim }: Props) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const accent = content.accent_color ?? "#FFD100";

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadLmsImage(file, lessonId);
      onChange({ ...content, image_url: url });
    } catch (err) {
      toastError(toast, err instanceof Error ? err : "Erreur d'upload");
    } finally {
      setUploading(false);
    }
  };

  const form = (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Petit label</Label>
          <Input
            value={content.label ?? ""}
            onChange={(e) => onChange({ ...content, label: e.target.value || null })}
            placeholder="ex: Pour aller plus loin, À découvrir aussi…"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Badge sur l'image (optionnel)</Label>
          <Input
            value={content.badge ?? ""}
            onChange={(e) => onChange({ ...content, badge: e.target.value || null })}
            placeholder="ex: Nos formations"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Titre</Label>
          <Input
            value={content.title ?? ""}
            onChange={(e) => onChange({ ...content, title: e.target.value || null })}
            placeholder="ex: Envie d'animer des ateliers *qui marquent les esprits* ?"
          />
          <p className="text-[11px] text-muted-foreground">Entourez un mot d'astérisques pour le surligner : *mot*</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Sous-titre (optionnel)</Label>
          <Input
            value={content.subtitle ?? ""}
            onChange={(e) => onChange({ ...content, subtitle: e.target.value || null })}
            placeholder="ex: Pratiques d'Ateliers et de Réunions Créatifs"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Image / illustration</Label>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1">
            <Input
              value={content.image_url ?? ""}
              onChange={(e) => onChange({ ...content, image_url: e.target.value || null })}
              placeholder="https://… ou téléversez un fichier"
            />
          </div>
          <div>
            <input
              type="file"
              accept="image/*"
              ref={fileRef}
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full sm:w-auto">
              {uploading ? <Spinner className="mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
              {uploading ? "Upload…" : "Importer"}
            </Button>
          </div>
        </div>
        {content.image_url && (
          <div className="relative w-fit">
            <img src={content.image_url} alt="Illustration du CTA" className="h-32 rounded-lg object-cover" />
            <button
              type="button"
              aria-label="Retirer l'image"
              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80"
              onClick={() => onChange({ ...content, image_url: null })}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Texte descriptif</Label>
        <RichTextEditor
          content={content.body_html || ""}
          onChange={(body_html) => onChange({ ...content, body_html })}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Bénéfices (2 à 3 pastilles)</Label>
        <TagsInput
          value={content.benefits ?? []}
          onChange={(benefits) => onChange({ ...content, benefits: benefits.slice(0, 3) })}
          placeholder="ex: Formats concrets, Outils prêts à l'emploi…"
          variant="pill"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Texte du bouton</Label>
          <Input
            value={content.button_label}
            onChange={(e) => onChange({ ...content, button_label: e.target.value })}
            placeholder="ex: Découvrir nos formations"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Lien du bouton</Label>
          <Input
            type="url"
            value={content.button_url}
            onChange={(e) => onChange({ ...content, button_url: e.target.value })}
            placeholder="https://…"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Lien secondaire (optionnel)</Label>
          <Input
            value={content.secondary_label ?? ""}
            onChange={(e) => onChange({ ...content, secondary_label: e.target.value || null })}
            placeholder="ex: Voir le programme détaillé"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">URL du lien secondaire</Label>
          <Input
            type="url"
            value={content.secondary_url ?? ""}
            onChange={(e) => onChange({ ...content, secondary_url: e.target.value || null })}
            placeholder="https://…"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Switch
            id="cta-new-tab"
            checked={content.open_in_new_tab !== false}
            onCheckedChange={(v) => onChange({ ...content, open_in_new_tab: v })}
          />
          <Label htmlFor="cta-new-tab" className="cursor-pointer text-xs">Ouvrir dans un nouvel onglet</Label>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Couleur d'accent :</span>
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              title={p.label}
              onClick={() => onChange({ ...content, accent_color: p.value })}
              className={cn(
                "h-6 w-6 rounded-md border-2 transition-all",
                accent === p.value ? "border-foreground scale-110 shadow-sm" : "border-transparent hover:border-muted-foreground/50",
              )}
              style={{ backgroundColor: p.value }}
              aria-pressed={accent === p.value}
              aria-label={p.label}
            />
          ))}
        </div>
      </div>
    </div>
  );

  if (slim) {
    return (
      <div
        style={{
          borderRadius: "var(--st-br, 20px)",
          border: "1px solid #ECECEF",
          borderLeft: `4px solid ${accent}`,
          padding: "1.25rem",
          boxShadow: "0 4px 16px rgba(16, 24, 32, 0.05)",
        }}
      >
        {form}
      </div>
    );
  }

  return form;
}
