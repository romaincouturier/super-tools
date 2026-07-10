import { useRef, useState, useEffect } from "react";
import { Search, Plus } from "lucide-react";
import { LAYOUT_BLOCKS, CONTENT_BLOCKS } from "@/components/lms/blocks/registry";
import type { BlockTypeMeta } from "@/components/lms/blocks/registry";
import type { LessonBlockType } from "@/types/lms-blocks";
import { LESSON_TEMPLATES } from "@/types/lms-templates";

// Description and shortcut hints per block type (matching design catalog)
const BLOCK_META: Partial<Record<LessonBlockType, { desc: string; kbd?: string }>> = {
  text:            { desc: "Paragraphe, titres, listes", kbd: "/ texte" },
  key_points:      { desc: "Points clés en surbrillance", kbd: "/ retenir" },
  callout:         { desc: "Mise en avant d'une phrase", kbd: "/ encadré" },
  image:           { desc: "Illustration, schéma", kbd: "/ image" },
  video:           { desc: "Lien ou fichier vidéo", kbd: "/ vidéo" },
  file:            { desc: "PDF, document à télécharger", kbd: "/ fichier" },
  quiz:            { desc: "Question à choix multiple", kbd: "/ quiz" },
  checklist:       { desc: "Liste avec cases à cocher", kbd: "/ liste" },
  bullet_list:     { desc: "Énumération simple", kbd: "/ puces" },
  button:          { desc: "Lien ou action cliquable", kbd: "/ bouton" },
  exercise:        { desc: "Exercice pratique guidé", kbd: "/ exercice" },
  self_assessment: { desc: "Auto-évaluation apprenant", kbd: "/ éval" },
  work_deposit:    { desc: "Dépôt de travail", kbd: "/ dépôt" },
  assignment:      { desc: "Devoir à rendre", kbd: "/ devoir" },
  table:           { desc: "Tableau structuré", kbd: "/ tableau" },
  shortcode:       { desc: "Formulaire intégré (besoins, avis)", kbd: "/ formulaire" },
  gallery:         { desc: "Grille ou carrousel d'images", kbd: "/ galerie" },
  html_embed:      { desc: "HTML ou iframe personnalisé", kbd: "/ html" },
  timeline:        { desc: "Étapes numérotées dépliables", kbd: "/ frise" },
  flip_cards:      { desc: "Cartes recto-verso à retourner", kbd: "/ flip" },
  accordion:       { desc: "Questions / réponses dépliables", kbd: "/ accordéon" },
  image_hotspot:   { desc: "Image avec points d'annotation", kbd: "/ hotspot" },
  before_after:    { desc: "Comparaison avant / après", kbd: "/ avant" },
  fill_blanks:     { desc: "Texte à compléter ({{mots}})", kbd: "/ trous" },
  drag_words:      { desc: "Glisser les mots au bon endroit", kbd: "/ glisser" },
  summary:         { desc: "Cocher les affirmations correctes", kbd: "/ résumé" },
  cta:             { desc: "Carte promo : label, bénéfices, bouton, image", kbd: "/ cta" },
  code:            { desc: "Code avec coloration syntaxique", kbd: "/ code" },
  section:         { desc: "Conteneur pleine largeur", kbd: "/ section" },
  row:             { desc: "Colonnes côte à côte", kbd: "/ colonnes" },
  divider:         { desc: "Trait fin entre sections", kbd: "/ ---" },
  spacer:          { desc: "Espace vertical", kbd: "/ espace" },
  container:       { desc: "Conteneur générique" },
  reveal:          { desc: "Révéler du contenu au clic", kbd: "/ reveler" },
};

const ACTIVE_CONTENT_TYPES: LessonBlockType[] = [
  "text", "key_points", "callout", "image", "video", "file",
  "quiz", "checklist", "bullet_list", "button", "exercise",
  "self_assessment", "work_deposit", "assignment", "table", "shortcode",
  "gallery", "html_embed", "timeline", "flip_cards",
  "accordion", "image_hotspot", "before_after", "fill_blanks", "drag_words", "summary", "cta", "code",
];

const ACTIVE_LAYOUT_TYPES: LessonBlockType[] = [
  "section", "row", "divider", "spacer", "container", "reveal",
];

interface Props {
  onInsert: (type: LessonBlockType) => void;
  onInsertTemplate?: (templateId: string) => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLElement>;
  placement?: "top" | "bottom";
}

