/**
 * Agrège les résultats par route en un rapport lisible :
 * test-results/demo-scan/RAPPORT.md. Une fuite = un marqueur canari lu en
 * entier, avec l'état qui l'a montrée (arrivée, clic « … », clic « … » › « … »).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import type { RouteResult } from "./explore";

export default function writeReport(): void {
const dir = path.resolve(process.cwd(), "test-results/demo-scan");
const results: RouteResult[] = fs.existsSync(dir)
  ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
  : [];
results.sort((a, b) => b.leaks.length - a.leaks.length || a.route.localeCompare(b.route));

const lines: string[] = ["# Scan d'anonymisation du mode démo", ""];
const leaking = results.filter((r) => r.leaks.length > 0);
const states = results.reduce((s, r) => s + r.states, 0);
lines.push(
  `${results.length} écrans scannés, ${states} états relevés (arrivée, clics, modales, menus). ` +
    `${leaking.length} écran(s) avec fuite, ${results.filter((r) => r.skipped).length} non scanné(s).`,
  "",
);
for (const r of leaking) {
  lines.push(`## ${r.route}`, "", "| Donnée | Où | Après | Texte lu |", "|---|---|---|---|");
  const seen = new Set<string>();
  for (const l of r.leaks) {
    const key = `${l.kind}|${l.where}|${l.excerpt}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(`| ${l.kind} | \`${l.where.replace(/\|/g, "/")}\` | ${l.path.replace(/\|/g, "/")} | ${l.excerpt.replace(/\|/g, "/")} |`);
  }
  lines.push("");
}
const skipped = results.filter((r) => r.skipped);
if (skipped.length) {
  lines.push("## Écrans non scannés", "");
  for (const r of skipped) lines.push(`- ${r.route} : ${r.skipped}`);
  lines.push("");
}
const crashed = results.filter((r) => r.errors.length > 0);
if (crashed.length) {
  lines.push("## Erreurs JavaScript pendant le scan", "", "Souvent dues aux données factices ; un écran en erreur est moins bien couvert.", "");
  for (const r of crashed) lines.push(`- ${r.route} : ${[...new Set(r.errors)].slice(0, 3).join(" ; ")}`);
}
fs.writeFileSync(path.join(dir, "RAPPORT.md"), lines.join("\n") + "\n");
console.log(lines.slice(0, 3).join("\n"));
console.log(`Rapport : ${path.join(dir, "RAPPORT.md")}`);
}
