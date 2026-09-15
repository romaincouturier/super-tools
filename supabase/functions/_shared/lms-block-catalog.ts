/**
 * Catalogue pédagogique des blocs LMS partagé entre le serveur MCP et
 * l'agent intégré. Définit : les champs attendus par type, les conseils
 * d'usage pédagogique, et un sanitizer/validateur minimal pour les
 * écritures via MCP.
 *
 * Seuls les blocs de contenu "feuilles" sont modifiables par ce canal ;
 * les blocs de mise en page, quiz, devoirs, HTML libre et médias sont
 * listés comme non éditables.
 */

export type FieldType = "html" | "plain" | "string" | "string[]" | "items" | "boolean" | "number" | "enum" | "object" | "object[]";

export interface CatalogField {
  name: string;
  type: FieldType;
  required: boolean;
  description: string;
  enum?: string[];
}

export interface CatalogEntry {
  type: string;
  kind: "content" | "layout" | "media" | "assessment" | "embed";
  labelFr: string;
  editableViaMcp: boolean;
  fields: CatalogField[];
  guidance: {
    whenToUse: string;
    whenNotToUse: string;
    example?: string;
  };
}

const ALLOWED_TAGS = new Set([
  "a",
  "abbr",
  "b",
  "blockquote",
  "br",
  "caption",
  "cite",
  "code",
  "col",
  "colgroup",
  "dd",
  "del",
  "dfn",
  "div",
  "dl",
  "dt",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "ins",
  "kbd",
  "li",
  "mark",
  "ol",
  "p",
  "pre",
  "q",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "time",
  "tr",
  "u",
  "ul",
  "var",
]);

const ALLOWED_ATTRS = new Set(["href", "title", "target", "src", "alt", "class"]);

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Sanitize HTML by keeping only allowed tags and attributes. Tags not in the
 * allowlist are stripped (content preserved). Event handlers and dangerous
 * href/src are removed. Plain text without markup is escaped.
 */
export function sanitizeHtml(value: string): string {
  const noScript = value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  return noScript.replace(/<\/?[^>]+>/g, (tag) => {
    const m = tag.match(/^<\/?([a-zA-Z0-9]+)([^>]*)>$/);
    if (!m) return "";
    const tagName = m[1].toLowerCase();
    const isClose = tag.startsWith("</");
    if (!ALLOWED_TAGS.has(tagName)) return "";
    if (isClose) return `</${tagName}>`;

    const attrPart = m[2];
    let cleanAttrs = "";
    const attrRe = /([a-zA-Z-:]+)(?:=(?:"([^"]*)"|'([^']*)'|([^ \t\n"'>=]*)))?/g;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(attrPart)) !== null) {
      const name = am[1].toLowerCase();
      if (name.startsWith("on")) continue;
      if (!ALLOWED_ATTRS.has(name)) continue;
      const val = am[2] ?? am[3] ?? am[4] ?? "";
      if (name === "href" || name === "src") {
        const trimmed = val.trim();
        if (
          !/^https?:\/\//i.test(trimmed) &&
          !trimmed.startsWith("#") &&
          !trimmed.startsWith("mailto:")
        ) {
          continue;
        }
      }
      cleanAttrs += ` ${name}="${escapeAttr(val)}"`;
    }
    return `<${tagName}${cleanAttrs}>`;
  });
}