export default function BuilderInsertMenu({ onInsert, onInsertTemplate, onClose, anchorRef, placement = "bottom" }: Props) {
  const [search, setSearch] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose, anchorRef]);

  // Strip leading "/" and whitespace so shortcuts like "/e" or "/ exercice" work naturally.
  const q = search.replace(/^\/\s*/, "").toLowerCase().trim();

  const blockScore = (b: BlockTypeMeta): number => {
    if (!q) return 0;
    const label = b.label.toLowerCase();
    // kbd field stores "/ keyword" — extract keyword only
    const kbd = (BLOCK_META[b.type as LessonBlockType]?.kbd ?? "").replace(/^\/\s*/, "").toLowerCase();
    const desc = (BLOCK_META[b.type as LessonBlockType]?.desc ?? "").toLowerCase();
    if (kbd === q || label === q) return 4;
    if (kbd.startsWith(q)) return 3;
    if (label.startsWith(q)) return 2;
    if (kbd.includes(q) || label.includes(q)) return 1;
    if (desc.includes(q)) return 0;
    return -1;
  };

  const filterAndSort = (blocks: BlockTypeMeta[]) =>
    blocks
      .map((b) => ({ ...b, _score: blockScore(b) }))
      .filter((b) => !q || b._score >= 0)
      .sort((a, b) => b._score - a._score);

  const filteredContent = filterAndSort(CONTENT_BLOCKS)
    .map((b) => ({ ...b, active: ACTIVE_CONTENT_TYPES.includes(b.type) }));

  const filteredLayout = filterAndSort(LAYOUT_BLOCKS)
    .map((b) => ({ ...b, active: ACTIVE_LAYOUT_TYPES.includes(b.type) }));

  const filteredTemplates = onInsertTemplate
    ? LESSON_TEMPLATES.filter((t) => !q || t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
    : [];

  return (
    <div
      ref={menuRef}
      role="menu"
      className={`absolute z-50 left-1/2 -translate-x-1/2 ${placement === "top" ? "bottom-full mb-2" : "top-full mt-2"}`}
      style={{
        width: 320,
        maxHeight: 480,
        overflowY: "auto",
        background: "var(--st-white)",
        border: "1px solid var(--st-ink-08)",
        borderRadius: 20,
        boxShadow: "0 10px 30px rgba(16,24,32,0.1)",
        padding: ".75rem",
        fontFamily: "inherit",
        animation: "st-pop-in 140ms ease",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Search */}
      <div className="flex items-center gap-2 pb-2">
        <span className="flex items-center" style={{ color: "var(--st-ink-50)", padding: "0 .5rem" }}>
          <Search size={14} />
        </span>
        <input
          ref={inputRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un bloc…"
          className="flex-1 border-none outline-none text-sm"
          style={{
            background: "var(--st-surface)",
            borderRadius: 8,
            padding: ".5rem .75rem",
            color: "var(--st-ink)",
            fontFamily: "inherit",
          }}
        />
      </div>

      {filteredTemplates.length > 0 && (
        <TemplateSection items={filteredTemplates} onInsertTemplate={onInsertTemplate!} onClose={onClose} />
      )}
      {filteredContent.length > 0 && (
        <Section title="Contenu" items={filteredContent} onInsert={onInsert} onClose={onClose} />
      )}
      {filteredLayout.length > 0 && (
        <Section title="Mise en page" items={filteredLayout} onInsert={onInsert} onClose={onClose} />
      )}
      {filteredTemplates.length === 0 && filteredContent.length === 0 && filteredLayout.length === 0 && (
        <p className="text-xs text-center py-6" style={{ color: "var(--st-ink-50)" }}>
          Aucun bloc trouvé
        </p>
      )}
    </div>
  );
}

function TemplateSection({
  items,
  onInsertTemplate,
  onClose,
}: {
  items: typeof LESSON_TEMPLATES;
  onInsertTemplate: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: ".6875rem", letterSpacing: ".05em", color: "var(--st-ink-50)", padding: ".625rem .875rem .375rem", textTransform: "uppercase" }}>
        Modèles
      </div>
      {items.map((tpl) => {
        const Icon = tpl.icon;
        return (
          <button
            key={tpl.id}
            role="menuitem"
            onClick={() => { onInsertTemplate(tpl.id); onClose(); }}
            className="w-full flex items-center gap-3 text-left"
            style={{ padding: ".625rem .875rem", borderRadius: 12, color: "var(--st-ink)", fontFamily: "inherit", transition: "background 120ms" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--st-yellow-soft)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            <span className="flex items-center justify-center shrink-0" style={{ width: 32, height: 32, borderRadius: 8, background: "var(--st-surface)", color: "var(--st-ink)" }}>
              <Icon size={18} />
            </span>
            <span className="flex-1 min-w-0">
              <div style={{ fontWeight: 500, fontSize: ".875rem", color: "var(--st-ink)", lineHeight: 1.2 }}>{tpl.label}</div>
              <div style={{ fontSize: ".75rem", color: "var(--st-ink-60)", marginTop: ".125rem", lineHeight: 1.3 }}>{tpl.description}</div>
            </span>
          </button>
        );
      })}
    </div>
  );
}

type ItemWithActive = BlockTypeMeta & { active: boolean };

function Section({
  title,
  items,
  onInsert,
  onClose,
}: {
  title: string;
  items: ItemWithActive[];
  onInsert: (type: LessonBlockType) => void;
  onClose: () => void;
}) {
  return (
    <div>
      <div
        style={{
          fontWeight: 700,
          fontSize: ".6875rem",
          letterSpacing: ".05em",
          color: "var(--st-ink-50)",
          padding: ".625rem .875rem .375rem",
          textTransform: "uppercase",
        }}
      >
        {title}
      </div>
      {items.map((item) => {
        const Icon = item.icon;
        const meta = BLOCK_META[item.type as LessonBlockType];
        return (
          <button
            key={item.type}
            role="menuitem"
            disabled={!item.active}
            onClick={() => {
              if (item.active) {
                onInsert(item.type);
                onClose();
              }
            }}
            className="w-full flex items-center gap-3 text-left"
            style={{
              padding: ".625rem .875rem",
              borderRadius: 12,
              opacity: item.active ? 1 : 0.4,
              cursor: item.active ? "pointer" : "not-allowed",
              color: "var(--st-ink)",
              fontFamily: "inherit",
              transition: "background 120ms",
            }}
            onMouseEnter={(e) => {
              if (item.active) (e.currentTarget as HTMLElement).style.background = "var(--st-yellow-soft)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
          >
            {/* Icon — 32×32 matching design */}
            <span
              className="flex items-center justify-center shrink-0"
              style={{ width: 32, height: 32, borderRadius: 8, background: "var(--st-surface)", color: "var(--st-ink)" }}
            >
              <Icon size={18} />
            </span>
            {/* Label + description */}
            <span className="flex-1 min-w-0">
              <div style={{ fontWeight: 500, fontSize: ".875rem", color: "var(--st-ink)", lineHeight: 1.2 }}>
                {item.label}
              </div>
              {meta?.desc && (
                <div style={{ fontSize: ".75rem", color: "var(--st-ink-60)", marginTop: ".125rem", lineHeight: 1.3 }}>
                  {meta.desc}
                </div>
              )}
            </span>
            {/* Keyboard shortcut or "soon" badge */}
            {item.active && meta?.kbd && (
              <span
                style={{
                  borderRadius: 6,
                  padding: ".125rem .375rem",
                  border: "1px solid var(--st-ink-08)",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: ".6875rem",
                  color: "var(--st-ink-60)",
                  background: "var(--st-white)",
                  flexShrink: 0,
                }}
              >
                {meta.kbd}
              </span>
            )}
            {!item.active && (
              <span
                style={{
                  borderRadius: 6,
                  padding: ".125rem .375rem",
                  border: "1px solid var(--st-ink-08)",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: ".6875rem",
                  color: "var(--st-ink-60)",
                  background: "var(--st-white)",
                  flexShrink: 0,
                }}
              >
                soon
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The circular "+" button shown between blocks */
export function InsertButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex items-center justify-center"
      style={{
        width: 32,
        height: 32,
        borderRadius: "999px",
        border: hovered ? "1px solid transparent" : "1px solid var(--st-ink-08)",
        background: hovered ? "var(--st-yellow)" : "var(--st-white)",
        color: "var(--st-ink)",
        transform: hovered ? "translate(-50%, -50%) scale(1.08)" : "translate(-50%, -50%)",
        boxShadow: hovered ? "0 6px 16px rgba(255,209,0,0.4)" : "0 2px 6px rgba(16,24,32,0.06)",
        transition: "all 200ms ease",
        position: "absolute",
        left: "50%",
        top: "50%",
        zIndex: 3,
      }}
      aria-label="Insérer un bloc"
    >
      <Plus size={16} />
    </button>
  );
}
