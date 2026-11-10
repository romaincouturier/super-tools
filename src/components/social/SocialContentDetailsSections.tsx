import { useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useNewsletterCards } from "@/hooks/useSocialContents";
import {
  CHECKLIST_ITEMS,
  EDITORIAL_CATEGORY_LABELS,
  PREPARATION_LABELS,
  VISUAL_TYPE_LABELS,
  moveItem,
  preparationState,
  type SocialDetailsForm,
  type SocialEditorialCategory,
  type SocialTheme,
  type SocialVisualType,
} from "@/services/socialContents";

const NONE = "__none__";

function Section({ title, summary, children }: { title: string; summary?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded border">
      <CollapsibleTrigger asChild>
        <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40">
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", !open && "-rotate-90")} />
          <span className="font-medium">{title}</span>
          {summary && <span className="ml-auto truncate text-xs text-muted-foreground">{summary}</span>}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 border-t px-3 py-3">{children}</CollapsibleContent>
    </Collapsible>
  );
}

interface Props {
  value: SocialDetailsForm;
  onChange: (next: SocialDetailsForm) => void;
  themes: SocialTheme[];
  validatedAt: string | null;
  validatedByLabel: string | null;
  canValidate: boolean;
  busy: boolean;
  onValidate: (validated: boolean) => void;
}

