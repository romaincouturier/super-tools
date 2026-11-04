// Quand une requête cite une colonne inexistante, renvoie les vraies colonnes
// des tables citées (extraites du schéma agent, une ligne par table).
export function referencedTables(sql: string): string[] {
  const names = new Set<string>();
  const re = /\b(?:from|join)\s+(?:public\.)?"?([a-z_][a-z0-9_]*)"?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sql))) names.add(m[1].toLowerCase());
  return [...names];
}

export function isMissingColumnError(message: string): boolean {
  return /column .+ does not exist/i.test(message);
}

export function columnHint(sql: string, schemaPrompt: string): string {
  const tables = referencedTables(sql);
  if (!tables.length) return "";
  const lines = schemaPrompt.split("\n").filter((line) =>
    tables.some((t) => line.startsWith(`${t} (`))
  );
  if (!lines.length) return "";
  return `\n\nColonnes réelles des tables citées (corrige la requête avec ces noms) :\n${lines.join("\n")}`;
}
