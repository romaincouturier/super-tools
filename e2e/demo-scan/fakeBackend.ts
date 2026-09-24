/**
 * Faux Supabase servi au navigateur : auth, PostgREST, RPC, edge functions et
 * stockage sont interceptés, rien ne sort de la machine. On peut donc cliquer
 * sur tous les boutons de l'application sans risque : aucune écriture réelle.
 */
import type { Page, Route } from "@playwright/test";
import { FIXED_ID, USER_ID, rowsFor } from "./canary";
import type { Schema } from "./schema";

export const SUPABASE_URL = "https://demoscan.supabase.co";
const STORAGE_KEY = "sb-demoscan-auth-token";

const TEAM_PROFILE = {
  id: USER_ID,
  user_id: USER_ID,
  email: "equipe@supertilt.fr",
  first_name: "Equipe",
  last_name: "SuperTilt",
  is_admin: true,
  demo_mode: true,
  photo_url: null,
};

const USER = {
  id: USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "equipe@supertilt.fr",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
};

function fakeJwt(): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub: USER_ID, role: "authenticated", exp: 4102444800 })}.sig`;
}

const SESSION = {
  access_token: fakeJwt(),
  refresh_token: "demo-scan-refresh",
  token_type: "bearer",
  expires_in: 3600 * 24 * 365 * 50,
  expires_at: 4102444800,
  user: USER,
};

/** RPC dont la réponse conditionne l'accès : staff, admin, tous les modules. */
const RPC_ANSWERS: Record<string, unknown> = {
  current_user_access_level: "staff",
  is_admin: true,
  has_module_access: true,
  has_crm_access: true,
  is_staff_user: true,
  get_app_setting_public: null,
};

/** Réglages : sans ligne, l'application prend ses valeurs par défaut. */
const EMPTY_TABLES = new Set(["app_settings", "user_security_metadata"]);

/** `a,b,rel:table(c,d),other!fk(*)` → embeds de premier niveau, récursifs. */
type Embed = { key: string; table: string; inner: string };
function parseEmbeds(select: string): Embed[] {
  const embeds: Embed[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i <= select.length; i++) {
    const ch = select[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if ((ch === "," && depth === 0) || i === select.length) {
      const part = select.slice(start, i).trim();
      start = i + 1;
      const m = part.match(/^(?:([\w]+):)?([\w]+)(?:![\w]+)?(?:!inner)?\((.*)\)$/s);
      if (m) embeds.push({ key: m[1] ?? m[2], table: m[2], inner: m[3] });
    }
  }
  return embeds;
}

function withEmbeds(schema: Schema, table: string, select: string, count: number): Record<string, unknown>[] {
  const rows = rowsFor(schema, table, count);
  for (const e of parseEmbeds(select)) {
    const isList = e.table.endsWith("s") && e.table === e.key && !(`${e.table.replace(/s$/, "")}_id` in (rows[0] ?? {}));
    for (const row of rows) {
      const nested = schema.tables[e.table] ? withEmbeds(schema, e.table, e.inner, isList ? 2 : 1) : [{}];
      row[e.key] = isList ? nested : nested[0];
    }
  }
  return rows;
}

function json(route: Route, body: unknown, headers: Record<string, string> = {}) {
  return route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*", ...headers },
    body: JSON.stringify(body),
  });
}

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

export async function installFakeBackend(page: Page, schema: Schema): Promise<void> {
  await page.addInitScript(
    ([key, session]) => {
      window.localStorage.setItem(key as string, JSON.stringify(session));
    },
    [STORAGE_KEY, SESSION] as const,
  );

  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });

    if (p.startsWith("/auth/v1/user")) return json(route, USER);
    if (p.startsWith("/auth/v1/token")) return json(route, SESSION);
    if (p.startsWith("/auth/v1/")) return json(route, {});

    if (p.startsWith("/rest/v1/rpc/")) {
      const fn = p.split("/").pop() ?? "";
      return json(route, fn in RPC_ANSWERS ? RPC_ANSWERS[fn] : []);
    }

    if (p.startsWith("/rest/v1/")) {
      const table = p.split("/")[3];
      const single = (req.headers()["accept"] ?? "").includes("vnd.pgrst.object");
      let rows: Record<string, unknown>[];
      if (table === "profiles") rows = [TEAM_PROFILE];
      else if (EMPTY_TABLES.has(table)) rows = [];
      else rows = withEmbeds(schema, table, url.searchParams.get("select") ?? "*", 3);
      if (req.method() !== "GET" && req.method() !== "HEAD") {
        const body = req.postDataJSON?.() ?? rows;
        return json(route, single ? (Array.isArray(body) ? body[0] : body) : Array.isArray(body) ? body : [body]);
      }
      const idFilter = url.searchParams.get("id");
      if (idFilter?.startsWith("eq.")) rows = rows.filter((r) => r.id === idFilter.slice(3)).concat(rows).slice(0, 1);
      return json(route, single ? rows[0] ?? null : rows, { "content-range": `0-${Math.max(rows.length - 1, 0)}/${rows.length}` });
    }

    if (p.startsWith("/functions/v1/")) return json(route, {});
    if (p.includes("/storage/v1/object/sign")) return json(route, { signedURL: `/storage/v1/object/public/demo/${FIXED_ID}.png`, signedUrls: [] });
    if (p.startsWith("/storage/v1/")) return route.fulfill({ status: 200, contentType: "image/png", body: PNG });
    return json(route, {});
  });

  // Rien d'autre ne sort : polices, analytics, Sentry, API tierces.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1|localhost|demoscan\.supabase\.co)/, (route) => route.abort());
}
