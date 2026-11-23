import { expect, it } from "vitest";
import { isResourceLimit, RESOURCE_ALERT_THRESHOLD } from "./backup-relay";

it("reconnaît l'interruption ressources du worker", () => {
  expect(isResourceLimit('HTTP 546 : {"code":"WORKER_RESOURCE_LIMIT"}')).toBe(true);
  expect(isResourceLimit("HTTP 500 : boom")).toBe(false);
});
it("alerte à partir de la troisième interruption d'un même run", () => {
  expect(RESOURCE_ALERT_THRESHOLD).toBe(3);
});
