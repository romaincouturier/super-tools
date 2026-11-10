import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  DISPLAY_STATUS_LABELS,
  DISPLAY_STATUS_ORDER,
  EDITORIAL_CATEGORY_LABELS,
  PRACTICAL_FILTER_LABELS,
  type SocialEditorialCategory,
  type SocialPracticalFilter,
  type SocialChannel,
  type SocialFilters,
  type SocialPublicationStatus,
  type SocialTheme,
} from "@/services/socialContents";
import { STATUS_DOT_CLASSES } from "@/components/social/ContentCard";

interface SocialFilterBarProps {
  themes: SocialTheme[];
  channels: SocialChannel[];
  filters: SocialFilters;
  onChange: (filters: SocialFilters) => void;
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors",
        pressed ? "bg-primary text-primary-foreground border-primary" : "bg-background text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function Family({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="text-xs text-muted-foreground mr-1">{label}</span>
      {children}
    </div>
  );
}

function toggled<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value); else next.add(value);
  return next;
}

/** Pastilles de filtre : aucune sélectionnée au départ, OU dans une famille, ET entre familles. */
export default function SocialFilterBar({ themes, channels, filters, onChange }: SocialFilterBarProps) {
  const categories = filters.categories ?? new Set<SocialEditorialCategory>();
  const practical = filters.practical ?? new Set<SocialPracticalFilter>();
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2" data-testid="social-filter-bar">
      {themes.length > 0 && (
        <Family label="Expertise">
          {themes.map((t) => (
            <Chip
              key={t.id}
              pressed={filters.themeIds.has(t.id)}
              onClick={() => onChange({ ...filters, themeIds: toggled(filters.themeIds, t.id) })}
            >
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} aria-hidden="true" />
              {t.name}
            </Chip>
          ))}
        </Family>
      )}
      <Family label="Réseau">
        {channels.map((c) => (
          <Chip
            key={c.id}
            pressed={filters.channelIds.has(c.id)}
            onClick={() => onChange({ ...filters, channelIds: toggled(filters.channelIds, c.id) })}
          >
            {c.name}
          </Chip>
        ))}
      </Family>
      <Family label="Statut">
        {DISPLAY_STATUS_ORDER.map((s: SocialPublicationStatus) => (
          <Chip
            key={s}
            pressed={filters.statuses.has(s)}
            onClick={() => onChange({ ...filters, statuses: toggled(filters.statuses, s) })}
          >
            <span className={cn("h-2 w-2 rounded-full shrink-0", STATUS_DOT_CLASSES[s])} aria-hidden="true" />
            {DISPLAY_STATUS_LABELS[s]}
          </Chip>
        ))}
      </Family>
      <Family label="Catégorie">
        {(Object.keys(EDITORIAL_CATEGORY_LABELS) as SocialEditorialCategory[]).map((c) => (
          <Chip
            key={c}
            pressed={categories.has(c)}
            onClick={() => onChange({ ...filters, categories: toggled(categories, c) })}
          >
            {EDITORIAL_CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </Family>
      <Family label="Préparation">
        {(Object.keys(PRACTICAL_FILTER_LABELS) as SocialPracticalFilter[]).map((f) => (
          <Chip
            key={f}
            pressed={practical.has(f)}
            onClick={() => onChange({ ...filters, practical: toggled(practical, f) })}
          >
            {PRACTICAL_FILTER_LABELS[f]}
          </Chip>
        ))}
      </Family>
    </div>
  );
}
