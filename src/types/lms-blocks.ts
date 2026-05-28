/**
 * Composable lesson blocks (ST-2026-0040 + ST-2026-0060).
 *
 * Each lesson is a tree of typed blocks. Two families coexist:
 *   • layout blocks  — structural containers that can host children
 *                      (section, row, container, divider, spacer).
 *   • content blocks — leaves that render an actual piece of content
 *                      (text, video, image, file, callout, key_points,
 *                      checklist, button, exercise, self_assessment,
 *                      work_deposit, quiz, assignment).
 *
 * The tree is materialised in `lms_lesson_blocks` via `parent_block_id`
 * (nullable self-FK) + `position` (sibling order). `kind` discriminates
 * the two families and gates which blocks are allowed as parents.
 */

export type LayoutBlockType =
  | "section"
  | "row"
  | "container"
  | "divider"
  | "spacer";

export type ContentBlockType =
  | "text"
  | "video"
  | "image"
  | "gallery"
  | "file"
  | "quiz"
  | "assignment"
  | "callout"
  | "key_points"
  | "checklist"
  | "bullet_list"
  | "button"
  | "exercise"
  | "self_assessment"
  | "work_deposit"
  | "table"
  | "shortcode"
  | "html_embed"
  | "timeline"
  | "flip_cards"
  | "accordion"
  | "image_hotspot"
  | "before_after"
  | "fill_blanks"
  | "drag_words"
  | "summary";

export type LessonBlockType = LayoutBlockType | ContentBlockType;

export type LessonBlockKind = "layout" | "content";

export const LAYOUT_BLOCK_TYPES: readonly LayoutBlockType[] = [
  "section",
  "row",
  "container",
  "divider",
  "spacer",
] as const;

export function isLayoutBlockType(type: LessonBlockType): type is LayoutBlockType {
  return (LAYOUT_BLOCK_TYPES as readonly string[]).includes(type);
}

/**
 * Layout blocks that can host children. `divider` and `spacer` are layout
 * blocks (they organise the page) but they are leaves — they never carry
 * children. Used by the editor to decide which blocks expose a drop zone.
 */
export const LAYOUT_CONTAINER_TYPES: readonly LayoutBlockType[] = [
  "section",
  "row",
  "container",
] as const;

export function acceptsChildren(type: LessonBlockType): boolean {
  return (LAYOUT_CONTAINER_TYPES as readonly string[]).includes(type);
}

export interface TextBlockContent {
  html: string;
}

export interface TableBlockContent {
  /** HTML du tableau (produit par Tiptap : `<table><thead><tr><th>...</th></tr></thead><tbody>...</tbody></table>`). */
  html: string;
}

export type VideoDisplayStyle = "simple" | "styled";

export interface VideoBlockContent {
  url: string | null;
  duration_seconds?: number | null;
  display_style?: VideoDisplayStyle;
  bg_color?: string | null;
  container_radius?: number | null;
  video_radius?: number | null;
  padding?: number | null;
}

export interface ImageBlockContent {
  url: string | null;
  caption_html?: string | null;
}

export type GalleryMode = "grid" | "carousel";

export interface GalleryImage {
  url: string | null;
  caption_html?: string | null;
}

export interface GalleryBlockContent {
  images: GalleryImage[];
  mode?: GalleryMode;
  columns?: 2 | 3 | 4;
}

export interface FileBlockContent {
  url: string | null;
  name?: string | null;
  size?: number | null;
  description_html?: string | null;
}

export interface QuizBlockContent {
  quiz_id: string | null;
}

export interface AssignmentBlockContent {
  assignment_id: string | null;
  instructions_html?: string | null;
}

export type CalloutColor =
  | "blue" | "amber" | "green" | "red" | "gray"
  | "supertilt_yellow" | "supertilt_black" | "gray_light" | "gray_very_light" | "white"
  | "teal" | "coral";

export type CalloutLevel = "info" | "warning" | "tip" | "example" | "resource";

export interface CalloutBlockContent {
  color: CalloutColor;
  title?: string | null;
  body_html: string;
  level?: CalloutLevel | null;
  border_radius?: number | null;
  show_icon?: boolean;
}

export interface KeyPointsBlockContent {
  title?: string | null;
  items: string[];
}

