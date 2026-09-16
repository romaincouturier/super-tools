/**
 * Catalogue pédagogique des blocs LMS partagé entre le serveur MCP et
 * l'agent intégré. Définit : les champs attendus par type, les conseils
 * d'usage pédagogique, et un sanitizer/validateur pour les écritures MCP.
 *
 * Depuis la v1.4, TOUS les types proposés par le bouton « Ajouter un bloc »
 * de l'éditeur (28 blocs de contenu + 6 blocs de mise en page) sont
 * disponibles via MCP. Les blocs de mise en page acceptent des enfants
 * (`children`, un seul niveau de contenu).
 */

export type FieldType =
  | "html"
  | "embed_html"
  | "raw"
  | "plain"
  | "string"
  | "url"
  | "string[]"
  | "boolean"
  | "number"
  | "enum"
  | "object[]";

export interface CatalogField {
  name: string;
  type: FieldType;
  required: boolean;
  description: string;
  enum?: string[];
}

export interface CatalogEntry {
  type: string;
  /** Famille pédagogique, à titre informatif pour l'assistant. */
  kind: "content" | "layout" | "media" | "assessment" | "embed";
  /** Valeur stockée dans `lms_lesson_blocks.kind` (contrainte DB). */
  blockKind: "content" | "layout";
  labelFr: string;
  editableViaMcp: boolean;
  /** Peut héberger des blocs de contenu enfants (`children`). */
  acceptsChildren?: boolean;
  fields: CatalogField[];
  guidance: {
    whenToUse: string;
    whenNotToUse: string;
    example?: string;
  };
}

const ALLOWED_TAGS = new Set([
  "a", "abbr", "b", "blockquote", "br", "caption", "cite", "code", "col", "colgroup",
  "dd", "del", "dfn", "div", "dl", "dt", "em", "figcaption", "figure",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "ins", "kbd", "li", "mark",
  "ol", "p", "pre", "q", "s", "samp", "small", "span", "strong", "sub", "sup",
  "table", "tbody", "td", "tfoot", "th", "thead", "time", "tr", "u", "ul", "var",
]);

const ALLOWED_ATTRS = new Set(["href", "title", "target", "src", "alt", "class"]);

