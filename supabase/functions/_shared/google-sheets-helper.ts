/**
 * Google Sheets helper — resolves a sheet tab from a Google Sheets URL
 * and appends a row. Reuses the shared google_tokens OAuth (needs the
 * `spreadsheets` scope).
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidDriveAccessToken } from "./google-drive-helper.ts";

export function parseSheetsUrl(url: string): { spreadsheetId: string; gid: number | null } | null {
  if (!url) return null;
  try {
    const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
    if (!m) return null;
    const spreadsheetId = m[1];
    const gidMatch = url.match(/[?#&]gid=(\d+)/);
    const gid = gidMatch ? Number(gidMatch[1]) : null;
    return { spreadsheetId, gid };
  } catch {
    return null;
  }
}

async function resolveTabTitle(
  spreadsheetId: string,
  gid: number | null,
  accessToken: string,
): Promise<string> {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties(sheetId,title)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Sheets metadata error ${res.status}: ${await res.text()}`);
  const data = await res.json() as { sheets: Array<{ properties: { sheetId: number; title: string } }> };
  const sheets = data.sheets ?? [];
  const match = gid != null ? sheets.find((s) => s.properties.sheetId === gid) : sheets[0];
  if (!match) throw new Error(`No tab matching gid=${gid}`);
  return match.properties.title;
}

export async function appendRowToSheet(
  admin: ReturnType<typeof createClient>,
  sheetUrl: string,
  values: Array<string | number | null>,
): Promise<void> {
  const parsed = parseSheetsUrl(sheetUrl);
  if (!parsed) throw new Error(`Invalid Google Sheets URL: ${sheetUrl}`);

  const accessToken = await getValidDriveAccessToken(admin);
  if (!accessToken) throw new Error("No Google access token stored (google_tokens)");

  const tabTitle = await resolveTabTitle(parsed.spreadsheetId, parsed.gid, accessToken);
  // Quote sheet title if it contains spaces or special chars
  const needsQuote = /[^A-Za-z0-9_]/.test(tabTitle);
  const range = needsQuote ? `'${tabTitle.replace(/'/g, "''")}'!A:Z` : `${tabTitle}!A:Z`;

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${parsed.spreadsheetId}` +
    `/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [values] }),
  });
  if (!res.ok) {
    throw new Error(`Sheets append error ${res.status}: ${await res.text()}`);
  }
}