export interface ChecklistItem {
  id: string;
  label: string;
}

export interface ChecklistBlockContent {
  title?: string | null;
  items: ChecklistItem[];
}

export type ButtonVariant = "primary" | "secondary" | "outline" | "supertilt";
export type ButtonAlignment = "left" | "center" | "right";

export interface ButtonBlockContent {
  label: string;
  url: string;
  variant: ButtonVariant;
  open_in_new_tab: boolean;
  alignment?: ButtonAlignment;
}

export interface ExerciseBlockContent {
  title?: string | null;
  prompt_html: string;
  answer_html?: string | null;
  answer_video_url?: string | null;
  answer_image_urls?: string[] | null;
  checklist_title?: string | null;
  checklist_items?: ChecklistItem[] | null;
  video_url?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
  pdf_url?: string | null;
  work_deposit_enabled?: boolean;
  work_deposit?: WorkDepositBlockContent | null;
}

export type BulletStyle = "round" | "square" | "check" | "arrow" | "star" | "diamond";

export const BULLET_CHARS: Record<BulletStyle, string> = {
  round:   "•",
  square:  "■",
  check:   "✓",
  arrow:   "→",
  star:    "★",
  diamond: "◆",
};

export type BulletSpacing = "compact" | "normal" | "relaxed";

export interface BulletListBlockContent {
  title?: string | null;
  items: string[];
  bullet_style?: BulletStyle;
  bullet_color?: string | null;
  text_color?: string | null;
  item_spacing?: BulletSpacing;
}

export type SelfAssessmentScale = "stars" | "labels";

export interface SelfAssessmentBlockContent {
  prompt: string;
  scale: SelfAssessmentScale;
  labels?: string[];
}

/**
 * Work-deposit block content mirrors the WorkDepositConfig shape from the
 * existing ST-2026-0043 feature so the same renderer (WorkDepositSection)
 * can consume either source.
 */
export interface WorkDepositBlockContent {
  title?: string;
  instructions_html?: string | null;
  expected_deliverable?: string | null;
  accepted_formats?: string[];
  max_size_mb?: number;
  sharing_allowed?: boolean;
  comments_enabled?: boolean;
  feedback_enabled?: boolean;
  /** When not false, the lesson can only be completed once a deposit exists. */
  require_deposit_to_complete?: boolean;
}

// ── Timeline block ──────────────────────────────────────────────────

export interface TimelineDetailItem {
  id: string;
  icon_url?: string | null;
  label: string;
}

export interface TimelineStep {
  id: string;
  icon_url?: string | null;
  title: string;
  description?: string | null;
  panel_title?: string | null;
  panel_items?: TimelineDetailItem[];
}

export interface TimelineBlockContent {
  steps: TimelineStep[];
  accent_color?: string | null;
}

// ── Flip cards block ─────────────────────────────────────────────────

export interface FlipCard {
  id: string;
  front_text?: string | null;
  front_image_url?: string | null;
  back_text?: string | null;
  back_image_url?: string | null;
}

export interface FlipCardsBlockContent {
  cards: FlipCard[];
  card_height_px?: number;
}

// ── Accordion block ──────────────────────────────────────────────────

export interface AccordionItem {
  id: string;
  question: string;
  answer_html: string;
}

export interface AccordionBlockContent {
  title?: string | null;
  items: AccordionItem[];
}

// ── Image hotspot block ───────────────────────────────────────────────

export interface HotspotItem {
  id: string;
  x_pct: number;
  y_pct: number;
  label: string;
  description_html?: string | null;
}

export interface ImageHotspotBlockContent {
  image_url?: string | null;
  hotspots: HotspotItem[];
}

// ── Before / After block ──────────────────────────────────────────────

export interface BeforeAfterBlockContent {
  before_image_url?: string | null;
  after_image_url?: string | null;
  before_label?: string | null;
  after_label?: string | null;
  caption?: string | null;
}

// ── Fill in the blanks block ──────────────────────────────────────────

export interface FillBlanksBlockContent {
  title?: string | null;
  instructions?: string | null;
  /** Text with {{answer}} markers, e.g. "La {{photosynthèse}} transforme la {{lumière}} en énergie." */
  text: string;
}

