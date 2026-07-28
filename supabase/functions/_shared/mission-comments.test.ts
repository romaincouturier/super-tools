import { describe, it, expect } from "vitest";
import {
  validateCommentBody,
  checkCanComment,
  checkCanDelete,
  resolveThreadParentId,
  isRateLimited,
  rateLimitSince,
  notificationRecipients,
  MAX_BODY_LENGTH,
  RATE_LIMIT_MAX_COMMENTS,
  DELETE_WINDOW_MINUTES,
  type CommentAuthor,
  type CommentPage,
} from "./mission-comments.ts";

const contact: CommentAuthor = {
  contactId: "contact-1",
  userId: null,
  missionId: "mission-1",
  name: "Marie Dupont",
  email: "marie@client.fr",
  isStaff: false,
};

const staff: CommentAuthor = {
  contactId: null,
  userId: "user-1",
  missionId: null,
  name: "Romain",
  email: "romain@supertilt.fr",
  isStaff: true,
};

const openPage: CommentPage = {
  id: "page-1",
  mission_id: "mission-1",
  is_deliverable: true,
  comments_enabled: true,
};

describe("validateCommentBody", () => {
  it("refuse un corps vide ou blanc", () => {
    expect(validateCommentBody("").error?.status).toBe(400);
    expect(validateCommentBody("   ").error?.status).toBe(400);
    expect(validateCommentBody(undefined).error?.status).toBe(400);
    expect(validateCommentBody(42).error?.status).toBe(400);
  });

  it("refuse au-delà de la longueur maximale", () => {
    expect(validateCommentBody("a".repeat(MAX_BODY_LENGTH + 1)).error?.status).toBe(400);
    expect(validateCommentBody("a".repeat(MAX_BODY_LENGTH)).body).toHaveLength(MAX_BODY_LENGTH);
  });

  it("nettoie les espaces autour", () => {
    expect(validateCommentBody("  bonjour \n").body).toBe("bonjour");
  });
});

describe("checkCanComment", () => {
  it("autorise un contact sur une page ouverte de sa mission", () => {
    expect(checkCanComment(openPage, contact)).toBeNull();
  });

  it("autorise le staff", () => {
    expect(checkCanComment(openPage, staff)).toBeNull();
  });

  it("refuse une page inexistante", () => {
    expect(checkCanComment(null, staff)?.status).toBe(404);
  });

  it("refuse une page dont les commentaires sont fermés", () => {
    expect(checkCanComment({ ...openPage, comments_enabled: false }, contact)?.status).toBe(403);
  });

  it("refuse une page qui n'est pas un livrable", () => {
    expect(checkCanComment({ ...openPage, is_deliverable: false }, contact)?.status).toBe(403);
  });

  it("refuse un token de contact d'une autre mission", () => {
    const other = { ...contact, missionId: "mission-2" };
    expect(checkCanComment(openPage, other)?.status).toBe(403);
  });

  it("n'applique pas le contrôle de mission au staff", () => {
    expect(checkCanComment({ ...openPage, mission_id: "mission-9" }, staff)).toBeNull();
  });
});

describe("checkCanDelete", () => {
  const now = Date.UTC(2026, 6, 28, 12, 0, 0);
  const minutesAgo = (n: number) => new Date(now - n * 60_000).toISOString();

  it("laisse le staff supprimer n'importe quel commentaire, même ancien", () => {
    const comment = { author_contact_id: "contact-9", created_at: minutesAgo(600) };
    expect(checkCanDelete(comment, staff, now)).toBeNull();
  });

  it("laisse un contact supprimer son propre commentaire récent", () => {
    const comment = { author_contact_id: "contact-1", created_at: minutesAgo(5) };
    expect(checkCanDelete(comment, contact, now)).toBeNull();
  });

  it("refuse au contact le commentaire d'un autre", () => {
    const comment = { author_contact_id: "contact-2", created_at: minutesAgo(1) };
    expect(checkCanDelete(comment, contact, now)?.status).toBe(403);
  });

  it("refuse au contact son commentaire au-delà de la fenêtre", () => {
    const comment = { author_contact_id: "contact-1", created_at: minutesAgo(DELETE_WINDOW_MINUTES + 1) };
    expect(checkCanDelete(comment, contact, now)?.status).toBe(403);
  });

  it("refuse un commentaire de staff à un contact", () => {
    const comment = { author_contact_id: null, created_at: minutesAgo(1) };
    expect(checkCanDelete(comment, contact, now)?.status).toBe(403);
  });

  it("refuse un commentaire inexistant", () => {
    expect(checkCanDelete(null, staff, now)?.status).toBe(404);
  });
});

describe("resolveThreadParentId", () => {
  it("retourne null pour un commentaire racine", () => {
    expect(resolveThreadParentId(null, "page-1").parentId).toBeNull();
  });

  it("attache la réponse à la racine visée", () => {
    const parent = { id: "root-1", page_id: "page-1", parent_comment_id: null };
    expect(resolveThreadParentId(parent, "page-1").parentId).toBe("root-1");
  });

  it("remonte à la racine quand on répond à une réponse", () => {
    const parent = { id: "reply-1", page_id: "page-1", parent_comment_id: "root-1" };
    expect(resolveThreadParentId(parent, "page-1").parentId).toBe("root-1");
  });

  it("refuse un fil appartenant à une autre page", () => {
    const parent = { id: "root-1", page_id: "page-2", parent_comment_id: null };
    expect(resolveThreadParentId(parent, "page-1").error?.status).toBe(404);
  });
});

describe("rate limit", () => {
  it("bloque à partir du seuil", () => {
    expect(isRateLimited(RATE_LIMIT_MAX_COMMENTS - 1)).toBe(false);
    expect(isRateLimited(RATE_LIMIT_MAX_COMMENTS)).toBe(true);
  });

  it("calcule une borne dans le passé", () => {
    const now = Date.UTC(2026, 6, 28, 12, 0, 0);
    expect(new Date(rateLimitSince(now)).getTime()).toBeLessThan(now);
  });
});

describe("notificationRecipients", () => {
  it("réunit le consultant et les participants du fil", () => {
    const emails = notificationRecipients({
      consultantEmail: "romain@supertilt.fr",
      threadEmails: ["marie@client.fr", "paul@client.fr"],
      authorEmail: "jean@client.fr",
    });
    expect(emails.sort()).toEqual(["marie@client.fr", "paul@client.fr", "romain@supertilt.fr"]);
  });

  it("n'écrit jamais à l'auteur du commentaire, quelle que soit la casse", () => {
    const emails = notificationRecipients({
      consultantEmail: "romain@supertilt.fr",
      threadEmails: ["Marie@Client.fr", "romain@supertilt.fr"],
      authorEmail: "MARIE@client.fr",
    });
    expect(emails).toEqual(["romain@supertilt.fr"]);
  });

  it("dédoublonne et ignore les emails absents", () => {
    const emails = notificationRecipients({
      consultantEmail: null,
      threadEmails: ["marie@client.fr", null, undefined, "marie@client.fr"],
      authorEmail: null,
    });
    expect(emails).toEqual(["marie@client.fr"]);
  });

  it("retourne une liste vide quand le seul destinataire est l'auteur", () => {
    const emails = notificationRecipients({
      consultantEmail: "romain@supertilt.fr",
      threadEmails: ["romain@supertilt.fr"],
      authorEmail: "romain@supertilt.fr",
    });
    expect(emails).toEqual([]);
  });
});
