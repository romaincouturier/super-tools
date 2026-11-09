import Papa from "papaparse";

export async function prepareNocrmFile(file: File) {
  const bytes = await file.arrayBuffer();
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { text = new TextDecoder("windows-1252").decode(bytes); }
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: "greedy" });
  if (parsed.errors.length) throw new Error("Le fichier CSV est invalide.");
  const [header, ...rows] = parsed.data;
  const commentStart = header?.findIndex(h => /^Comment\s+1$/i.test(h.trim())) ?? -1;
  if (!header || !header.includes("ID") || commentStart < 0) throw new Error("Le fichier doit contenir les fiches et les colonnes Comment 1, Comment 2…");
  const idIndex = header.indexOf("ID");
  const comments: string[][] = [];
  const labels = ["E-mail reçu", "E-mail", "Non abouti", "Abouti", "Rendez-vous", "LinkedIn", "SMS", "Autre", "Pas dispo ou vide"];
  for (const row of rows) {
    for (const cell of row.slice(commentStart)) {
      if (!cell.trim()) continue;
      const match = cell.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\] (.*)$/s);
      if (!match) throw new Error(`Commentaire non reconnu sur la fiche ${row[idIndex]}.`);
      const body = match[2];
      const label = labels.find(l => body === l || body.startsWith(`${l} `));
      comments.push([row[idIndex], match[1], label ?? "", label ? body.slice(label.length).trimStart() : body.trimStart(), label ? "False" : "True"]);
    }
  }
  return {
    leadsCsv: Papa.unparse([header.slice(0, commentStart), ...rows.map(r => r.slice(0, commentStart))]),
    commentsCsv: Papa.unparse([["nocrm_id", "commented_at", "activity_type", "content", "is_note"], ...comments]),
  };
}