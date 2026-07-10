/**
 * Coloration syntaxique légère pour le bloc "code" du builder LMS
 * (ST-2026-0233). Tokenizer regex par langage — pas de dépendance externe.
 * Retourne des tokens typés que le viewer rend en <span> React (pas de HTML).
 */

export type CodeTokenType = "keyword" | "string" | "comment" | "number" | "plain";

export interface CodeToken {
  type: CodeTokenType;
  value: string;
}

export interface CodeLanguageOption {
  value: string;
  label: string;
}

export const CODE_LANGUAGES: CodeLanguageOption[] = [
  { value: "javascript", label: "JavaScript" },
  { value: "typescript", label: "TypeScript" },
  { value: "python", label: "Python" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
  { value: "bash", label: "Bash / Shell" },
  { value: "json", label: "JSON" },
  { value: "plain", label: "Autre (sans coloration)" },
];

export function codeLanguageLabel(language: string): string {
  return CODE_LANGUAGES.find((l) => l.value === language)?.label ?? language;
}

interface TokenRule {
  type: Exclude<CodeTokenType, "plain">;
  regex: RegExp;
}

interface LanguageDef {
  rules: TokenRule[];
  identifier: RegExp;
  keywords: ReadonlySet<string>;
  caseInsensitive?: boolean;
}

const NUMBER = () => /0[xXbBoO][0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const DQ_STRING = () => /"(?:\\.|[^"\\\n])*"?/y;
const SQ_STRING = () => /'(?:\\.|[^'\\\n])*'?/y;
const SLASH_LINE_COMMENT = () => /\/\/[^\n]*/y;
const SLASH_BLOCK_COMMENT = () => /\/\*[\s\S]*?(?:\*\/|$)/y;
const HASH_COMMENT = () => /#[^\n]*/y;

const JS_KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while", "do",
  "switch", "case", "break", "continue", "new", "class", "extends", "import",
  "export", "from", "default", "async", "await", "try", "catch", "finally",
  "throw", "typeof", "instanceof", "in", "of", "this", "super", "yield",
  "delete", "void", "static", "get", "set", "null", "undefined", "true", "false",
]);

const TS_KEYWORDS = new Set([
  ...JS_KEYWORDS,
  "interface", "type", "enum", "implements", "readonly", "public", "private",
  "protected", "namespace", "declare", "abstract", "as", "satisfies", "keyof",
  "infer", "never", "unknown", "any", "string", "number", "boolean", "object", "symbol",
]);

