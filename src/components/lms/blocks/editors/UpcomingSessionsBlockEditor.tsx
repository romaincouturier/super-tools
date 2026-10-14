import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import RichTextEditor from "@/components/content/RichTextEditor";
import { supabase } from "@/integrations/supabase/client";
import type { UpcomingSessionsBlockContent } from "@/types/lms-blocks";
import UpcomingSessionsBlockViewer from "../viewers/UpcomingSessionsBlockViewer";

interface Props {
  content: UpcomingSessionsBlockContent;
  onChange: (content: UpcomingSessionsBlockContent) => void;
  slim?: boolean;
}

export default function UpcomingSessionsBlockEditor({ content, onChange, slim }: Props) {
  const { data: catalog = [] } = useQuery({
    queryKey: ["lms-upcoming-sessions-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase.from("formation_configs").select("id, formation_name").order("formation_name");
      if (error) throw error;
      return data ?? [];
    },
  });
  const ids = content.catalog_ids ?? [];
  const set = (patch: Partial<UpcomingSessionsBlockContent>) => onChange({ ...content, ...patch });
  const text = (k: keyof UpcomingSessionsBlockContent, label: string, placeholder?: string) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input value={(content[k] as string) ?? ""} placeholder={placeholder} onChange={(e) => set({ [k]: e.target.value || null })} />
    </div>
  );
  const isCta = content.layout === "cta";

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">Formations du catalogue ({ids.length} sélectionnée{ids.length > 1 ? "s" : ""})</Label>
        <div className="max-h-48 overflow-y-auto rounded-md border p-2 space-y-1">
          {catalog.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={ids.includes(c.id)}
                onCheckedChange={(v) => set({ catalog_ids: v ? [...ids, c.id] : ids.filter((i) => i !== c.id) })}
              />
              {c.formation_name}
            </label>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Mise en page</Label>
          <Select value={content.layout ?? "list"} onValueChange={(v) => set({ layout: v as "list" | "cta" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="list">Liste seule</SelectItem>
              <SelectItem value="cta">CTA complet</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {isCta && (
          <div className="space-y-1">
            <Label className="text-xs">Thème</Label>
            <Select value={content.theme ?? "yellow"} onValueChange={(v) => set({ theme: v as "yellow" | "dark" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="yellow">Jaune</SelectItem>
                <SelectItem value="dark">Anthracite</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-xs">Nombre max de sessions</Label>
          <Input type="number" min={1} max={20} value={content.max_items ?? 4} onChange={(e) => set({ max_items: Number(e.target.value) || 4 })} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {text("title", "Titre de la liste", "📍 Prochaines sessions")}
        {text("footer_text", "Texte de pied", "Aussi en intra, chez vous · Certifié Qualiopi")}
        {text("fallback_url", "Lien si aucune date (défaut : page programme)")}
      </div>
      {isCta && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {text("cta_label", "Petit label")}
            {text("cta_title", "Titre du CTA")}
            {text("button_label", "Bouton principal : libellé")}
            {text("button_url", "Bouton principal : URL")}
            {text("secondary_label", "Lien secondaire : libellé")}
            {text("secondary_url", "Lien secondaire : URL")}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Texte</Label>
            <RichTextEditor content={content.body_html ?? ""} onChange={(html: string) => set({ body_html: html })} />
          </div>
        </div>
      )}
      {!slim && (
        <div className="pt-2">
          <p className="text-xs text-muted-foreground mb-2">Aperçu</p>
          <UpcomingSessionsBlockViewer content={content} />
        </div>
      )}
    </div>
  );
}