export function sanitizePlainText(value: string): string {
  return escapeHtml(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const EDITABLE_TYPES: readonly string[] = [
  "text",
  "callout",
  "key_points",
  "bullet_list",
  "checklist",
  "exercise",
  "code",
  "accordion",
  "summary",
  "timeline",
  "flip_cards",
];

const CATALOG: CatalogEntry[] = [
  {
    type: "text",
    kind: "content",
    labelFr: "Texte libre",
    editableViaMcp: true,
    fields: [{ name: "html", type: "html", required: true, description: "Contenu HTML du bloc (titres, paragraphes, listes)" }],
    guidance: {
      whenToUse: "Narration, introduction, explications, transitions. C'est le bloc par défaut quand le contenu est avant tout du texte.",
      whenNotToUse: "Ne pas enchaîner des paragraphes très denses sans aucune structuration ; préférer des blocs spécialisés pour les points clés ou les exercices.",
      example: "<h2>La règle des 3 C</h2><p>Clair, Concis, Cohérent…</p>",
    },
  },
  {
    type: "callout",
    kind: "content",
    labelFr: "Encadré",
    editableViaMcp: true,
    fields: [
      { name: "body_html", type: "html", required: true, description: "Corps de l'encadré" },
      { name: "title", type: "plain", required: false, description: "Titre optionnel de l'encadré" },
      { name: "color", type: "enum", required: false, description: "Couleur de l'encadré", enum: ["blue", "amber", "green", "red", "gray", "supertilt_yellow", "teal", "coral"] },
      { name: "level", type: "enum", required: false, description: "Niveau sémantique", enum: ["info", "warning", "tip", "example", "resource"] },
    ],
    guidance: {
      whenToUse: "Mettre en valeur une définition, un avertissement, un conseil, un exemple ou une ressource. Très utile pour casser la linéarité du texte.",
      whenNotToUse: "Ne pas remplacer un titre ou un point clé par un encadré ; l'encadré doit ajouter une nuance, pas porter la structure principale.",
    },
  },
  {
    type: "key_points",
    kind: "content",
    labelFr: "Points clés",
    editableViaMcp: true,
    fields: [
      { name: "items", type: "string[]", required: true, description: "Liste des points clés (chaîne simple par élément)" },
      { name: "title", type: "plain", required: false, description: "Titre optionnel, ex. 'À retenir'" },
    ],
    guidance: {
      whenToUse: "Synthétiser 3 à 7 idées essentielles à la fin d'une section ou d'une leçon.",
      whenNotToUse: "Ne pas l'utiliser pour une simple liste d'actions ou une procédure ; préférer 'Liste à cocher' ou 'Liste à puces'.",
    },
  },
  {
    type: "bullet_list",
    kind: "content",
    labelFr: "Liste à puces",
    editableViaMcp: true,
    fields: [
      { name: "items", type: "string[]", required: true, description: "Éléments de la liste" },
      { name: "title", type: "plain", required: false, description: "Titre optionnel" },
      { name: "bullet_style", type: "enum", required: false, description: "Style de puce", enum: ["round", "square", "check", "arrow", "star", "diamond"] },
    ],
    guidance: {
      whenToUse: "Lister des éléments connexes sans ordre strict : avantages, exemples, pièges, ressources.",
      whenNotToUse: "Ne pas utiliser pour une séquence d'étapes à suivre ; préférer 'Liste à cocher' ou 'Frise'.",
    },
  },
  {
    type: "checklist",
    kind: "content",
    labelFr: "Liste à cocher",
    editableViaMcp: true,
    fields: [
      { name: "items", type: "object[]", required: true, description: "Tableau d'objets {id, label}" },
      { name: "title", type: "plain", required: false, description: "Titre optionnel" },
    ],
    guidance: {
      whenToUse: "Donner une procédure concrete à suivre ou des prérequis à vérifier par l'apprenant.",
      whenNotToUse: "Ne pas l'utiliser pour une simple énumération informative sans action associée.",
    },
  },
  {
    type: "exercise",
    kind: "content",
    labelFr: "Exercice / Mise en pratique",
    editableViaMcp: true,
    fields: [
      { name: "prompt_html", type: "html", required: true, description: "Consigne de l'exercice" },
      { name: "answer_html", type: "html", required: false, description: "Corrigé ou éléments de réponse" },
    ],
    guidance: {
      whenToUse: "Chaque fois qu'une notion peut être appliquée : transformer une explication en consigne actionnable.",
      whenNotToUse: "Ne pas mettre un exercice sans contexte ; il doit suivre l'explication qu'il illustre.",
    },
  },
  {
    type: "code",
    kind: "content",
    labelFr: "Bloc de code",
    editableViaMcp: true,
    fields: [
      { name: "code", type: "string", required: true, description: "Code source" },
      { name: "language", type: "string", required: true, description: "Langage (ex. javascript, python, bash)" },
      { name: "title", type: "plain", required: false, description: "Titre optionnel" },
      { name: "showLineNumbers", type: "boolean", required: false, description: "Afficher la numérotation" },
    ],
    guidance: {
      whenToUse: "Partager une commande, un script, une requête ou un extrait de code à copier.",
      whenNotToUse: "Ne pas utiliser pour du texte explicatif général ; réserver aux extraits de code réels.",
    },
  },
  {
    type: "accordion",
    kind: "content",
    labelFr: "Accordéon",
    editableViaMcp: true,
    fields: [
      { name: "items", type: "object[]", required: true, description: "Tableau d'objets {id, question, answer_html}" },
      { name: "title", type: "plain", required: false, description: "Titre global optionnel" },
    ],
    guidance: {
      whenToUse: "Compléments, approfondissements, FAQ, détails techniques que l'apprenant peut déplier à sa guise.",
      whenNotToUse: "Ne pas y placer l'information essentielle de la leçon ; l'accordéon est du replié par défaut.",
    },
  },
  {
    type: "summary",
    kind: "content",
    labelFr: "Bilan / Affirmations",
    editableViaMcp: true,
    fields: [
      { name: "statements", type: "object[]", required: true, description: "Tableau {id, text, is_correct}" },
      { name: "title", type: "plain", required: false, description: "Titre optionnel" },
      { name: "instructions", type: "html", required: false, description: "Consigne" },
    ],
    guidance: {
      whenToUse: "Faire le point sous forme d'affirmations à valider/débunker en fin de section.",
      whenNotToUse: "Ne pas remplacer un quiz noté par un bilan ; ce bloc est auto-évaluatif.",
    },
  },
  {
    type: "timeline",
    kind: "content",
    labelFr: "Frise chronologique",
    editableViaMcp: true,
    fields: [
      { name: "steps", type: "object[]", required: true, description: "Tableau {id, title, description?, panel_title?, panel_items?: {id, label}[]}" },
    ],
    guidance: {
      whenToUse: "Montrer une progression, une séquence d'étapes ou un parcours dans le temps.",
      whenNotToUse: "Ne pas l'utiliser pour une simple liste non séquentielle.",
    },
  },
  {
    type: "flip_cards",
    kind: "content",
    labelFr: "Cartes à retourner",
    editableViaMcp: true,
    fields: [
      { name: "cards", type: "object[]", required: true, description: "Tableau {id, front_text, back_text}" },
    ],
    guidance: {
      whenToUse: "Mémorisation par paires (concept / définition, mot / traduction, principe / exemple).",
      whenNotToUse: "Ne pas utiliser pour du texte narratif long.",
    },
  },
  // Non-éditables — listés pour que Claude connaisse la palette complète
  {
    type: "section",
    kind: "layout",
    labelFr: "Section",
    editableViaMcp: false,
    fields: [{ name: "title", type: "plain", required: false, description: "Titre de section" }, { name: "background", type: "enum", required: false, description: "Fond", enum: ["default", "muted", "primary", "accent"] }],
    guidance: { whenToUse: "Grouper visuellement plusieurs blocs.", whenNotToUse: "Non modifiable via MCP." },
  },
  {
    type: "row",
    kind: "layout",
    labelFr: "Ligne / colonnes",
    editableViaMcp: false,
    fields: [{ name: "column_count", type: "number", required: true, description: "Nombre de colonnes (1-3)" }],
    guidance: { whenToUse: "Disposer des blocs côte à côte.", whenNotToUse: "Non modifiable via MCP." },
  },
  {
    type: "container",
    kind: "layout",
    labelFr: "Conteneur",
    editableViaMcp: false,
    fields: [{ name: "max_width", type: "enum", required: true, description: "Largeur max", enum: ["sm", "md", "lg", "xl", "full"] }],
    guidance: { whenToUse: "Limiter la largeur d'un groupe de blocs.", whenNotToUse: "Non modifiable via MCP." },
  },
  {
    type: "reveal",
    kind: "layout",
    labelFr: "Contenu progressif",
    editableViaMcp: false,
    fields: [{ name: "button_label", type: "plain", required: true, description: "Libellé du bouton" }],
    guidance: { whenToUse: "Révéler du contenu progressivement dans le player.", whenNotToUse: "Non modifiable via MCP." },
  },
  {
    type: "divider",
    kind: "layout",
    labelFr: "Séparateur",
    editableViaMcp: false,
    fields: [{ name: "style", type: "enum", required: true, description: "Style de trait", enum: ["solid", "dashed"] }],
    guidance: { whenToUse: "Séparer visuellement deux sections.", whenNotToUse: "Non modifiable via MCP." },
  },
  {
    type: "spacer",
    kind: "layout",
    labelFr: "Espacement",
    editableViaMcp: false,
    fields: [{ name: "height_px", type: "number", required: true, description: "Hauteur en pixels" }],
    guidance: { whenToUse: "Créer un espace vertical.", whenNotToUse: "Non modifiable via MCP." },
  },
  {
    type: "quiz",
    kind: "assessment",
    labelFr: "Quiz",
    editableViaMcp: false,
    fields: [{ name: "quiz_id", type: "string", required: true, description: "ID du quiz" }],
    guidance: { whenToUse: "Évaluation notée avec score.", whenNotToUse: "Hors scope MCP v1." },
  },
  {
    type: "assignment",
    kind: "assessment",
    labelFr: "Devoir",
    editableViaMcp: false,
    fields: [{ name: "assignment_id", type: "string", required: true, description: "ID du devoir" }],
    guidance: { whenToUse: "Travail à rendre et à évaluer.", whenNotToUse: "Hors scope MCP v1." },
  },
  {
    type: "html_embed",
    kind: "embed",
    labelFr: "HTML / iframe",
    editableViaMcp: false,
    fields: [{ name: "html", type: "string", required: true, description: "HTML brut" }],
    guidance: { whenToUse: "Intégration externe.", whenNotToUse: "Hors scope MCP v1 (risque de contenu arbitraire)." },
  },
  {
    type: "video",
    kind: "media",
    labelFr: "Vidéo",
    editableViaMcp: false,
    fields: [{ name: "url", type: "string", required: false, description: "URL de la vidéo" }],
    guidance: { whenToUse: "Média vidéo.", whenNotToUse: "Hors scope MCP v1." },
  },
  {
    type: "image",
    kind: "media",
    labelFr: "Image",
    editableViaMcp: false,
    fields: [{ name: "url", type: "string", required: false, description: "URL de l'image" }],
    guidance: { whenToUse: "Image seule.", whenNotToUse: "Hors scope MCP v1." },
  },
  {
    type: "gallery",
    kind: "media",
    labelFr: "Galerie",
    editableViaMcp: false,
    fields: [{ name: "images", type: "object[]", required: true, description: "Tableau d'images" }],
    guidance: { whenToUse: "Galerie d'images.", whenNotToUse: "Hors scope MCP v1." },
  },
  {
    type: "file",
    kind: "media",
    labelFr: "Fichier",
    editableViaMcp: false,
    fields: [{ name: "files", type: "object[]", required: false, description: "Fichiers" }],
    guidance: { whenToUse: "Ressource téléchargeable.", whenNotToUse: "Hors scope MCP v1." },
  },
  {
    type: "button",
    kind: "content",
    labelFr: "Bouton",
    editableViaMcp: false,
    fields: [{ name: "label", type: "plain", required: true, description: "Libellé" }, { name: "url", type: "string", required: true, description: "URL" }],
    guidance: { whenToUse: "Appel à l'action.", whenNotToUse: "Hors scope MCP v1." },
  },
  {
    type: "cta",
    kind: "content",
    labelFr: "Bloc mise en avant",
    editableViaMcp: false,
    fields: [{ name: "title", type: "plain", required: false, description: "Titre" }, { name: "body_html", type: "html", required: false, description: "Texte" }],
    guidance: { whenToUse: "Mise en avant promotionnelle.", whenNotToUse: "Hors scope MCP v1." },
  },
  {
    type: "self_assessment",
    kind: "assessment",
    labelFr: "Auto-évaluation",
    editableViaMcp: false,
    fields: [{ name: "prompt", type: "plain", required: true, description: "Question" }],
    guidance: { whenToUse: "Auto-évaluation sans bonne réponse.", whenNotToUse: "Hors scope MCP v1." },
  },
  {
    type: "work_deposit",
    kind: "assessment",
    labelFr: "Dépôt de travaux",
    editableViaMcp: false,
    fields: [{ name: "title", type: "plain", required: false, description: "Titre" }],
    guidance: { whenToUse: "Demander un fichier à l'apprenant.", whenNotToUse: "Hors scope MCP v1." },
  },
  {
    type: "table",
    kind: "content",
    labelFr: "Tableau",
    editableViaMcp: false,
    fields: [{ name: "html", type: "html", required: true, description: "HTML du tableau" }],
    guidance: { whenToUse: "Données tabulaires.", whenNotToUse: "Hors scope MCP v1." },
  },
  {
    type: "image_hotspot",
    kind: "media",
    labelFr: "Image interactive",
    editableViaMcp: false,
    fields: [{ name: "image_url", type: "string", required: false, description: "URL image" }],
    guidance: { whenToUse: "Image avec zones cliquables.", whenNotToUse: "Hors scope MCP v1." },
  },
  {
    type: "before_after",
    kind: "media",
    labelFr: "Avant / Après",
    editableViaMcp: false,
    fields: [{ name: "before_image_url", type: "string", required: false, description: "URL image avant" }],
    guidance: { whenToUse: "Comparaison visuelle.", whenNotToUse: "Hors scope MCP v1." },
  },
  {
    type: "fill_blanks",
    kind: "assessment",
    labelFr: "Texte à trous",
    editableViaMcp: false,
    fields: [{ name: "text", type: "string", required: true, description: "Texte avec {{réponses}}" }],
    guidance: { whenToUse: "Exercice de complétion.", whenNotToUse: "Hors scope MCP v1." },
  },
  {
    type: "drag_words",
    kind: "assessment",
    labelFr: "Glisser-déposer mots",
    editableViaMcp: false,
    fields: [{ name: "text", type: "string", required: true, description: "Texte avec *mots*" }],
    guidance: { whenToUse: "Réordonner ou placer des mots.", whenNotToUse: "Hors scope MCP v1." },
  },
  {
    type: "shortcode",
    kind: "embed",
    labelFr: "Formulaire intégré",
    editableViaMcp: false,
    fields: [{ name: "code", type: "enum", required: true, description: "Type de formulaire", enum: ["besoins", "evaluation"] }],
    guidance: { whenToUse: "Intégrer un formulaire SuperTools.", whenNotToUse: "Hors scope MCP v1." },
  },
];

export function getBlockCatalog(): CatalogEntry[] {
  return CATALOG;
}

export function getEditableCatalog(): CatalogEntry[] {
  return CATALOG.filter((e) => e.editableViaMcp);
}

export function getCatalogEntry(type: string): CatalogEntry | undefined {
  return CATALOG.find((e) => e.type === type);
}

export function isEditableBlockType(type: string): boolean {
  return EDITABLE_TYPES.includes(type);
}

/**
 * Pick only the textual/HTML fields defined in the catalog for a given type.
 * Returns a sanitized content object suitable for an UPDATE.
 */
export function sanitizeUpdatePatch(type: string, input: Record<string, unknown>): Record<string, unknown> {
  const entry = getCatalogEntry(type);
  if (!entry || !entry.editableViaMcp) {
    throw new Error(`Type "${type}" is not editable via MCP`);
  }

  const patch: Record<string, unknown> = {};
  for (const field of entry.fields) {
    if (!(field.name in input)) continue;
    const value = input[field.name];
    if (value === null || value === undefined) {
      patch[field.name] = null;
      continue;
    }
    if (field.type === "html") {
      patch[field.name] = sanitizeHtml(String(value));
    } else if (field.type === "plain" || field.type === "string") {
      patch[field.name] = sanitizePlainText(String(value));
    } else if (field.type === "string[]") {
      patch[field.name] = (Array.isArray(value) ? value : [value]).map((v) =>
        typeof v === "string" ? sanitizePlainText(v) : ""
      );
    } else if (field.type === "object[]" && type === "checklist") {
      // keep id, sanitize label
      patch[field.name] = (Array.isArray(value) ? value : [value]).map((item) => {
        const obj = isPlainObject(item) ? item : { id: "", label: "" };
        return {
          id: typeof obj.id === "string" ? obj.id : String(obj.id ?? ""),
          label: typeof obj.label === "string" ? sanitizePlainText(obj.label) : "",
        };
      });
    }
  }
  return patch;
}

function coerceToArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function sanitizeObjectArray(value: unknown, itemShape: CatalogField[]): unknown[] {
  return coerceToArray(value).map((item) => {
    const obj = isPlainObject(item) ? { ...item } : {};
    const out: Record<string, unknown> = {};
    for (const f of itemShape) {
      if (!(f.name in obj)) continue;
      const v = obj[f.name];
      if (v === null || v === undefined) {
        out[f.name] = null;
      } else if (f.type === "html") {
        out[f.name] = sanitizeHtml(String(v));
      } else if (f.type === "plain" || f.type === "string" || f.type === "enum") {
        out[f.name] = sanitizePlainText(String(v));
      } else if (f.type === "string[]") {
        out[f.name] = coerceToArray(v).map((x) => (typeof x === "string" ? sanitizePlainText(x) : ""));
      } else if (f.type === "object[]") {
        // nested arrays not supported here
        out[f.name] = [];
      } else if (f.type === "boolean") {
        out[f.name] = Boolean(v);
      } else if (f.type === "number") {
        const n = Number(v);
        out[f.name] = Number.isNaN(n) ? 0 : n;
      }
    }
    return out;
  });
}

const ITEM_SHAPES: Record<string, CatalogField[]> = {
  checklist: [{ name: "id", type: "string", required: true, description: "" }, { name: "label", type: "plain", required: true, description: "" }],
  accordion: [{ name: "id", type: "string", required: true, description: "" }, { name: "question", type: "plain", required: true, description: "" }, { name: "answer_html", type: "html", required: true, description: "" }],
  summary: [{ name: "id", type: "string", required: true, description: "" }, { name: "text", type: "plain", required: true, description: "" }, { name: "is_correct", type: "boolean", required: true, description: "" }],
  timeline: [{ name: "id", type: "string", required: true, description: "" }, { name: "title", type: "plain", required: true, description: "" }, { name: "description", type: "plain", required: false, description: "" }, { name: "panel_title", type: "plain", required: false, description: "" }],
  flip_cards: [{ name: "id", type: "string", required: true, description: "" }, { name: "front_text", type: "plain", required: false, description: "" }, { name: "back_text", type: "plain", required: false, description: "" }],
};

/**
 * Validate and sanitize a full block (type + content) intended for insertion
 * via apply_lesson_restructure. Throws if a required field is missing or if
 * the type is not in the editable whitelist.
 */
export function sanitizeNewBlock(type: string, content: Record<string, unknown>): { type: string; content: Record<string, unknown> } {
  if (!isEditableBlockType(type)) {
    throw new Error(`Block type "${type}" is not allowed for restructuring`);
  }
  const entry = getCatalogEntry(type);
  if (!entry) throw new Error(`Unknown block type "${type}"`);

  const sanitized: Record<string, unknown> = {};
  for (const field of entry.fields) {
    if (!(field.name in content) || content[field.name] === null || content[field.name] === undefined) {
      if (field.required) {
        throw new Error(`Missing required field "${field.name}" for block type "${type}"`);
      }
      continue;
    }
    const v = content[field.name];
    if (field.type === "html") {
      sanitized[field.name] = sanitizeHtml(String(v));
    } else if (field.type === "plain" || field.type === "string" || field.type === "enum") {
      sanitized[field.name] = field.type === "html" ? sanitizeHtml(String(v)) : sanitizePlainText(String(v));
    } else if (field.type === "boolean") {
      sanitized[field.name] = Boolean(v);
    } else if (field.type === "number") {
      const n = Number(v);
      sanitized[field.name] = Number.isNaN(n) ? 0 : n;
    } else if (field.type === "string[]") {
      sanitized[field.name] = coerceToArray(v).map((x) => (typeof x === "string" ? sanitizePlainText(x) : ""));
    } else if (field.type === "object[]") {
      const shape = ITEM_SHAPES[type];
      if (!shape) throw new Error(`Object array field "${field.name}" not supported for type "${type}"`);
      sanitized[field.name] = sanitizeObjectArray(v, shape);
    }
  }
  return { type, content: sanitized };
}

export function sanitizeRestructureBlocks(blocks: unknown[]): { type: string; content: Record<string, unknown>; hidden?: boolean }[] {
  return blocks.map((b) => {
    const obj = isPlainObject(b) ? b : {};
    const type = String(obj.type || "");
    const content = isPlainObject(obj.content) ? obj.content : {};
    const hidden = obj.hidden === true;
    const sanitized = sanitizeNewBlock(type, content);
    return hidden ? { ...sanitized, hidden } : sanitized;
  });
}