const JS_LIKE: Omit<LanguageDef, "keywords"> = {
  rules: [
    { type: "comment", regex: SLASH_LINE_COMMENT() },
    { type: "comment", regex: SLASH_BLOCK_COMMENT() },
    { type: "string", regex: /`(?:\\[\s\S]|[^`\\])*`?/y },
    { type: "string", regex: DQ_STRING() },
    { type: "string", regex: SQ_STRING() },
    { type: "number", regex: NUMBER() },
  ],
  identifier: /[A-Za-z_$][A-Za-z0-9_$]*/y,
};

const LANGUAGES: Record<string, LanguageDef> = {
  javascript: { ...JS_LIKE, keywords: JS_KEYWORDS },
  typescript: { ...JS_LIKE, keywords: TS_KEYWORDS },
  python: {
    rules: [
      { type: "comment", regex: HASH_COMMENT() },
      { type: "string", regex: /"""[\s\S]*?(?:"""|$)/y },
      { type: "string", regex: /'''[\s\S]*?(?:'''|$)/y },
      { type: "string", regex: DQ_STRING() },
      { type: "string", regex: SQ_STRING() },
      { type: "number", regex: NUMBER() },
    ],
    identifier: /[A-Za-z_][A-Za-z0-9_]*/y,
    keywords: new Set([
      "def", "return", "if", "elif", "else", "for", "while", "in", "not", "and",
      "or", "is", "None", "True", "False", "class", "import", "from", "as",
      "with", "try", "except", "finally", "raise", "lambda", "pass", "break",
      "continue", "global", "nonlocal", "yield", "assert", "del", "async",
      "await", "match", "case", "self", "print",
    ]),
  },
  html: {
    rules: [
      { type: "comment", regex: /<!--[\s\S]*?(?:-->|$)/y },
      { type: "keyword", regex: /<\/?[a-zA-Z][a-zA-Z0-9-]*|\/?>/y },
      { type: "string", regex: DQ_STRING() },
      { type: "string", regex: SQ_STRING() },
    ],
    identifier: /[A-Za-z_][A-Za-z0-9_-]*/y,
    keywords: new Set<string>(),
  },
  css: {
    rules: [
      { type: "comment", regex: SLASH_BLOCK_COMMENT() },
      { type: "string", regex: DQ_STRING() },
      { type: "string", regex: SQ_STRING() },
      { type: "keyword", regex: /@[a-zA-Z-]+/y },
      { type: "keyword", regex: /[a-zA-Z-]+(?=\s*:)/y },
      { type: "number", regex: /#[0-9a-fA-F]{3,8}|\d+(?:\.\d+)?[a-zA-Z%]*/y },
    ],
    identifier: /[A-Za-z_-][A-Za-z0-9_-]*/y,
    keywords: new Set<string>(),
  },
  sql: {
    rules: [
      { type: "comment", regex: /--[^\n]*/y },
      { type: "comment", regex: SLASH_BLOCK_COMMENT() },
      { type: "string", regex: /'(?:''|[^'\n])*'?/y },
      { type: "number", regex: NUMBER() },
    ],
    identifier: /[A-Za-z_][A-Za-z0-9_]*/y,
    caseInsensitive: true,
    keywords: new Set([
      "select", "from", "where", "insert", "into", "values", "update", "set",
      "delete", "join", "left", "right", "inner", "outer", "full", "cross", "on",
      "group", "by", "order", "having", "limit", "offset", "as", "and", "or",
      "not", "null", "create", "table", "alter", "drop", "index", "primary",
      "key", "foreign", "references", "distinct", "union", "all", "exists",
      "between", "like", "in", "is", "case", "when", "then", "else", "end",
      "count", "sum", "avg", "min", "max", "asc", "desc", "returning", "default",
    ]),
  },
  bash: {
    rules: [
      { type: "comment", regex: HASH_COMMENT() },
      { type: "string", regex: /"(?:\\[\s\S]|[^"\\])*"?/y },
      { type: "string", regex: /'[^']*'?/y },
      { type: "number", regex: /\d+/y },
    ],
    identifier: /[A-Za-z_][A-Za-z0-9_]*/y,
    keywords: new Set([
      "if", "then", "else", "elif", "fi", "for", "while", "until", "do", "done",
      "case", "esac", "in", "function", "select", "time", "echo", "exit",
      "return", "local", "export", "readonly", "declare", "set", "unset",
      "shift", "source", "alias", "cd", "true", "false",
    ]),
  },
  json: {
    rules: [
      { type: "string", regex: DQ_STRING() },
      { type: "number", regex: /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y },
    ],
    identifier: /[A-Za-z_][A-Za-z0-9_]*/y,
    keywords: new Set(["true", "false", "null"]),
  },
};

/**
 * Découpe `code` en tokens typés. Les langages inconnus (ou "plain")
 * retournent un unique token plain — fallback sans coloration.
 */
export function tokenizeCode(code: string, language: string): CodeToken[] {
  const def = LANGUAGES[language];
  if (!def) {
    return code ? [{ type: "plain", value: code }] : [];
  }

  const tokens: CodeToken[] = [];
  let plainStart = 0;
  let i = 0;

  const flushPlain = (end: number) => {
    if (end > plainStart) tokens.push({ type: "plain", value: code.slice(plainStart, end) });
  };

  while (i < code.length) {
    let token: CodeToken | null = null;
    let advance = 0;

    for (const rule of def.rules) {
      rule.regex.lastIndex = i;
      const m = rule.regex.exec(code);
      if (m && m[0].length > 0) {
        token = { type: rule.type, value: m[0] };
        advance = m[0].length;
        break;
      }
    }

    if (!token && advance === 0) {
      def.identifier.lastIndex = i;
      const m = def.identifier.exec(code);
      if (m) {
        advance = m[0].length;
        const word = def.caseInsensitive ? m[0].toLowerCase() : m[0];
        if (def.keywords.has(word)) token = { type: "keyword", value: m[0] };
      } else {
        advance = 1;
      }
    }

    if (token) {
      flushPlain(i);
      tokens.push(token);
      plainStart = i + advance;
    }
    i += advance;
  }

  flushPlain(code.length);
  return tokens;
}

/**
 * Tokenize puis découpe le flux de tokens par ligne (les tokens multi-lignes,
 * ex. commentaires de bloc, sont scindés). Utilisé pour les numéros de ligne.
 */
export function tokenizeCodeLines(code: string, language: string): CodeToken[][] {
  const lines: CodeToken[][] = [[]];
  for (const token of tokenizeCode(code, language)) {
    const parts = token.value.split("\n");
    parts.forEach((part, idx) => {
      if (idx > 0) lines.push([]);
      if (part) lines[lines.length - 1].push({ type: token.type, value: part });
    });
  }
  return lines;
}
