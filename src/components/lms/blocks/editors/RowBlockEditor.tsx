import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type {
  RowBlockContent,
  RowColumnCount,
  RowImageFit,
  RowImageFrame,
  RowImageSizing,
  RowVerticalAlign,
} from "@/types/lms-blocks";

interface Props {
  content: RowBlockContent;
  onChange: (content: RowBlockContent) => void;
  slim?: boolean;
}

const COL_LABELS: Record<number, string> = { 1: "1 colonne", 2: "2 colonnes", 3: "3 colonnes" };

export default function RowBlockEditor({ content, onChange, slim }: Props) {
  if (slim) {
    return (
      <div className="flex items-center gap-1.5 py-0.5">
        {Array.from({ length: content.column_count }).map((_, i) => (
          <div
            key={i}
            className="flex-1 h-4 rounded"
            style={{ background: "rgba(16,24,32,0.05)", border: "1.5px dashed rgba(16,24,32,0.15)" }}
          />
        ))}
        <span className="text-xs ml-1 shrink-0" style={{ color: "var(--st-ink-muted)" }}>
          {COL_LABELS[content.column_count] ?? `${content.column_count} col.`}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>Nombre de colonnes</Label>
      <Select
        value={String(content.column_count)}
        onValueChange={(value) =>
          onChange({ ...content, column_count: Number.parseInt(value, 10) as RowColumnCount })
        }
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="1">1 colonne</SelectItem>
          <SelectItem value="2">2 colonnes</SelectItem>
          <SelectItem value="3">3 colonnes</SelectItem>
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Sur mobile, les colonnes s&apos;empilent verticalement.
      </p>

      {content.column_count > 1 && (
        <div className="space-y-2 pt-2 border-t">
          <Label>Images des colonnes</Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Alignement vertical</span>
              <Select
                value={content.vertical_align ?? "top"}
                onValueChange={(v) => onChange({ ...content, vertical_align: v as RowVerticalAlign })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Haut</SelectItem>
                  <SelectItem value="center">Centre</SelectItem>
                  <SelectItem value="bottom">Bas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Ajustement</span>
              <Select
                value={content.image_fit ?? "contain"}
                onValueChange={(v) => onChange({ ...content, image_fit: v as RowImageFit })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="contain">Contenir (image entière)</SelectItem>
                  <SelectItem value="cover">Couvrir (recadrage propre)</SelectItem>
                  <SelectItem value="natural">Taille naturelle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Taille des médias</span>
              <Select
                value={content.image_sizing ?? "max_height"}
                onValueChange={(v) => onChange({ ...content, image_sizing: v as RowImageSizing })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal_width">Largeur identique</SelectItem>
                  <SelectItem value="equal_height">Hauteur identique</SelectItem>
                  <SelectItem value="max_height">Hauteur max commune</SelectItem>
                  <SelectItem value="free">Taille libre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-muted-foreground">Cadre</span>
              <Select
                value={content.image_frame ?? "rounded"}
                onValueChange={(v) => onChange({ ...content, image_frame: v as RowImageFrame })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sans cadre</SelectItem>
                  <SelectItem value="rounded">Coins arrondis</SelectItem>
                  <SelectItem value="card">Carte fond blanc</SelectItem>
                  <SelectItem value="border">Bordure fine</SelectItem>
                  <SelectItem value="shadow">Ombre subtile</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            S&apos;applique aux blocs image placés dans les colonnes. Aucune image n&apos;est déformée.
          </p>
        </div>
      )}
    </div>
  );
}