// ── Drag words block ──────────────────────────────────────────────────

export interface DragWordsBlockContent {
  title?: string | null;
  instructions?: string | null;
  /** Text with *word* markers for draggable targets, e.g. "Le *chat* est un *animal* domestique." */
  text: string;
}

// ── Summary block ─────────────────────────────────────────────────────

export interface SummaryStatement {
  id: string;
  text: string;
  is_correct: boolean;
}

export interface SummaryBlockContent {
  title?: string | null;
  instructions?: string | null;
  statements: SummaryStatement[];
}

// ── Shortcode block ─────────────────────────────────────────────────

/** Codes courts disponibles — formulaires intégrés au cours. */
export type ShortcodeKind = "besoins" | "evaluation";

export interface HtmlEmbedBlockContent {
  /** Raw HTML / iframe code entered by the author. */
  html: string;
  /** Optional heading displayed above the rendered content. */
  title?: string | null;
}

export interface ShortcodeBlockContent {
  /** Type de formulaire à intégrer. */
  code: ShortcodeKind;
  /**
   * ID LearnDash du cours (numérique). Optionnel : si vide, l'apprenant
   * doit accéder au formulaire depuis ses emails. Surchargeable par
   * l'auteur pour pointer vers un cours WP spécifique.
   */
  course_id?: string | null;
  /** Titre optionnel à afficher au-dessus du formulaire intégré. */
  title?: string | null;
}



// ── Layout block contents ───────────────────────────────────────────

export type SectionBackground = "default" | "muted" | "primary" | "accent";

export interface SectionBlockContent {
  title?: string | null;
  background?: SectionBackground;
}

export type RowColumnCount = 1 | 2 | 3;

export interface RowBlockContent {
  /** Number of equal-width columns laid out horizontally on desktop. */
  column_count: RowColumnCount;
}

export type ContainerMaxWidth = "sm" | "md" | "lg" | "xl" | "full";

export interface ContainerBlockContent {
  max_width: ContainerMaxWidth;
}

export type DividerStyle = "solid" | "dashed";

export interface DividerBlockContent {
  style: DividerStyle;
}

export interface SpacerBlockContent {
  height_px: number;
}

export type LessonBlockContent =
  | TextBlockContent
  | TableBlockContent
  | VideoBlockContent
  | ImageBlockContent
  | GalleryBlockContent
  | FileBlockContent
  | QuizBlockContent
  | AssignmentBlockContent
  | CalloutBlockContent
  | KeyPointsBlockContent
  | ChecklistBlockContent
  | BulletListBlockContent
  | ButtonBlockContent
  | ExerciseBlockContent
  | SelfAssessmentBlockContent
  | WorkDepositBlockContent
  | SectionBlockContent
  | RowBlockContent
  | ContainerBlockContent
  | DividerBlockContent
  | SpacerBlockContent
  | ShortcodeBlockContent
  | HtmlEmbedBlockContent
  | TimelineBlockContent
  | FlipCardsBlockContent
  | AccordionBlockContent
  | ImageHotspotBlockContent
  | BeforeAfterBlockContent
  | FillBlanksBlockContent
  | DragWordsBlockContent
  | SummaryBlockContent;

export interface LessonBlock {
  id: string;
  lesson_id: string;
  type: LessonBlockType;
  kind: LessonBlockKind;
  parent_block_id: string | null;
  position: number;
  hidden: boolean;
  content: LessonBlockContent;
  created_at: string;
  updated_at: string;
}

export interface CreateLessonBlockInput {
  lesson_id: string;
  type: LessonBlockType;
  kind: LessonBlockKind;
  parent_block_id?: string | null;
  position: number;
  content: LessonBlockContent;
}

export interface UpdateLessonBlockInput {
  type?: LessonBlockType;
  kind?: LessonBlockKind;
  parent_block_id?: string | null;
  position?: number;
  hidden?: boolean;
  content?: LessonBlockContent;
}

