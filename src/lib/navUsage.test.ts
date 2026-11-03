import { describe, it, expect } from "vitest";
import { sortNavByUsage, type NavConfig } from "./navUsage";

const PATHS: Record<string, string> = {
  crm: "/crm",
  missions: "/missions",
  "supertilt-fr": "/supertilt-fr",
  "sf-newsletter": "/supertilt-fr/newsletter",
  "sf-projets": "/supertilt-fr/projets",
  "projets-transverses": "/projets-transverses",
  dropshipping: "/dropshipping",
  "commandes-jeux": "/commandes-jeux",
  wc_inbox: "/commandes/inbox",
};
const pathOf = (key: string) => PATHS[key];
const keys = (nav: NavConfig[]) => nav.map((e) => e.key);

const SF_GROUP: NavConfig = {
  type: "group",
  key: "supertilt-fr",
  children: [{ key: "sf-newsletter" }, { key: "sf-projets" }],
};

describe("sortNavByUsage", () => {
  it("conserve l'ordre de config sans statistiques", () => {
    const config: NavConfig[] = [{ type: "item", key: "missions" }, { type: "item", key: "crm" }];
    expect(keys(sortNavByUsage(config, new Map(), pathOf))).toEqual(["missions", "crm"]);
  });

  it("compte une seule fois le segment partagé par un groupe et ses sous-items", () => {
    const config: NavConfig[] = [SF_GROUP, { type: "item", key: "crm" }];
    const counts = new Map([["supertilt-fr", 10], ["crm", 25]]);
    // 10 clics, pas 30 (parent + 2 enfants sur /supertilt-fr) : crm reste devant.
    expect(keys(sortNavByUsage(config, counts, pathOf))).toEqual(["crm", "supertilt-fr"]);
  });

  it("additionne les segments distincts d'un groupe", () => {
    const config: NavConfig[] = [
      { type: "item", key: "crm" },
      { type: "group", key: "dropshipping", children: [{ key: "commandes-jeux" }, { key: "wc_inbox" }] },
    ];
    const counts = new Map([["crm", 20], ["commandes-jeux", 12], ["commandes", 12]]);
    expect(keys(sortNavByUsage(config, counts, pathOf))).toEqual(["dropshipping", "crm"]);
  });

  it("reprend les clics des anciens segments renommés", () => {
    const config: NavConfig[] = [
      { type: "item", key: "crm" },
      SF_GROUP,
      { type: "item", key: "projets-transverses" },
    ];
    const counts = new Map([["crm", 30], ["contenu", 20], ["transcripts", 15], ["supertilt", 40]]);
    expect(keys(sortNavByUsage(config, counts, pathOf))).toEqual(["projets-transverses", "supertilt-fr", "crm"]);
  });

  it("trie les sous-items d'un groupe par clics", () => {
    const config: NavConfig[] = [
      { type: "group", key: "dropshipping", children: [{ key: "commandes-jeux" }, { key: "wc_inbox" }] },
    ];
    const sorted = sortNavByUsage(config, new Map([["commandes", 5], ["commandes-jeux", 1]]), pathOf);
    expect(sorted[0].type === "group" && sorted[0].children.map((c) => c.key)).toEqual(["wc_inbox", "commandes-jeux"]);
  });

  it("ignore une entrée sans chemin connu", () => {
    const config: NavConfig[] = [{ type: "item", key: "inconnu" }, { type: "item", key: "crm" }];
    expect(keys(sortNavByUsage(config, new Map([["crm", 1]]), pathOf))).toEqual(["crm", "inconnu"]);
  });
});
