/**
 * Routes internes (sous <RequireStaff />) lues dans src/App.tsx : un écran
 * ajouté demain est scanné sans modifier cette liste. Les paramètres (:id)
 * pointent la première ligne du faux backend.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { FIXED_ID } from "./canary";

export function staffRoutes(): string[] {
  const app = fs.readFileSync(path.resolve(process.cwd(), "src/App.tsx"), "utf8");
  const start = app.indexOf("<RequireStaff />");
  const end = app.indexOf('path="*"', start);
  const block = app.slice(start, end);
  const routes = new Set<string>();
  for (const m of block.matchAll(/<Route path="([^"]+)" element=\{<(?!Navigate)/g)) {
    routes.add(m[1].replace(/:[A-Za-z]+/g, FIXED_ID));
  }
  const only = process.env.DEMO_SCAN_ROUTES?.split(",").map((r) => r.trim()).filter(Boolean);
  return [...routes].filter((r) => !only || only.some((o) => r.startsWith(o)));
}