/** Default content for a freshly inserted block of the given type. */
export function defaultBlockContent(type: LessonBlockType): LessonBlockContent {
  switch (type) {
    case "text":
      return { html: "" };
    case "table":
      return { html: '<table><tbody><tr><th>Colonne 1</th><th>Colonne 2</th><th>Colonne 3</th></tr><tr><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td></tr></tbody></table>' };
    case "video":
      return { url: null, duration_seconds: null };
    case "image":
      return { url: null, caption_html: null };
    case "gallery":
      return { images: [], mode: "grid", columns: 3 };
    case "file":
      return { url: null, name: null, size: null, description_html: null };
    case "quiz":
      return { quiz_id: null };
    case "assignment":
      return { assignment_id: null, instructions_html: null };
    case "callout":
      return { color: "blue", title: null, body_html: "" };
    case "key_points":
      return { title: "À retenir", items: [""] };
    case "checklist":
      return { title: null, items: [{ id: cryptoRandomId(), label: "" }] };
    case "bullet_list":
      return { title: null, items: [""], bullet_style: "round", bullet_color: null, text_color: null, item_spacing: "normal" };
    case "button":
      return { label: "En savoir plus", url: "", variant: "primary", open_in_new_tab: true };
    case "exercise":
      return { prompt_html: "", answer_html: "" };
    case "self_assessment":
      return {
        prompt: "Comment évaluez-vous votre maîtrise de cette leçon ?",
        scale: "labels",
        labels: ["Pas du tout", "Un peu", "Bien", "Très bien", "Maîtrisé"],
      };
    case "work_deposit":
      return {
        title: "Déposer mon travail",
        instructions_html: null,
        expected_deliverable: null,
        accepted_formats: ["jpg", "png", "pdf", "video"],
        max_size_mb: 50,
        sharing_allowed: true,
        comments_enabled: true,
        feedback_enabled: true,
      };
    case "section":
      return { title: null, background: "default" };
    case "row":
      return { column_count: 2 };
    case "container":
      return { max_width: "lg" };
    case "divider":
      return { style: "solid" };
    case "spacer":
      return { height_px: 24 };
    case "shortcode":
      return { code: "besoins", course_id: null, title: null };
    case "html_embed":
      return { html: "", title: null };
    case "timeline":
      return {
        steps: [
          { id: cryptoRandomId(), title: "Étape 1", description: "", panel_title: "Exemples d'usages", panel_items: [] },
          { id: cryptoRandomId(), title: "Étape 2", description: "", panel_title: "Exemples d'usages", panel_items: [] },
          { id: cryptoRandomId(), title: "Étape 3", description: "", panel_title: "Exemples d'usages", panel_items: [] },
        ],
        accent_color: null,
      };
    case "flip_cards":
      return {
        cards: [
          { id: cryptoRandomId(), front_text: "Recto", back_text: "Verso" },
          { id: cryptoRandomId(), front_text: "Recto", back_text: "Verso" },
        ],
        card_height_px: 180,
      };
    case "accordion":
      return {
        title: null,
        items: [
          { id: cryptoRandomId(), question: "Question 1", answer_html: "" },
          { id: cryptoRandomId(), question: "Question 2", answer_html: "" },
        ],
      };
    case "image_hotspot":
      return { image_url: null, hotspots: [] };
    case "before_after":
      return { before_image_url: null, after_image_url: null, before_label: "Avant", after_label: "Après", caption: null };
    case "fill_blanks":
      return { title: null, instructions: null, text: "" };
    case "drag_words":
      return { title: null, instructions: null, text: "" };
    case "summary":
      return {
        title: "Cochez les affirmations exactes",
        instructions: null,
        statements: [
          { id: cryptoRandomId(), text: "Affirmation 1", is_correct: true },
          { id: cryptoRandomId(), text: "Affirmation 2", is_correct: false },
          { id: cryptoRandomId(), text: "Affirmation 3", is_correct: true },
        ],
      };
  }
}

