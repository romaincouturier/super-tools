// Les mots collectés arrivent parfois encodés depuis les URLs du site
// (ex: "r%c3%a9siliences"). On les affiche décodés.
export function decodeWord(raw: string): string {
  if (!raw) return raw;
  const withSpaces = raw.replace(/\+/g, " ");
  try {
    return /%[0-9a-fA-F]{2}/.test(withSpaces) ? decodeURIComponent(withSpaces) : withSpaces;
  } catch {
    return withSpaces;
  }
}