/** Sections repliables du formulaire : brief visuel, classement, sources, notes, préparation. */
export default function SocialContentDetailsSections({
  value, onChange, themes, validatedAt, validatedByLabel, canValidate, busy, onValidate,
}: Props) {
  const set = <K extends keyof SocialDetailsForm>(key: K, v: SocialDetailsForm[K]) => onChange({ ...value, [key]: v });
  const [cardPicker, setCardPicker] = useState(false);
  const [cardQuery, setCardQuery] = useState("");
  const cards = useNewsletterCards(cardQuery, cardPicker);

  const isCarousel = value.visual_type === "carousel";
  const briefSummary = [
    value.visual_type ? VISUAL_TYPE_LABELS[value.visual_type] : null,
    isCarousel ? `${value.visual_slides.length} diapositive${value.visual_slides.length > 1 ? "s" : ""}` : null,
  ].filter(Boolean).join(", ") || "Vide";
  const themeNames = themes.filter((t) => value.theme_ids.includes(t.id)).map((t) => t.name);
  const classSummary = [...themeNames, value.editorial_category ? EDITORIAL_CATEGORY_LABELS[value.editorial_category] : null]
    .filter(Boolean).join(", ") || "Non classé";
  const checked = CHECKLIST_ITEMS.filter((i) => value[i.key]).length;
  const prep = preparationState({ ...value, validated_at: validatedAt });

  const updateSource = (i: number, patch: Partial<SocialDetailsForm["sources"][number]>) =>
    set("sources", value.sources.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  return (
    <div className="space-y-2" data-testid="social-details-sections">
      <Section title="Brief visuel" summary={briefSummary}>
        <div className="space-y-1">
          <Label>Type de visuel</Label>
          <Select value={value.visual_type ?? NONE} onValueChange={(v) => set("visual_type", v === NONE ? null : (v as SocialVisualType))}>
            <SelectTrigger aria-label="Type de visuel"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Non précisé</SelectItem>
              {(Object.keys(VISUAL_TYPE_LABELS) as SocialVisualType[]).map((k) => (
                <SelectItem key={k} value={k}>{VISUAL_TYPE_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {([
          ["visual_message", "Message principal"],
          ["visual_elements", "Éléments à représenter"],
          ["visual_texts", "Textes à intégrer dans le visuel"],
          ["visual_composition", "Indications de composition"],
        ] as const).map(([key, label]) => (
          <div key={key} className="space-y-1">
            <Label htmlFor={`social-${key}`}>{label}</Label>
            <Textarea id={`social-${key}`} rows={2} value={value[key]} onChange={(e) => set(key, e.target.value)} />
          </div>
        ))}
        {isCarousel && (
          <div className="space-y-2" data-testid="social-slides">
            <Label>Diapositives</Label>
            {value.visual_slides.map((slide, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-6 pt-2 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
                <Textarea
                  rows={2}
                  aria-label={`Diapositive ${i + 1}`}
                  value={slide}
                  onChange={(e) => set("visual_slides", value.visual_slides.map((s, j) => (j === i ? e.target.value : s)))}
                />
                <div className="flex flex-col">
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Monter la diapositive ${i + 1}`}
                    disabled={i === 0} onClick={() => set("visual_slides", moveItem(value.visual_slides, i, i - 1))}>
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Descendre la diapositive ${i + 1}`}
                    disabled={i === value.visual_slides.length - 1} onClick={() => set("visual_slides", moveItem(value.visual_slides, i, i + 1))}>
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Supprimer la diapositive ${i + 1}`}
                  onClick={() => set("visual_slides", value.visual_slides.filter((_, j) => j !== i))}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => set("visual_slides", [...value.visual_slides, ""])}>
              <Plus className="mr-1 h-4 w-4" /> Ajouter une diapositive
            </Button>
          </div>
        )}
      </Section>

      <Section title="Classement" summary={classSummary}>
        <div className="space-y-1">
          <Label>Expertises</Label>
          {themes.length === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune expertise : ajoutez-en dans Réglages.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Expertises">
              {themes.map((t) => {
                const pressed = value.theme_ids.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={pressed}
                    onClick={() => set("theme_ids", pressed ? value.theme_ids.filter((id) => id !== t.id) : [...value.theme_ids, t.id])}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
                      pressed ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-accent",
                    )}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} aria-hidden="true" />
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="space-y-1">
          <Label>Catégorie éditoriale</Label>
          <Select
            value={value.editorial_category ?? NONE}
            onValueChange={(v) => set("editorial_category", v === NONE ? null : (v as SocialEditorialCategory))}
          >
            <SelectTrigger aria-label="Catégorie éditoriale"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sans catégorie</SelectItem>
              {(Object.keys(EDITORIAL_CATEGORY_LABELS) as SocialEditorialCategory[]).map((k) => (
                <SelectItem key={k} value={k}>{EDITORIAL_CATEGORY_LABELS[k]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Section>

      <Section title="Sources" summary={value.sources.length ? `${value.sources.length} source${value.sources.length > 1 ? "s" : ""}` : "Aucune"}>
        {value.sources.map((src, i) => (
          <div key={i} className="flex items-center gap-2">
            {src.content_card_id ? (
              <span className="flex flex-1 items-center gap-1.5 truncate rounded border px-2 py-1.5 text-sm">
                <Link2 className="h-3.5 w-3.5 shrink-0" /> Newsletter : {src.content_card_title ?? "carte"}
              </span>
            ) : (
              <>
                <Input aria-label={`Adresse de la source ${i + 1}`} placeholder="https://…" value={src.url}
                  onChange={(e) => updateSource(i, { url: e.target.value })} />
                <Input aria-label={`Libellé de la source ${i + 1}`} placeholder="Libellé (facultatif)" value={src.label}
                  onChange={(e) => updateSource(i, { label: e.target.value })} className="sm:w-48" />
              </>
            )}
            <Button type="button" variant="ghost" size="icon" aria-label={`Supprimer la source ${i + 1}`}
              onClick={() => set("sources", value.sources.filter((_, j) => j !== i))}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm"
            onClick={() => set("sources", [...value.sources, { url: "", label: "", content_card_id: null, content_card_title: null }])}>
            <Plus className="mr-1 h-4 w-4" /> Ajouter un lien
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setCardPicker((v) => !v)}>
            <Link2 className="mr-1 h-4 w-4" /> Lier une carte Newsletter
          </Button>
        </div>
        {cardPicker && (
          <div className="space-y-2 rounded border p-2">
            <Input aria-label="Rechercher une carte Newsletter" placeholder="Rechercher par titre" value={cardQuery}
              onChange={(e) => setCardQuery(e.target.value)} />
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {cards.isError && <li className="text-muted-foreground">Cartes indisponibles</li>}
              {(cards.data ?? []).map((c) => (
                <li key={c.id}>
                  <button type="button" className="w-full truncate rounded px-2 py-1 text-left hover:bg-accent"
                    onClick={() => {
                      set("sources", [...value.sources, { url: "", label: "", content_card_id: c.id, content_card_title: c.title }]);
                      setCardPicker(false);
                    }}>
                    {c.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      <Section title="Notes internes" summary={value.internal_notes.trim() ? "Renseignées" : "Aucune"}>
        <Textarea aria-label="Notes internes" rows={4} placeholder="Jamais publié : à compléter, à vérifier, échanges…"
          value={value.internal_notes} onChange={(e) => set("internal_notes", e.target.value)} />
      </Section>

      <Section title="Préparation" summary={`${PREPARATION_LABELS[prep]} (${checked}/${CHECKLIST_ITEMS.length})`}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {CHECKLIST_ITEMS.map((item) => (
            <label key={item.key} className="flex items-center gap-2 text-sm">
              <Checkbox checked={value[item.key]} onCheckedChange={(v) => set(item.key, v === true)} />
              {item.label}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {validatedAt ? (
            <>
              <span className="text-sm">
                Validé{validatedByLabel ? ` par ${validatedByLabel}` : ""} le {new Date(validatedAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" })}
              </span>
              <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onValidate(false)}>Annuler la validation</Button>
            </>
          ) : (
            <Button type="button" size="sm" disabled={busy || !canValidate || prep !== "to_validate"} onClick={() => onValidate(true)}>
              Valider
            </Button>
          )}
          {!canValidate && !validatedAt && <span className="text-xs text-muted-foreground">Enregistrez le contenu pour pouvoir le valider</span>}
        </div>
      </Section>
    </div>
  );
}
