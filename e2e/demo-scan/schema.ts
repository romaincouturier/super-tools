/**
 * Colonnes de chaque table et vue, lues dans les types Supabase générés
 * (`src/integrations/supabase/types.ts`). Le faux backend s'en sert pour
 * produire des lignes au bon format sans connaître l'écran qui les demande.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import ts from "typescript";

export type Column = { name: string; type: string };
export type Schema = { tables: Record<string, Column[]>; enums: Record<string, string[]> };

const TYPES_FILE = path.resolve(process.cwd(), "src/integrations/supabase/types.ts");

function members(node: ts.TypeNode | undefined): ts.PropertySignature[] {
  if (!node || !ts.isTypeLiteralNode(node)) return [];
  return node.members.filter(ts.isPropertySignature);
}

function prop(node: ts.TypeNode | undefined, name: string): ts.TypeNode | undefined {
  return members(node).find((m) => m.name.getText() === name)?.type;
}

export function loadSchema(): Schema {
  const source = ts.createSourceFile(TYPES_FILE, fs.readFileSync(TYPES_FILE, "utf8"), ts.ScriptTarget.Latest, true);
  const database = source.statements.find(
    (s): s is ts.TypeAliasDeclaration => ts.isTypeAliasDeclaration(s) && s.name.text === "Database",
  );
  const pub = prop(database?.type, "public");
  const schema: Schema = { tables: {}, enums: {} };
  for (const group of ["Tables", "Views"]) {
    for (const table of members(prop(pub, group))) {
      const row = prop(table.type, "Row");
      schema.tables[table.name.getText().replace(/"/g, "")] = members(row).map((m) => ({
        name: m.name.getText().replace(/"/g, ""),
        type: m.type?.getText() ?? "unknown",
      }));
    }
  }
  for (const e of members(prop(pub, "Enums"))) {
    schema.enums[e.name.getText().replace(/"/g, "")] = (e.type?.getText() ?? "")
      .split("|")
      .map((v) => v.trim().replace(/^"|"$/g, ""))
      .filter(Boolean);
  }
  return schema;
}
