import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InlineEdit } from "./InlineEdit";
import ButtonBlockViewer from "../viewers/ButtonBlockViewer";
import type { ButtonBlockContent, ButtonVariant } from "@/types/lms-blocks";

interface Props {
  content: ButtonBlockContent;
  onChange: (content: ButtonBlockContent) => void;
  slim?: boolean;
}

const VARIANTS: { value: ButtonVariant; label: string }[] = [
  { value: "primary", label: "Principal" },
  { value: "secondary", label: "Secondaire" },
  { value: "outline", label: "Contour" },
];

export default function ButtonBlockEditor({ content, onChange, slim }: Props) {
  const [showUrlInput, setShowUrlInput] = useState(false);

  if (slim) {
    const isPrimary = content.variant === "primary";
    const isOutline = content.variant === "outline";

    const btnStyle: React.CSSProperties = isPrimary
      ? {
          background: "var(--st-ink)",
          color: "#fff",
          border: "none",
          borderRadius: 999,
          padding: "0.625rem 1.5rem",
          fontWeight: 600,
          fontSize: "0.9375rem",
          cursor: "text",
          display: "inline-block",
        }
      : isOutline
      ? {
          background: "transparent",
          color: "var(--st-ink)",
          border: "1px solid rgba(16,24,32,0.25)",
          borderRadius: 999,
          padding: "0.625rem 1.5rem",
          fontWeight: 500,
          fontSize: "0.9375rem",
          cursor: "text",
          display: "inline-block",
        }
      : {
          background: "var(--st-surface)",
          color: "var(--st-ink)",
          border: "none",
          borderRadius: 999,
          padding: "0.625rem 1.5rem",
          fontWeight: 500,
          fontSize: "0.9375rem",
          cursor: "text",
          display: "inline-block",
        };

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.625rem" }}>
        <InlineEdit
          value={content.label}
          onChange={(v) => onChange({ ...content, label: v })}
          placeholder="Libellé du bouton"
          style={btnStyle}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {showUrlInput ? (
            <Input
              autoFocus
              type="url"
              value={content.url}
              onChange={(e) => onChange({ ...content, url: e.target.value })}
              placeholder="https://…"
              className="text-xs h-7 w-56"
              onBlur={() => setShowUrlInput(false)}
            />
          ) : (
            <button
              onClick={() => setShowUrlInput(true)}
              style={{
                fontSize: "0.75rem",
                color: "var(--st-ink-50)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                textDecoration: "underline",
                textUnderlineOffset: 2,
              }}
            >
              {content.url || "Ajouter une URL…"}
            </button>
          )}
        </div>
      </div>
    );
  }

  // Form mode
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Libellé du bouton</Label>
          <Input
            value={content.label}
            onChange={(e) => onChange({ ...content, label: e.target.value })}
            placeholder="En savoir plus"
          />
        </div>
        <div>
          <Label>Style</Label>
          <Select
            value={content.variant}
            onValueChange={(v) => onChange({ ...content, variant: v as ButtonVariant })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VARIANTS.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>URL de destination</Label>
        <Input
          type="url"
          value={content.url}
          onChange={(e) => onChange({ ...content, url: e.target.value })}
          placeholder="https://…"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="open-new-tab"
          checked={content.open_in_new_tab !== false}
          onCheckedChange={(v) => onChange({ ...content, open_in_new_tab: v })}
        />
        <Label htmlFor="open-new-tab" className="text-sm">Ouvrir dans un nouvel onglet</Label>
      </div>
      {content.label && content.url && (
        <div className="border-t pt-3">
          <p className="text-xs text-muted-foreground mb-2">Aperçu :</p>
          <ButtonBlockViewer content={content} />
        </div>
      )}
    </div>
  );
}