/** Tags/attrs supplémentaires tolérés pour le bloc "html_embed" (rendu en iframe sandbox). */
const EMBED_EXTRA_TAGS = new Set(["iframe", "video", "audio", "source", "track", "picture"]);
const EMBED_EXTRA_ATTRS = new Set([
  "width", "height", "allow", "allowfullscreen", "frameborder", "loading",
  "controls", "poster", "type", "srcset", "sizes", "referrerpolicy", "style",
]);

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function sanitizeMarkup(value: string, allowEmbed: boolean): string {
  const noScript = value
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");

  return noScript.replace(/<\/?[^>]+>/g, (tag) => {
    const m = tag.match(/^<\/?([a-zA-Z0-9]+)([^>]*)>$/);
    if (!m) return "";
    const tagName = m[1].toLowerCase();
    const isClose = tag.startsWith("</");
    const allowed = ALLOWED_TAGS.has(tagName) || (allowEmbed && EMBED_EXTRA_TAGS.has(tagName));
    if (!allowed) return "";
    if (isClose) return `</${tagName}>`;

    const attrPart = m[2];
    let cleanAttrs = "";
    const attrRe = /([a-zA-Z-:]+)(?:=(?:"([^"]*)"|'([^']*)'|([^ \t\n"'>=]*)))?/g;
    let am: RegExpExecArray | null;
    while ((am = attrRe.exec(attrPart)) !== null) {
      const name = am[1].toLowerCase();
      if (name.startsWith("on")) continue;
      if (!ALLOWED_ATTRS.has(name) && !(allowEmbed && EMBED_EXTRA_ATTRS.has(name))) continue;
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

/**
 * Sanitize HTML by keeping only allowed tags and attributes. Tags not in the
 * allowlist are stripped (content preserved). Event handlers and dangerous
 * href/src are removed.
 */
export function sanitizeHtml(value: string): string {
  return sanitizeMarkup(value, false);
}

/** Variante pour les intégrations (iframe/vidéo) — jamais de <script>. */
export function sanitizeEmbedHtml(value: string): string {
  return sanitizeMarkup(value, true);
}

/**
 * Plain-text fields (titles, labels, list items) are rendered as text by the
 * frontend, which escapes them itself. Escaping here too produced visible
 * entities like "&#39;" in the lessons, so we only strip markup and decode any
 * entity that a client may have sent pre-escaped.
 */
export function sanitizePlainText(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<\/?[^>]+>/g, ""),
  );
}

/** Champ "raw" : code source affiché tel quel (bloc de code). Aucun stripping. */
export function sanitizeRawText(value: string): string {
  return value;
}

/** URLs : seuls http(s), mailto et ancres internes sont conservés. */
export function sanitizeUrl(value: string): string | null {
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("mailto:") || trimmed.startsWith("#") || trimmed.startsWith("/")) {
    return trimmed;
  }
  return null;
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#0*39;|&apos;|&#x0*27;/gi, "'")
    .replace(/&quot;|&#0*34;/gi, '"')
    .replace(/&lt;|&#0*60;/gi, "<")
    .replace(/&gt;|&#0*62;/gi, ">")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const f = (
  name: string,
  type: FieldType,
  required: boolean,
  description: string,
  enumValues?: string[],
): CatalogField => ({ name, type, required, description, ...(enumValues ? { enum: enumValues } : {}) });

const CALLOUT_COLORS = [
  "blue", "amber", "green", "red", "gray", "supertilt_yellow", "supertilt_black",
  "gray_light", "gray_very_light", "white", "teal", "coral",
];

const CATALOG: CatalogEntry[] = [
  // ── Texte et structure éditoriale ─────────────────────────────────
  {
    type: "text",
    kind: "content",
    blockKind: "content",
    labelFr: "Texte riche",
    editableViaMcp: true,
    fields: [f("html", "html", true, "Contenu HTML du bloc (titres, paragraphes, listes)")],
    guidance: {
      whenToUse: "Narration, introduction, explications, transitions. Bloc par défaut quand le contenu est avant tout du texte.",
      whenNotToUse: "Ne pas enchaîner des paragraphes denses ; préférer un bloc spécialisé pour les points clés ou les exercices.",
      example: "<h2>La règle des 3 C</h2><p>Clair, Concis, Cohérent…</p>",
    },
  },
  {
    type: "table",
    kind: "content",
    blockKind: "content",
    labelFr: "Tableau",
    editableViaMcp: true,
    fields: [f("html", "html", true, "HTML du tableau : <table><thead><tr><th>…</th></tr></thead><tbody>…</tbody></table>")],
    guidance: {
      whenToUse: "Comparer des critères, présenter des données structurées en lignes/colonnes.",
      whenNotToUse: "Ne pas utiliser pour une simple liste ; un tableau à une colonne est toujours une liste.",
    },
  },
  {
    type: "callout",
    kind: "content",
    blockKind: "content",
    labelFr: "Encadré pédagogique",
    editableViaMcp: true,
    fields: [
      f("body_html", "html", true, "Corps de l'encadré"),
      f("title", "plain", false, "Titre optionnel"),
      f("color", "enum", false, "Couleur de l'encadré", CALLOUT_COLORS),
      f("level", "enum", false, "Niveau sémantique", ["info", "warning", "tip", "example", "resource"]),
      f("border_radius", "number", false, "Arrondi des coins en px"),
      f("show_icon", "boolean", false, "Afficher l'icône du niveau"),
    ],
    guidance: {
      whenToUse: "Mettre en valeur une définition, un avertissement, un conseil, un exemple, une ressource.",
      whenNotToUse: "Ne pas porter la structure principale du cours dans des encadrés.",
    },
  },
  {
    type: "key_points",
    kind: "content",
    blockKind: "content",
    labelFr: "Points clés à retenir",
    editableViaMcp: true,
    fields: [
      f("items", "string[]", true, "Liste des points clés (une chaîne par point)"),
      f("title", "plain", false, "Titre optionnel, ex. « À retenir »"),
      f("image_url", "url", false, "Illustration optionnelle"),
    ],
    guidance: {
      whenToUse: "Synthétiser 3 à 7 idées essentielles en fin de section ou de leçon.",
      whenNotToUse: "Pas pour une procédure ou une simple énumération : préférer liste à cocher ou liste à puces.",
    },
  },
  {
    type: "bullet_list",
    kind: "content",
    blockKind: "content",
    labelFr: "Liste à puces",
    editableViaMcp: true,
    fields: [
      f("items", "string[]", true, "Éléments de la liste"),
      f("title", "plain", false, "Titre optionnel"),
      f("bullet_style", "enum", false, "Style de puce", ["round", "square", "check", "arrow", "star", "diamond"]),
      f("bullet_color", "string", false, "Couleur des puces (hex ou token CSS)"),
      f("text_color", "string", false, "Couleur du texte"),
      f("item_spacing", "enum", false, "Espacement", ["compact", "normal", "relaxed"]),
    ],
    guidance: {
      whenToUse: "Lister des éléments connexes sans ordre strict : avantages, exemples, pièges, ressources.",
      whenNotToUse: "Pas pour une séquence d'étapes : préférer la frise ou la liste à cocher.",
    },
  },
  {
    type: "checklist",
    kind: "content",
    blockKind: "content",
    labelFr: "Liste à cocher",
    editableViaMcp: true,
    fields: [
      f("items", "object[]", true, "Tableau d'objets {id, label}"),
      f("title", "plain", false, "Titre optionnel"),
    ],
    guidance: {
      whenToUse: "Procédure concrète à suivre ou prérequis à vérifier par l'apprenant.",
      whenNotToUse: "Pas pour une énumération informative sans action associée.",
    },
  },
  {
    type: "summary",
    kind: "content",
    blockKind: "content",
    labelFr: "Résumé interactif",
    editableViaMcp: true,
    fields: [
      f("statements", "object[]", true, "Affirmations {id, text, is_correct}"),
      f("title", "plain", false, "Titre optionnel"),
      f("instructions", "plain", false, "Consigne affichée avant les affirmations"),
    ],
    guidance: {
      whenToUse: "Faire trier le vrai du faux en fin de leçon pour ancrer les acquis.",
      whenNotToUse: "Pas pour une évaluation notée : utiliser un quiz.",
    },
  },
  {
    type: "accordion",
    kind: "content",
    blockKind: "content",
    labelFr: "Accordéon FAQ",
    editableViaMcp: true,
    fields: [
      f("items", "object[]", true, "Entrées {id, question, answer_html}"),
      f("title", "plain", false, "Titre optionnel"),
    ],
    guidance: {
      whenToUse: "Approfondissements optionnels, objections, questions fréquentes.",
      whenNotToUse: "Ne pas cacher un contenu indispensable derrière un accordéon.",
    },
  },
  {
    type: "timeline",
    kind: "content",
    blockKind: "content",
    labelFr: "Frise chronologique",
    editableViaMcp: true,
    fields: [
      f("steps", "object[]", true, "Étapes {id, title, description, panel_title, icon_url}"),
      f("accent_color", "string", false, "Couleur d'accent"),
    ],
    guidance: {
      whenToUse: "Processus séquentiel, méthode en étapes, historique.",
      whenNotToUse: "Pas pour des éléments sans ordre.",
    },
  },
  {
    type: "flip_cards",
    kind: "content",
    blockKind: "content",
    labelFr: "Cartes à retourner",
    editableViaMcp: true,
    fields: [
      f("cards", "object[]", true, "Cartes {id, front_text, back_text, front_image_url, back_image_url}"),
      f("card_height_px", "number", false, "Hauteur des cartes en px"),
    ],
    guidance: {
      whenToUse: "Mémorisation : terme au recto, définition au verso.",
      whenNotToUse: "Pas pour un contenu long à lire.",
    },
  },
  {
    type: "code",
    kind: "content",
    blockKind: "content",
    labelFr: "Bloc de code",
    editableViaMcp: true,
    fields: [
      f("code", "raw", true, "Code source, conservé tel quel"),
      f("language", "string", true, "Langage, ex. javascript, sql, bash"),
      f("showLineNumbers", "boolean", false, "Afficher les numéros de ligne"),
      f("title", "plain", false, "Titre optionnel"),
    ],
    guidance: {
      whenToUse: "Extraits de code, commandes, requêtes, prompts à copier.",
      whenNotToUse: "Pas pour du texte courant.",
    },
  },

  // ── Exercices et évaluation ───────────────────────────────────────
  {
    type: "exercise",
    kind: "assessment",
    blockKind: "content",
    labelFr: "Exercice / mise en pratique",
    editableViaMcp: true,
    fields: [
      f("prompt_html", "html", true, "Consigne de l'exercice"),
      f("title", "plain", false, "Titre de l'exercice"),
      f("answer_html", "html", false, "Corrigé ou éléments de réponse"),
      f("interactive_html", "embed_html", false, "Bloc HTML/CSS interactif affiché dans une iframe sandbox"),
      f("checklist_title", "plain", false, "Titre de la liste de vérification"),
      f("checklist_items", "object[]", false, "Critères de réussite {id, label}"),
      f("video_url", "url", false, "Vidéo de consigne"),
      f("answer_video_url", "url", false, "Vidéo du corrigé"),
      f("image_url", "url", false, "Illustration de la consigne"),
      f("pdf_url", "url", false, "Fichier de consigne (PDF, Excel, Word…)"),
      f("file_name", "plain", false, "Nom d'origine du fichier de consigne"),
      f("work_deposit_enabled", "boolean", false, "Activer un dépôt de travail sur cet exercice"),
    ],
    guidance: {
      whenToUse: "Passage à l'action : consigne, production attendue, critères de réussite.",
      whenNotToUse: "Pas pour un simple rappel théorique.",
    },
  },
  {
    type: "self_assessment",
    kind: "assessment",
    blockKind: "content",
    labelFr: "Auto-évaluation",
    editableViaMcp: true,
    fields: [
      f("prompt", "plain", true, "Question posée à l'apprenant"),
      f("scale", "enum", false, "Type d'échelle", ["stars", "labels"]),
      f("labels", "string[]", false, "Libellés de l'échelle si scale = labels"),
    ],
    guidance: {
      whenToUse: "Faire situer son niveau de confiance ou de maîtrise, sans bonne réponse.",
      whenNotToUse: "Pas pour vérifier une connaissance : utiliser un quiz.",
    },
  },
  {
    type: "fill_blanks",
    kind: "assessment",
    blockKind: "content",
    labelFr: "Texte à trous",
    editableViaMcp: true,
    fields: [
      f("text", "plain", true, "Texte avec les réponses entre doubles accolades, ex. « La {{photosynthèse}} … »"),
      f("title", "plain", false, "Titre optionnel"),
      f("instructions", "plain", false, "Consigne"),
    ],
    guidance: {
      whenToUse: "Ancrer un vocabulaire ou une formule par complétion.",
      whenNotToUse: "Pas plus de 5 à 6 trous par bloc.",
    },
  },
  {
    type: "drag_words",
    kind: "assessment",
    blockKind: "content",
    labelFr: "Glisser les mots",
    editableViaMcp: true,
    fields: [
      f("text", "plain", true, "Texte avec les mots à placer entre astérisques, ex. « Le *chat* est un *animal* »"),
      f("title", "plain", false, "Titre optionnel"),
      f("instructions", "plain", false, "Consigne"),
    ],
    guidance: {
      whenToUse: "Variante ludique du texte à trous, adaptée au mobile.",
      whenNotToUse: "Pas pour des réponses libres.",
    },
  },
  {
    type: "quiz",
    kind: "assessment",
    blockKind: "content",
    labelFr: "Quiz",
    editableViaMcp: true,
    fields: [f("quiz_id", "string", true, "ID d'un quiz existant (lms_quizzes) — le quiz doit déjà exister")],
    guidance: {
      whenToUse: "Insérer un quiz déjà créé dans l'éditeur pour valider les acquis.",
      whenNotToUse: "Le MCP ne crée pas les questions : créer le quiz dans l'éditeur puis référencer son ID.",
    },
  },
  {
    type: "assignment",
    kind: "assessment",
    blockKind: "content",
    labelFr: "Devoir",
    editableViaMcp: true,
    fields: [
      f("assignment_id", "string", true, "ID d'un devoir existant (lms_assignments)"),
      f("instructions_html", "html", false, "Consignes complémentaires"),
    ],
    guidance: {
      whenToUse: "Travail à rendre et à évaluer par le formateur.",
      whenNotToUse: "Le devoir lui-même doit être créé dans l'éditeur au préalable.",
    },
  },
  {
    type: "work_deposit",
    kind: "assessment",
    blockKind: "content",
    labelFr: "Dépôt de travail",
    editableViaMcp: true,
    fields: [
      f("title", "plain", false, "Titre du dépôt"),
      f("instructions_html", "html", false, "Consignes de dépôt"),
      f("expected_deliverable", "plain", false, "Livrable attendu"),
      f("accepted_formats", "string[]", false, "Formats acceptés, ex. pdf, png"),
      f("max_size_mb", "number", false, "Taille maximale en Mo"),
      f("sharing_allowed", "boolean", false, "Autoriser le partage avec le groupe"),
      f("comments_enabled", "boolean", false, "Autoriser les commentaires"),
      f("feedback_enabled", "boolean", false, "Autoriser le retour du formateur"),
      f("require_deposit_to_complete", "boolean", false, "Dépôt obligatoire pour terminer la leçon"),
    ],
    guidance: {
      whenToUse: "Demander un fichier produit par l'apprenant.",
      whenNotToUse: "Pas pour un exercice autocorrigé.",
    },
  },

  // ── Médias ────────────────────────────────────────────────────────
  {
    type: "video",
    kind: "media",
    blockKind: "content",
    labelFr: "Vidéo",
    editableViaMcp: true,
    fields: [
      f("url", "url", true, "URL de la vidéo (fichier hébergé, YouTube, Vimeo)"),
      f("duration_seconds", "number", false, "Durée en secondes"),
      f("display_style", "enum", false, "Style d'affichage", ["simple", "styled"]),
      f("bg_color", "string", false, "Couleur de fond du cadre"),
      f("container_radius", "number", false, "Arrondi du cadre"),
      f("video_radius", "number", false, "Arrondi de la vidéo"),
      f("padding", "number", false, "Marge intérieure"),
    ],
    guidance: {
      whenToUse: "Démonstration, interview, capture d'écran commentée.",
      whenNotToUse: "Le MCP n'héberge pas de fichier : fournir une URL déjà accessible.",
    },
  },
  {
    type: "image",
    kind: "media",
    blockKind: "content",
    labelFr: "Image",
    editableViaMcp: true,
    fields: [
      f("url", "url", true, "URL de l'image"),
      f("caption_html", "html", false, "Légende"),
    ],
    guidance: {
      whenToUse: "Schéma, capture, illustration d'un concept.",
      whenNotToUse: "Le MCP n'uploade pas de fichier : fournir une URL existante.",
    },
  },
  {
    type: "gallery",
    kind: "media",
    blockKind: "content",
    labelFr: "Galerie d'images",
    editableViaMcp: true,
    fields: [
      f("images", "object[]", true, "Images {url, caption_html}"),
      f("mode", "enum", false, "Affichage", ["grid", "carousel"]),
      f("columns", "number", false, "Nombre de colonnes (2, 3 ou 4)"),
    ],
    guidance: {
      whenToUse: "Série d'exemples visuels, avant/après multiples, inspirations.",
      whenNotToUse: "Pas pour une seule image.",
    },
  },
  {
    type: "file",
    kind: "media",
    blockKind: "content",
    labelFr: "Fichier / ressource",
    editableViaMcp: true,
    fields: [
      f("files", "object[]", true, "Fichiers {url, name, size}"),
      f("description_html", "html", false, "Description de la ressource"),
    ],
    guidance: {
      whenToUse: "Modèle à télécharger, support PDF, jeu de données.",
      whenNotToUse: "Le MCP n'uploade pas : fournir des URLs existantes.",
    },
  },
  {
    type: "image_hotspot",
    kind: "media",
    blockKind: "content",
    labelFr: "Image annotée",
    editableViaMcp: true,
    fields: [
      f("image_url", "url", true, "URL de l'image de fond"),
      f("hotspots", "object[]", true, "Points {id, x_pct, y_pct, label, description_html}"),
    ],
    guidance: {
      whenToUse: "Expliquer une interface, un schéma, une planche annotée.",
      whenNotToUse: "Pas plus de 6 à 8 points par image.",
    },
  },
  {
    type: "before_after",
    kind: "media",
    blockKind: "content",
    labelFr: "Avant / Après",
    editableViaMcp: true,
    fields: [
      f("before_image_url", "url", true, "Image avant"),
      f("after_image_url", "url", true, "Image après"),
      f("before_label", "plain", false, "Libellé avant"),
      f("after_label", "plain", false, "Libellé après"),
      f("caption", "plain", false, "Légende"),
    ],
    guidance: {
      whenToUse: "Montrer l'effet d'une méthode par comparaison visuelle.",
      whenNotToUse: "Pas pour deux images sans lien.",
    },
  },

  // ── Liens, mise en avant, intégrations ────────────────────────────
  {
    type: "button",
    kind: "content",
    blockKind: "content",
    labelFr: "Bouton / lien",
    editableViaMcp: true,
    fields: [
      f("label", "plain", true, "Libellé du bouton"),
      f("url", "url", true, "URL cible"),
      f("variant", "enum", false, "Style", ["primary", "secondary", "outline", "supertilt"]),
      f("open_in_new_tab", "boolean", false, "Ouvrir dans un nouvel onglet"),
      f("alignment", "enum", false, "Alignement", ["left", "center", "right"]),
    ],
    guidance: {
      whenToUse: "Une action unique et claire : ouvrir un modèle, accéder à un outil.",
      whenNotToUse: "Pas plusieurs boutons concurrents dans la même section.",
    },
  },
  {
    type: "cta",
    kind: "content",
    blockKind: "content",
    labelFr: "Appel à l'action (CTA)",
    editableViaMcp: true,
    fields: [
      f("button_label", "plain", true, "Libellé du bouton"),
      f("button_url", "url", true, "URL du bouton"),
      f("label", "plain", false, "Petit label au-dessus du titre"),
      f("title", "plain", false, "Titre (un segment entre astérisques est accentué)"),
      f("subtitle", "plain", false, "Sous-titre"),
      f("body_html", "html", false, "Texte du bloc"),
      f("benefits", "string[]", false, "2 à 3 bénéfices affichés en pastilles"),
      f("badge", "plain", false, "Badge superposé à l'image"),
      f("image_url", "url", false, "Image d'illustration"),
      f("secondary_label", "plain", false, "Libellé du lien secondaire"),
      f("secondary_url", "url", false, "URL du lien secondaire"),
      f("open_in_new_tab", "boolean", false, "Ouvrir dans un nouvel onglet"),
      f("accent_color", "string", false, "Couleur d'accent"),
    ],
    guidance: {
      whenToUse: "Fin de leçon : prolonger vers une formation, un outil, une ressource.",
      whenNotToUse: "Pas au milieu d'une explication pédagogique.",
    },
  },
  {
    type: "html_embed",
    kind: "embed",
    blockKind: "content",
    labelFr: "HTML / Embed",
    editableViaMcp: true,
    fields: [
      f("html", "embed_html", true, "HTML ou iframe (scripts interdits, rendu en iframe sandbox)"),
      f("title", "plain", false, "Titre affiché au-dessus"),
    ],
    guidance: {
      whenToUse: "Intégrer un outil externe : Figma, Genially, formulaire, carte.",
      whenNotToUse: "Les balises <script> sont systématiquement supprimées ; préférer une iframe.",
    },
  },
  {
    type: "shortcode",
    kind: "embed",
    blockKind: "content",
    labelFr: "Code court (formulaire SuperTools)",
    editableViaMcp: true,
    fields: [
      f("code", "enum", true, "Formulaire à intégrer", ["besoins", "evaluation"]),
      f("course_id", "string", false, "ID LearnDash du cours (optionnel)"),
      f("title", "plain", false, "Titre affiché au-dessus"),
    ],
    guidance: {
      whenToUse: "Recueil des besoins en début de parcours, évaluation en fin de parcours.",
      whenNotToUse: "Pas d'autres formulaires que ces deux codes.",
    },
  },

  // ── Mise en page ──────────────────────────────────────────────────
  {
    type: "section",
    kind: "layout",
    blockKind: "layout",
    labelFr: "Section pleine largeur",
    editableViaMcp: true,
    acceptsChildren: true,
    fields: [
      f("title", "plain", false, "Titre de la section"),
      f("background", "enum", false, "Fond", ["default", "muted", "primary", "accent"]),
    ],
    guidance: {
      whenToUse: "Découper la leçon en grandes parties visuellement distinctes.",
      whenNotToUse: "Pas une section par paragraphe.",
    },
  },
  {
    type: "row",
    kind: "layout",
    blockKind: "layout",
    labelFr: "Ligne / colonnes",
    editableViaMcp: true,
    acceptsChildren: true,
    fields: [
      f("column_count", "number", true, "Nombre de colonnes (1, 2 ou 3)"),
      f("vertical_align", "enum", false, "Alignement vertical", ["top", "center", "bottom"]),
      f("image_fit", "enum", false, "Cadrage des images", ["contain", "cover", "natural"]),
      f("image_sizing", "enum", false, "Harmonisation", ["equal_width", "equal_height", "max_height", "free"]),
      f("image_frame", "enum", false, "Cadre", ["none", "card", "border", "rounded", "shadow"]),
    ],
    guidance: {
      whenToUse: "Comparer deux contenus côte à côte, texte + image.",
      whenNotToUse: "Pas plus de 3 colonnes (illisible en mobile).",
    },
  },
  {
    type: "container",
    kind: "layout",
    blockKind: "layout",
    labelFr: "Conteneur",
    editableViaMcp: true,
    acceptsChildren: true,
    fields: [f("max_width", "enum", true, "Largeur maximale", ["sm", "md", "lg", "xl", "full"])],
    guidance: {
      whenToUse: "Resserrer la largeur de lecture d'un passage.",
      whenNotToUse: "Pas d'imbrication de conteneurs.",
    },
  },
  {
    type: "reveal",
    kind: "layout",
    blockKind: "layout",
    labelFr: "Contenu progressif",
    editableViaMcp: true,
    acceptsChildren: true,
    fields: [
      f("button_label", "plain", true, "Libellé du bouton de révélation"),
      f("collapsible", "boolean", false, "Le contenu peut être refermé"),
    ],
    guidance: {
      whenToUse: "Faire réfléchir avant d'afficher la réponse ou la suite.",
      whenNotToUse: "Pas pour masquer un contenu obligatoire à lire.",
    },
  },
  {
    type: "divider",
    kind: "layout",
    blockKind: "layout",
    labelFr: "Séparateur",
    editableViaMcp: true,
    fields: [f("style", "enum", false, "Style du trait", ["solid", "dashed"])],
    guidance: {
      whenToUse: "Marquer une rupture légère entre deux idées.",
      whenNotToUse: "Pas entre chaque bloc.",
    },
  },
  {
    type: "spacer",
    kind: "layout",
    blockKind: "layout",
    labelFr: "Espace vertical",
    editableViaMcp: true,
    fields: [f("height_px", "number", true, "Hauteur en px")],
    guidance: {
      whenToUse: "Aérer avant une mise en avant importante.",
      whenNotToUse: "Ne pas s'en servir pour compenser une mauvaise structuration.",
    },
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
  const entry = getCatalogEntry(type);
  return Boolean(entry?.editableViaMcp);
}

export function isLayoutBlockType(type: string): boolean {
  return getCatalogEntry(type)?.blockKind === "layout";
}

export function blockKindOf(type: string): "content" | "layout" {
  return getCatalogEntry(type)?.blockKind ?? "content";
}

/** Formes des éléments des champs "object[]", indexées par `type.champ`. */
const ITEM_SHAPES: Record<string, CatalogField[]> = {
  "checklist.items": [f("id", "string", true, ""), f("label", "plain", true, "")],
  "exercise.checklist_items": [f("id", "string", true, ""), f("label", "plain", true, "")],
  "accordion.items": [f("id", "string", true, ""), f("question", "plain", true, ""), f("answer_html", "html", true, "")],
  "summary.statements": [f("id", "string", true, ""), f("text", "plain", true, ""), f("is_correct", "boolean", true, "")],
  "timeline.steps": [
    f("id", "string", true, ""), f("title", "plain", true, ""), f("description", "plain", false, ""),
    f("panel_title", "plain", false, ""), f("icon_url", "url", false, ""),
  ],
  "flip_cards.cards": [
    f("id", "string", true, ""), f("front_text", "plain", false, ""), f("back_text", "plain", false, ""),
    f("front_image_url", "url", false, ""), f("back_image_url", "url", false, ""),
  ],
  "gallery.images": [f("url", "url", true, ""), f("caption_html", "html", false, "")],
  "file.files": [f("url", "url", true, ""), f("name", "plain", false, ""), f("size", "number", false, "")],
  "image_hotspot.hotspots": [
    f("id", "string", true, ""), f("x_pct", "number", true, ""), f("y_pct", "number", true, ""),
    f("label", "plain", true, ""), f("description_html", "html", false, ""),
  ],
};

function coerceToArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function sanitizeScalar(field: CatalogField, value: unknown): unknown {
  switch (field.type) {
    case "html":
      return sanitizeHtml(String(value));
    case "embed_html":
      return sanitizeEmbedHtml(String(value));
    case "raw":
      return sanitizeRawText(String(value));
    case "url":
      return sanitizeUrl(String(value));
    case "plain":
    case "string":
    case "enum":
      return sanitizePlainText(String(value));
    case "boolean":
      return Boolean(value);
    case "number": {
      const n = Number(value);
      return Number.isNaN(n) ? 0 : n;
    }
    case "string[]":
      // Tolère { text }/{ label }/{ value } : un assistant envoie souvent des objets
      // là où le bloc attend des chaînes. Ne jamais silencieusement vider l'entrée.
      return coerceToArray(value)
        .map((v) => {
          if (typeof v === "string") return sanitizePlainText(v);
          if (typeof v === "number" || typeof v === "boolean") return String(v);
          if (isPlainObject(v)) {
            const candidate = v.text ?? v.label ?? v.value ?? v.title;
            if (typeof candidate === "string") return sanitizePlainText(candidate);
          }
          throw new Error(`Invalid item in text list: expected a string, got ${JSON.stringify(v)}`);
        })
        .filter((s) => s.length > 0);
    default:
      return undefined;
  }
}

function sanitizeObjectArray(value: unknown, shape: CatalogField[]): unknown[] {
  return coerceToArray(value).map((item) => {
    const obj = isPlainObject(item) ? item : {};
    const out: Record<string, unknown> = {};
    for (const field of shape) {
      if (!(field.name in obj)) continue;
      const v = obj[field.name];
      out[field.name] = v === null || v === undefined ? null : sanitizeScalar(field, v);
    }
    return out;
  });
}

function sanitizeField(type: string, field: CatalogField, value: unknown): unknown {
  if (field.type === "object[]") {
    const shape = ITEM_SHAPES[`${type}.${field.name}`];
    if (!shape) throw new Error(`Object array field "${field.name}" not supported for type "${type}"`);
    return sanitizeObjectArray(value, shape);
  }
  return sanitizeScalar(field, value);
}

/**
 * Pick only the fields defined in the catalog for a given type.
 * Returns a sanitized partial content object suitable for a merge + UPDATE.
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
    const sanitized = sanitizeField(type, field, value);
    if (sanitized !== undefined) patch[field.name] = sanitized;
  }
  return patch;
}

/**
 * Validate and sanitize a full block (type + content) intended for insertion
 * via apply_lesson_restructure. Throws if a required field is missing or if
 * the type is unknown / not editable.
 */
export function sanitizeNewBlock(type: string, content: Record<string, unknown>): { type: string; content: Record<string, unknown> } {
  if (!isEditableBlockType(type)) {
    throw new Error(`Block type "${type}" is not allowed for restructuring`);
  }
  const entry = getCatalogEntry(type)!;

  const sanitized: Record<string, unknown> = {};
  for (const field of entry.fields) {
    const missing = !(field.name in content) || content[field.name] === null || content[field.name] === undefined;
    if (missing) {
      if (field.required) {
        throw new Error(`Missing required field "${field.name}" for block type "${type}"`);
      }
      continue;
    }
    const value = sanitizeField(type, field, content[field.name]);
    if (value === undefined) continue;
    if (field.required && value === null) {
      throw new Error(`Invalid value for required field "${field.name}" of block type "${type}"`);
    }
    sanitized[field.name] = value;
  }
  return { type, content: sanitized };
}

export interface SanitizedBlock {
  type: string;
  kind: "content" | "layout";
  content: Record<string, unknown>;
  hidden?: boolean;
  children?: SanitizedBlock[];
}

/**
 * Sanitize a full restructure payload. Layout blocks may carry `children`
 * (content blocks only, one nesting level — the editor's own model).
 * Unknown types are rejected explicitly instead of being silently dropped.
 */
export function sanitizeRestructureBlocks(blocks: unknown[], depth = 0): SanitizedBlock[] {
  return blocks.map((b) => {
    const obj = isPlainObject(b) ? b : {};
    const type = String(obj.type || "");
    const entry = getCatalogEntry(type);
    if (!entry || !entry.editableViaMcp) {
      throw new Error(`Block type "${type || "null"}" is not allowed for restructuring`);
    }
    const content = isPlainObject(obj.content) ? obj.content : {};
    const sanitized = sanitizeNewBlock(type, content);
    const out: SanitizedBlock = {
      type: sanitized.type,
      kind: entry.blockKind,
      content: sanitized.content,
      hidden: obj.hidden === true,
    };

    const rawChildren = obj.children;
    if (rawChildren !== undefined && rawChildren !== null) {
      if (!Array.isArray(rawChildren)) throw new Error(`"children" must be an array (block type "${type}")`);
      if (!entry.acceptsChildren) throw new Error(`Block type "${type}" cannot have children`);
      if (depth > 0) throw new Error("Layout blocks can only be nested one level deep");
      const children = sanitizeRestructureBlocks(rawChildren, depth + 1);
      const layoutChild = children.find((c) => c.kind === "layout");
      if (layoutChild) throw new Error(`Layout block "${layoutChild.type}" cannot be a child of "${type}"`);
      out.children = children;
    }

    return out;
  });
}
