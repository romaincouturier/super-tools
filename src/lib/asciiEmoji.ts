// Convert common ASCII emoticons in a free-text string to their emoji equivalent.
// Only converts when surrounded by whitespace or string boundaries to avoid
// mangling URLs, code, or punctuation inside words.

const MAP: Array<[string, string]> = [
  [":-)", "🙂"], [":)", "🙂"], [":-D", "😃"], [":D", "😃"],
  [":-(", "🙁"], [":(", "🙁"], [":'(", "😢"], [":'-(", "😢"],
  [":-P", "😛"], [":P", "😛"], [":-p", "😛"], [":p", "😛"],
  [";-)", "😉"], [";)", "😉"],
  [":-O", "😮"], [":O", "😮"], [":-o", "😮"], [":o", "😮"],
  [":-|", "😐"], [":|", "😐"],
  [":-/", "😕"], [":/", "😕"], [":-\\", "😕"], [":\\", "😕"],
  [":*", "😘"], [":-*", "😘"],
  ["<3", "❤️"], ["</3", "💔"],
  ["B-)", "😎"], ["B)", "😎"],
  ["xD", "😆"], ["XD", "😆"],
  ["o/", "👋"], ["\\o", "👋"],
  [":+1:", "👍"], [":-1:", "👎"],
];

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Pre-build a single regex sorted longest-first so ":-)" wins over ":-".
const PATTERN = new RegExp(
  "(^|\\s)(" +
    MAP.map(([k]) => k).sort((a, b) => b.length - a.length).map(escapeRegex).join("|") +
    ")(?=\\s|$|[.,!?;:])",
  "g",
);

const LOOKUP = new Map(MAP);

export function asciiToEmoji(text: string): string {
  if (!text) return text;
  return text.replace(PATTERN, (_m, pre, sym) => `${pre}${LOOKUP.get(sym) ?? sym}`);
}
