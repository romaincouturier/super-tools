/**
 * Parcours d'un écran : relevé à l'arrivée, puis clic sur chaque bouton,
 * onglet et déclencheur de menu, et sur chaque bouton des modales ou menus
 * ouverts (deuxième niveau). Chaque état est relevé. Le faux backend rend les
 * clics sans conséquence ; les confirm()/alert() sont relevés puis refusés.
 */
import type { Page } from "@playwright/test";
import { findLeaks, readableTexts, type Leak, type Readable } from "./scanDom";

export type RouteLeak = Leak & { route: string; path: string };
export type RouteResult = { route: string; states: number; leaks: RouteLeak[]; errors: string[]; skipped?: string };

const MAX_TRIGGERS = Number(process.env.DEMO_SCAN_MAX_TRIGGERS ?? 60);
const MAX_NESTED = Number(process.env.DEMO_SCAN_MAX_NESTED ?? 20);
const OVERLAY = '[role="dialog"],[role="alertdialog"],[role="menu"],[data-radix-popper-content-wrapper]';

/** Numérote les déclencheurs visibles dans `scope` (document ou overlay ouvert). */
async function tagTriggers(page: Page, inOverlay: boolean): Promise<{ id: string; label: string }[]> {
  return page.evaluate(
    ([overlaySel, inOv]) => {
      document.querySelectorAll("[data-scan-id]").forEach((e) => e.removeAttribute("data-scan-id"));
      const overlays = Array.from(document.querySelectorAll(overlaySel as string));
      const root: ParentNode = inOv ? (overlays[overlays.length - 1] ?? document) : document;
      const els = Array.from(
        root.querySelectorAll('button, [role="tab"], [role="menuitem"], [role="button"], [aria-haspopup], [role="combobox"]'),
      ) as HTMLElement[];
      const seen = new Set<string>();
      const out: { id: string; label: string }[] = [];
      els.forEach((el, i) => {
        if (!inOv && el.closest(overlaySel as string)) return;
        if (el.closest("aside, nav")) return; // navigation : chaque route est visitée à part
        if ((el as HTMLButtonElement).disabled || el.getClientRects().length === 0) return;
        const icon = (el.querySelector("svg")?.getAttribute("class") ?? "").match(/lucide-([a-z0-9-]+)/)?.[1];
        const label =
          (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").trim().slice(0, 50) ||
          (icon ? `icône ${icon} #${i}` : `#${i}`);
        const key = `${el.getAttribute("role") ?? el.tagName}|${label}`;
        if (seen.has(key) && !/^#/.test(label)) return;
        seen.add(key);
        const id = `t${i}`;
        el.setAttribute("data-scan-id", id);
        out.push({ id, label });
      });
      return out;
    },
    [OVERLAY, inOverlay] as const,
  );
}

/** Pas de networkidle : les listes qui se rafraîchissent seules ne le laissent jamais arriver. */
async function settle(page: Page) {
  await page.waitForTimeout(Number(process.env.DEMO_SCAN_SETTLE_MS ?? 600));
}

async function closeOverlays(page: Page) {
  for (let i = 0; i < 3; i++) {
    if ((await page.locator(OVERLAY).count()) === 0) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
  }
}

export async function exploreRoute(page: Page, route: string): Promise<RouteResult> {
  const result: RouteResult = { route, states: 0, leaks: [], errors: [] };
  const dialogMessages: string[] = [];
  page.on("dialog", async (d) => {
    dialogMessages.push(d.message());
    await d.dismiss().catch(() => {});
  });
  page.on("pageerror", (e) => result.errors.push(e.message.slice(0, 200)));
  page.on("popup", (p) => p.close().catch(() => {}));

  const record = async (path: string) => {
    result.states++;
    const texts: Readable[] = await Promise.race([
      readableTexts(page).catch((): Readable[] => []),
      new Promise<Readable[]>((r) => setTimeout(() => r([]), 8000)),
    ]);
    for (const m of dialogMessages.splice(0)) texts.push({ text: m, where: "confirm()/alert()" });
    for (const l of findLeaks(texts)) result.leaks.push({ ...l, route, path });
  };

  const open = async () => {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2500);
  };

  await open();
  const here = new URL(page.url()).pathname;
  if (here !== route && !here.startsWith(route.split("/").slice(0, 2).join("/"))) {
    result.skipped = `redirigé vers ${here}`;
    return result;
  }
  await record("arrivée");

  const triggers = (await tagTriggers(page, false)).slice(0, MAX_TRIGGERS);
  for (const t of triggers) {
    const again = await tagTriggers(page, false);
    const target = again.find((x) => x.label === t.label) ?? again.find((x) => x.id === t.id);
    if (!target) continue;
    const clicked = await page
      .locator(`[data-scan-id="${target.id}"]`)
      .click({ timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    if (!clicked) continue;
    await settle(page);
    await record(`clic « ${t.label} »`);

    if ((await page.locator(OVERLAY).count()) > 0) {
      const nested = (await tagTriggers(page, true)).slice(0, MAX_NESTED);
      for (const n of nested) {
        if ((await page.locator(OVERLAY).count()) === 0) {
          // l'overlay s'est refermé : on le rouvre depuis le déclencheur parent
          const parent = (await tagTriggers(page, false)).find((x) => x.label === t.label);
          if (!parent) break;
          await page.locator(`[data-scan-id="${parent.id}"]`).click({ timeout: 2000 }).catch(() => {});
          await settle(page);
        }
        const inner = (await tagTriggers(page, true)).find((x) => x.label === n.label);
        if (!inner) continue;
        const ok = await page
          .locator(`[data-scan-id="${inner.id}"]`)
          .click({ timeout: 2000 })
          .then(() => true)
          .catch(() => false);
        if (!ok) continue;
        await settle(page);
        await record(`clic « ${t.label} » › « ${n.label} »`);
        if (new URL(page.url()).pathname !== route) await open();
      }
    }

    await closeOverlays(page);
    if (new URL(page.url()).pathname !== route) await open();
  }
  return result;
}
