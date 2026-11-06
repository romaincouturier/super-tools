import { describe, it, expect } from "vitest";
import { parseEmailList, siteCommentRecipients } from "./site-comment-recipients";

describe("destinataires de l'alerte commentaire site", () => {
  it("ajoute Emmanuelle par défaut quand rien n'est réglé", () => {
    expect(siteCommentRecipients("")).toEqual(["romain@supertilt.fr", "emmanuelle@supertilt.fr"]);
  });
  it("accepte plusieurs adresses réglées, dédoublonnées", () => {
    expect(parseEmailList("a@x.fr, B@x.fr;a@x.fr\nc@x.fr")).toEqual(["a@x.fr", "b@x.fr", "c@x.fr"]);
  });
  it("ignore les entrées invalides", () => {
    expect(parseEmailList("pas-un-email, d@x.fr")).toEqual(["d@x.fr"]);
  });
});
