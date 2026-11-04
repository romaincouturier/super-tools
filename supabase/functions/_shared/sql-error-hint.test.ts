import { describe, expect, it } from "vitest";
import { columnHint, isMissingColumnError, referencedTables } from "./sql-error-hint";

const schema = [
  "crm_cards (id uuid, title text, next_action_date date)",
  "crm_columns (id uuid, name text)",
  "quotes (id uuid, quote_number text, subject text)",
].join("\n");

describe("indice de colonnes sur erreur SQL MCP", () => {
  it("reconnaît une colonne inexistante", () => {
    expect(isMissingColumnError('column "title" does not exist')).toBe(true);
    expect(isMissingColumnError("syntax error at or near")).toBe(false);
  });
  it("liste les tables citées dans FROM et JOIN", () => {
    expect(referencedTables("select * from crm_cards c join public.crm_columns col on true")).toEqual(["crm_cards", "crm_columns"]);
  });
  it("renvoie uniquement les colonnes des tables citées", () => {
    const hint = columnHint("select title from quotes", schema);
    expect(hint).toContain("quotes (id uuid, quote_number text, subject text)");
    expect(hint).not.toContain("crm_cards");
  });
});
