import * as fs from "node:fs";
import * as path from "node:path";
import { test, expect } from "@playwright/test";
import { loadSchema } from "./schema";
import { installFakeBackend } from "./fakeBackend";
import { staffRoutes } from "./routes";
import { exploreRoute } from "./explore";

const schema = loadSchema();
export const RESULTS_DIR = path.resolve(process.cwd(), "test-results/demo-scan");

for (const route of staffRoutes()) {
  test(`mode démo — ${route}`, async ({ page }) => {
    test.setTimeout(Number(process.env.DEMO_SCAN_ROUTE_TIMEOUT ?? 420_000));
    await installFakeBackend(page, schema);
    const result = await exploreRoute(page, route);
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    fs.writeFileSync(path.join(RESULTS_DIR, `${route.replace(/\W+/g, "_") || "root"}.json`), JSON.stringify(result, null, 2));
    expect(result.leaks, `${result.leaks.length} fuite(s) sur ${route}`).toEqual([]);
  });
}
