import { describe, it, expect } from "vitest";
import { parseEmailList, siteCommentRecipients } from "./site-comment-recipients";

describe("destinataires de l'alerte commentaire site", () => {
  it("retombe sur l'expéditeur quand rien n'est réglé", () => {
    expect(siteCommentRecipients("", "expediteur@x.fr")).toEqual(["expediteur@x.fr"]);
  });
  it("utilise la liste réglée plutôt que l'expéditeur", () => {
    expect(siteCommentRecipients("r@x.fr, e@x.fr", "expediteur@x.fr")).toEqual(["r@x.fr", "e@x.fr"]);
  });
  it("accepte plusieurs adresses réglées, dédoublonnées", () => {
    expect(parseEmailList("a@x.fr, B@x.fr;a@x.fr\nc@x.fr")).toEqual(["a@x.fr", "b@x.fr", "c@x.fr"]);
  });
  it("ignore les entrées invalides", () => {
    expect(parseEmailList("pas-un-email, d@x.fr")).toEqual(["d@x.fr"]);
  });
});