/** Example content for each block type. Returns null for blocks without meaningful examples (quiz, video, layout). */
export function exampleBlockContent(type: LessonBlockType): LessonBlockContent | null {
  switch (type) {
    case "text":
      return {
        html: "<h2>Introduction</h2><p>Dans cette section, vous découvrirez les concepts fondamentaux qui vous permettront de progresser efficacement. Prenez le temps de lire attentivement chaque partie avant de passer à la suite.</p>",
      };
    case "image":
      return {
        url: null,
        caption_html: "<p>Légende — décrivez ici le contenu de l'image</p>",
      };
    case "gallery":
      return {
        images: [{ url: null }, { url: null }, { url: null }],
        mode: "grid",
        columns: 3,
      };
    case "file":
      return {
        url: null,
        name: "Guide pratique — Module 1.pdf",
        size: null,
        description_html: "<p>Téléchargez ce document pour approfondir les notions abordées dans cette leçon.</p>",
      };
    case "assignment":
      return {
        assignment_id: null,
        instructions_html: "<p>Rédigez un document de synthèse (1 à 2 pages) résumant les points clés de ce module. Appuyez-vous sur vos notes et les ressources partagées.</p>",
      };
    case "callout":
      return {
        color: "blue",
        title: "À noter",
        body_html: "<p>Retenez bien ce point essentiel : chaque concept présenté s'appuie sur les notions précédentes. Ne sautez pas les étapes !</p>",
      };
    case "key_points":
      return {
        title: "À retenir",
        items: [
          "Comprendre les bases avant d'aller plus loin.",
          "Pratiquer régulièrement pour ancrer les connaissances.",
          "Ne pas hésiter à revenir sur les notions difficiles.",
        ],
      };
    case "checklist":
      return {
        title: "Avant de continuer, vérifiez que vous avez :",
        items: [
          { id: cryptoRandomId(), label: "Lu attentivement la partie précédente" },
          { id: cryptoRandomId(), label: "Noté les points clés dans votre carnet" },
          { id: cryptoRandomId(), label: "Posé vos questions en commentaire" },
        ],
      };
    case "bullet_list":
      return {
        title: "Points importants",
        items: ["Premier point clé à retenir", "Deuxième point clé", "Troisième point clé"],
        bullet_style: "round",
        bullet_color: "#FFD100",
        item_spacing: "normal",
      };
    case "button":
      return { label: "En savoir plus", url: "https://example.com", variant: "primary", open_in_new_tab: true };
    case "exercise":
      return {
        prompt_html: "<p><strong>Exercice :</strong> En vous basant sur ce que vous venez d'apprendre, rédigez en 3 à 5 phrases les grandes étapes du processus décrit dans ce module.</p>",
        answer_html: "<p><em>[Complétez ici avec un exemple de réponse attendue]</em></p>",
      };
    case "self_assessment":
      return {
        prompt: "Comment évaluez-vous votre niveau de compréhension sur cette section ?",
        scale: "stars",
        labels: ["Très difficile", "Difficile", "Assez bien", "Bien", "Très bien"],
      };
    case "work_deposit":
      return {
        title: "Déposer mon travail",
        instructions_html: "<p>Déposez ici votre document de synthèse. Nommez votre fichier avec votre prénom et le titre du module (ex. : <strong>Prénom_NomDuModule.pdf</strong>).</p>",
        expected_deliverable: "<p>Un fichier PDF ou Word, 2 pages maximum.</p>",
        accepted_formats: ["pdf", "docx"],
        max_size_mb: 10,
        sharing_allowed: true,
        comments_enabled: true,
        feedback_enabled: true,
      };
    case "html_embed":
      return {
        html: '<iframe src="https://www.linkedin.com/embed/feed/update/urn:li:share:example" height="400" width="100%" frameborder="0" allowfullscreen title="Post intégré"></iframe>',
        title: "Publication LinkedIn",
      };
    case "timeline":
      return {
        steps: [
          { id: cryptoRandomId(), title: "Je dessine pour moi", description: "Je m'entraîne sans pression, pour apprendre, mémoriser ou clarifier mes idées.", panel_title: "Exemples d'usages", panel_items: [{ id: cryptoRandomId(), label: "Prendre des notes visuelles" }, { id: cryptoRandomId(), label: "Clarifier une idée complexe" }] },
          { id: cryptoRandomId(), title: "Je prépare un visuel", description: "Je construis un support en amont, à mon rythme, pour mieux expliquer ou transmettre.", panel_title: "Exemples d'usages", panel_items: [{ id: cryptoRandomId(), label: "Préparer une affiche pédagogique" }, { id: cryptoRandomId(), label: "Créer un ordre du jour visuel" }, { id: cryptoRandomId(), label: "Illustrer une présentation" }] },
          { id: cryptoRandomId(), title: "Je dessine avec les autres", description: "J'utilise le visuel pour accompagner une personne ou aider un groupe à réfléchir.", panel_title: "Exemples d'usages", panel_items: [{ id: cryptoRandomId(), label: "Faciliter un atelier" }, { id: cryptoRandomId(), label: "Animer une réunion" }] },
        ],
        accent_color: null,
      };
    case "flip_cards":
      return {
        cards: [
          { id: cryptoRandomId(), front_text: "Qu'est-ce que la facilitation visuelle ?", back_text: "C'est l'art d'utiliser le dessin et la mise en forme visuelle pour rendre les idées plus claires et mémorables." },
          { id: cryptoRandomId(), front_text: "Quand utiliser une frise chronologique ?", back_text: "Quand vous souhaitez montrer une progression, des étapes séquentielles ou un parcours dans le temps." },
          { id: cryptoRandomId(), front_text: "Quelle est la règle des 3 C ?", back_text: "Clair, Concis, Cohérent — les trois critères d'un visuel efficace en facilitation." },
        ],
        card_height_px: 180,
      };
    case "accordion":
      return {
        title: "Questions fréquentes",
        items: [
          { id: cryptoRandomId(), question: "À quoi sert la facilitation visuelle ?", answer_html: "<p>Elle permet de rendre les idées plus accessibles, de favoriser la mémorisation et d'engager davantage les participants lors d'ateliers ou de formations.</p>" },
          { id: cryptoRandomId(), question: "Faut-il savoir dessiner pour l'utiliser ?", answer_html: "<p>Non ! La facilitation visuelle repose sur des formes simples : rectangles, cercles, flèches et quelques pictogrammes de base. Le message prime sur l'esthétique.</p>" },
          { id: cryptoRandomId(), question: "Quels outils utiliser pour démarrer ?", answer_html: "<p>Un simple marqueur noir et une feuille blanche suffisent. Vous pouvez ensuite ajouter des post-its colorés et quelques marqueurs de couleur pour structurer l'information.</p>" },
        ],
      };
    case "image_hotspot":
      return { image_url: null, hotspots: [] };
    case "before_after":
      return {
        before_image_url: null,
        after_image_url: null,
        before_label: "Avant",
        after_label: "Après",
        caption: "Comparez les deux états en déplaçant le curseur",
      };
    case "fill_blanks":
      return {
        title: "Complétez le texte",
        instructions: "Saisissez les mots manquants dans les trous.",
        text: "La facilitation visuelle permet de {{mémoriser}} plus facilement les informations en les rendant {{visuelles}}. Elle est particulièrement utile lors des {{ateliers}} collaboratifs.",
      };
    case "drag_words":
      return {
        title: "Replacez les mots dans le bon contexte",
        instructions: "Cliquez sur un mot puis sur l'emplacement où le placer.",
        text: "Un bon facilitateur visuel utilise des *formes simples* pour rendre les idées *accessibles*. Il n'est pas nécessaire d'être *artiste* pour pratiquer cette technique.",
      };
    case "summary":
      return {
        title: "Bilan — cochez les affirmations exactes",
        instructions: "Sélectionnez toutes les affirmations vraies, puis vérifiez vos réponses.",
        statements: [
          { id: cryptoRandomId(), text: "La facilitation visuelle améliore la mémorisation des informations.", is_correct: true },
          { id: cryptoRandomId(), text: "Il faut être artiste pour utiliser la facilitation visuelle.", is_correct: false },
          { id: cryptoRandomId(), text: "Des formes simples comme des cercles et des flèches suffisent.", is_correct: true },
          { id: cryptoRandomId(), text: "La facilitation visuelle ne fonctionne que sur support numérique.", is_correct: false },
          { id: cryptoRandomId(), text: "Elle peut être utilisée aussi bien en atelier qu'en formation.", is_correct: true },
        ],
      };
    default:
      return null;
  }
}

/** Returns the kind ('layout' | 'content') of a block type. */
export function blockKindOf(type: LessonBlockType): LessonBlockKind {
  return isLayoutBlockType(type) ? "layout" : "content";
}

function cryptoRandomId(): string {
  if (typeof globalThis.crypto !== "undefined" && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

export { cryptoRandomId };
