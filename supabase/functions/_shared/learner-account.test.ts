import { describe, it, expect, vi, beforeEach } from "vitest";
import { ensureLearnerAccount, sendLearnerAccessEmail, learnerAccessLink, sendRegisteredLearnerAccessEmail, decideLearnerAccessEmail } from "./learner-account.ts";

vi.mock("./app-urls.ts", () => ({
  getAppUrls: vi.fn().mockResolvedValue({ app_url: "https://app.example.com" }),
}));
vi.mock("./signitic.ts", () => ({
  getSigniticSignature: vi.fn().mockResolvedValue("<p>Signature</p>"),
}));
vi.mock("./email-settings.ts", () => ({
  getBccList: vi.fn().mockResolvedValue([]),
}));
const sendEmailMock = vi.fn().mockResolvedValue({ success: true, id: "email-1" });
vi.mock("./resend.ts", () => ({
  sendEmail: (...args: unknown[]) => sendEmailMock(...args),
}));

type CreateUserResult = { data: { user: { id: string } | null } | null; error: { message: string } | null };

function makeAdmin(result: CreateUserResult) {
  const createUser = vi.fn().mockResolvedValue(result);
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ upsert }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = { auth: { admin: { createUser } }, from } as any;
  return { admin, createUser, upsert, from };
}

const ok = (id: string): CreateUserResult => ({ data: { user: { id } }, error: null });

describe("ensureLearnerAccount", () => {
  it("provisionne un compte sans mot de passe et marque password_set à faux", async () => {
    const { admin, createUser, from, upsert } = makeAdmin(ok("user-1"));

    await expect(ensureLearnerAccount(admin, "Jean.Dupont@Example.com")).resolves.toEqual({
      created: true,
      userId: "user-1",
    });

    expect(createUser).toHaveBeenCalledWith({
      email: "jean.dupont@example.com",
      email_confirm: true,
      user_metadata: { role: "learner" },
    });
    expect(from).toHaveBeenCalledWith("user_security_metadata");
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "user-1", password_set: false },
      { onConflict: "user_id" },
    );
  });

  it("normalise l'adresse avant toute écriture (RG-01)", async () => {
    const { admin, createUser } = makeAdmin(ok("user-2"));

    await ensureLearnerAccount(admin, "  MARIE@EXAMPLE.COM  ");

    expect(createUser.mock.calls[0][0].email).toBe("marie@example.com");
  });

  it("ne touche jamais à un compte déjà présent (S1)", async () => {
    for (const message of [
      "User already registered",
      "A user with this email address has already been registered",
      "Email exists",
    ]) {
      const { admin, upsert } = makeAdmin({ data: null, error: { message } });

      await expect(ensureLearnerAccount(admin, "connu@example.com")).resolves.toEqual({
        created: false,
        userId: null,
      });
      expect(upsert).not.toHaveBeenCalled();
    }
  });

  it("remonte toute autre erreur au lieu de la faire passer pour un compte existant", async () => {
    const { admin } = makeAdmin({ data: null, error: { message: "Database connection lost" } });

    await expect(ensureLearnerAccount(admin, "panne@example.com")).rejects.toMatchObject({
      message: "Database connection lost",
    });
  });

  it("refuse une adresse inutilisable sans appeler le service d'authentification (RG-18)", async () => {
    for (const email of ["", "   ", "pas-une-adresse", "sans-domaine@", "@example.com", "a@"]) {
      const { admin, createUser } = makeAdmin(ok("jamais"));

      await expect(ensureLearnerAccount(admin, email)).resolves.toEqual({
        created: false,
        userId: null,
      });
      expect(createUser).not.toHaveBeenCalled();
    }
  });

  it("rend created à vrai même si l'identifiant n'est pas renvoyé, sans écrire de métadonnées", async () => {
    const { admin, upsert } = makeAdmin({ data: { user: null }, error: null });

    await expect(ensureLearnerAccount(admin, "sans-id@example.com")).resolves.toEqual({
      created: true,
      userId: null,
    });
    expect(upsert).not.toHaveBeenCalled();
  });
});

function makeAccessAdmin(opts: {
  quotaAllowed?: boolean;
  passwordSet: boolean | null;
  generateLink?: { data?: unknown; error?: unknown };
  quotaError?: unknown;
  passwordError?: unknown;
}) {
  const rpc = vi.fn((name: string) => {
    if (name === "check_link_quota") return Promise.resolve({ data: opts.quotaAllowed ?? true, error: opts.quotaError });
    if (name === "learner_password_set") return Promise.resolve({ data: opts.passwordSet, error: opts.passwordError });
    throw new Error(`RPC inattendue : ${name}`);
  });
  const generateLink = vi.fn().mockResolvedValue(
    opts.generateLink ?? {
      data: { properties: { hashed_token: "abc123" } },
      error: null,
    },
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = { rpc, auth: { admin: { generateLink } } } as any;
  return { admin, rpc, generateLink };
}

describe("sendLearnerAccessEmail", () => {
  beforeEach(() => {
    sendEmailMock.mockClear();
  });

  it("n'envoie rien pour une adresse inutilisable, sans appeler le quota", async () => {
    const { admin, rpc } = makeAccessAdmin({ passwordSet: true });

    await expect(sendLearnerAccessEmail(admin, "pas-une-adresse")).resolves.toEqual({ sent: false });
    expect(rpc).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("n'envoie rien si le quota RG-08 est dépassé", async () => {
    const { admin } = makeAccessAdmin({ quotaAllowed: false, passwordSet: true });

    await expect(sendLearnerAccessEmail(admin, "connu@example.com")).resolves.toEqual({ sent: false });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("n'envoie rien si l'adresse ne correspond à aucun compte, sans le révéler", async () => {
    const { admin } = makeAccessAdmin({ passwordSet: null });

    await expect(sendLearnerAccessEmail(admin, "inconnu@example.com")).resolves.toEqual({ sent: false });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("compte sans mot de passe : génère un lien recovery vers l'écran de création, jamais de session ouverte", async () => {
    const { admin, generateLink } = makeAccessAdmin({ passwordSet: false });

    await expect(sendLearnerAccessEmail(admin, "nouveau@example.com")).resolves.toMatchObject({ sent: true });

    expect(generateLink).toHaveBeenCalledWith({
      type: "recovery",
      email: "nouveau@example.com",
      options: { redirectTo: "https://app.example.com/connexion/reinitialisation" },
    });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0];
    expect(call.subject).toBe("Créez votre mot de passe SuperTools");
    // RG-21 : jamais l'action_link Supabase (auth/v1/verify), qui consommerait
    // le jeton dès la requête GET — seulement notre propre URL avec le
    // token_hash, consommé au clic sur ConnexionReinitialisation.tsx.
    expect(call.html).toContain("https://app.example.com/connexion/reinitialisation?token_hash=abc123&type=recovery");
    expect(call.html).not.toContain("auth/v1/verify");
    expect(call.html).toContain("Créer mon mot de passe");
  });

  it("compte avec mot de passe : préremplit /connexion sans générer de lien Supabase ni authentifier", async () => {
    const { admin, generateLink } = makeAccessAdmin({ passwordSet: true });

    await expect(sendLearnerAccessEmail(admin, "Connu@Example.com")).resolves.toMatchObject({ sent: true });

    expect(generateLink).not.toHaveBeenCalled();
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0];
    expect(call.subject).toBe("Accéder à votre espace SuperTools");
    expect(call.html).toContain("https://app.example.com/connexion?email=connu%40example.com");
    expect(call.html).not.toContain("token_hash");
  });

  it("rend sent à faux si Supabase échoue à générer le lien recovery", async () => {
    const { admin } = makeAccessAdmin({
      passwordSet: false,
      generateLink: { data: null, error: { message: "boom" } },
    });

    await expect(sendLearnerAccessEmail(admin, "panne@example.com")).resolves.toEqual({ sent: false });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("sendRegisteredLearnerAccessEmail", () => {
  beforeEach(() => sendEmailMock.mockClear());

  it("recrée le compte d'une apprenante inscrite avant d'envoyer son accès", async () => {
    const { admin, rpc } = makeAccessAdmin({ passwordSet: false });
    const { createUser, from, upsert } = makeAdmin(ok("new-user"));
    admin.auth.admin.createUser = createUser;
    admin.from = from;
    const originalRpc = rpc.getMockImplementation();
    rpc.mockImplementation((name: string) => name === "is_known_learner"
      ? Promise.resolve({ data: true })
      : originalRpc?.(name));
    await expect(sendRegisteredLearnerAccessEmail(admin, "ColetteNicorette@Yahoo.com")).resolves.toMatchObject({ sent: true });
    expect(createUser).toHaveBeenCalledWith({ email: "colettenicorette@yahoo.com", email_confirm: true, user_metadata: { role: "learner" } });
    expect(upsert).toHaveBeenCalledWith({ user_id: "new-user", password_set: false }, { onConflict: "user_id" });
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });

  it("refuse de créer un compte pour une adresse non inscrite", async () => {
    const { admin, createUser } = makeAdmin(ok("never"));
    admin.rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    await expect(sendRegisteredLearnerAccessEmail(admin, "unknown@example.com")).rejects.toThrow("aucune inscription");
    expect(createUser).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("signale un email non envoyé au lieu d'annoncer un succès", async () => {
    const { admin, rpc } = makeAccessAdmin({ passwordSet: true, quotaAllowed: false });
    const { createUser } = makeAdmin({ data: null, error: { message: "User already registered" } });
    admin.auth.admin.createUser = createUser;
    const originalRpc = rpc.getMockImplementation();
    rpc.mockImplementation((name: string) => name === "is_known_learner"
      ? Promise.resolve({ data: true })
      : originalRpc?.(name));
    await expect(sendRegisteredLearnerAccessEmail(admin, "known@example.com")).rejects.toMatchObject({ status: 429, message: expect.stringContaining("Quota interne atteint") });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("causes des échecs d’accès staff", () => {
  beforeEach(() => sendEmailMock.mockReset().mockResolvedValue({ success: true, id: "email-1" }));

  it("bloque l’envoi si la vérification du quota échoue", async () => {
    const { admin, generateLink } = makeAccessAdmin({ passwordSet: false, quotaError: { message: "database unavailable" } });
    await expect(sendLearnerAccessEmail(admin, "a@example.com", { strict: true })).rejects.toMatchObject({ status: 500, message: expect.stringContaining("Vérification du quota indisponible") });
    expect(generateLink).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("distingue une erreur de lecture du compte d’un compte inconnu", async () => {
    const { admin } = makeAccessAdmin({ passwordSet: null, passwordError: { message: "database unavailable" } });
    await expect(sendLearnerAccessEmail(admin, "a@example.com", { strict: true })).rejects.toThrow("État du compte apprenant indisponible");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("indique le statut de génération du lien sans exposer de jeton", async () => {
    const { admin } = makeAccessAdmin({ passwordSet: false, generateLink: { data: null, error: { code: "over_request_rate_limit", status: 429 } } });
    await expect(sendLearnerAccessEmail(admin, "a@example.com", { strict: true })).rejects.toThrow("over_request_rate_limit, statut 429");
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("conserve l’erreur du service d’envoi", async () => {
    sendEmailMock.mockResolvedValueOnce({ success: false, error: "Resend API error: 429" });
    const { admin } = makeAccessAdmin({ passwordSet: true });
    await expect(sendLearnerAccessEmail(admin, "a@example.com", { strict: true })).rejects.toThrow("Resend API error: 429");
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});

describe("quota des tests administrateur", () => {
  function registeredAdmin(isAdmin: boolean, adminError: unknown = null) {
    const { admin, rpc } = makeAccessAdmin({ passwordSet: true, quotaAllowed: false });
    const { createUser } = makeAdmin({ data: null, error: { message: "User already registered" } });
    admin.auth.admin.createUser = createUser;
    const originalRpc = rpc.getMockImplementation();
    rpc.mockImplementation((name: string) => {
      if (name === "is_known_learner") return Promise.resolve({ data: true, error: null });
      if (name === "is_admin") return Promise.resolve({ data: isAdmin, error: adminError });
      return originalRpc?.(name);
    });
    return { admin, rpc, createUser };
  }

  beforeEach(() => sendEmailMock.mockReset().mockResolvedValue({ success: true, id: "email-1" }));

  it("permet plus de trois tests au même destinataire pour un administrateur vérifié", async () => {
    const { admin, rpc } = registeredAdmin(true);
    for (let i = 0; i < 12; i += 1) {
      await expect(sendRegisteredLearnerAccessEmail(admin, "test@example.com", { callerId: "verified-admin" })).resolves.toMatchObject({ sent: true });
    }
    expect(sendEmailMock).toHaveBeenCalledTimes(12);
    expect(rpc).toHaveBeenCalledWith("is_admin", { _user_id: "verified-admin" });
    expect(rpc.mock.calls.some(([name]) => name === "check_link_quota")).toBe(false);
  });

  it("conserve le quota pour un collaborateur non administrateur", async () => {
    const { admin, rpc } = registeredAdmin(false);
    await expect(sendRegisteredLearnerAccessEmail(admin, "test@example.com", { callerId: "staff" })).rejects.toMatchObject({ status: 429 });
    expect(rpc.mock.calls.some(([name]) => name === "check_link_quota")).toBe(true);
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("refuse l’exemption si les droits ne peuvent pas être vérifiés", async () => {
    const { admin, createUser } = registeredAdmin(true, { message: "lookup failed" });
    await expect(sendRegisteredLearnerAccessEmail(admin, "test@example.com", { callerId: "staff" })).rejects.toThrow("droits administrateur indisponible");
    expect(createUser).not.toHaveBeenCalled();
    expect(sendEmailMock).not.toHaveBeenCalled();
  });
});

describe("learnerAccessLink", () => {
  it("renvoie null pour une adresse inutilisable", async () => {
    const { admin, rpc } = makeAccessAdmin({ passwordSet: true });
    await expect(learnerAccessLink(admin, "  ")).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("renvoie null si l'adresse ne correspond à aucun compte", async () => {
    const { admin } = makeAccessAdmin({ passwordSet: null });
    await expect(learnerAccessLink(admin, "inconnu@example.com")).resolves.toBeNull();
  });

  it("compte sans mot de passe : lien token_hash vers l'écran de création, jamais action_link (RG-21)", async () => {
    const { admin, generateLink } = makeAccessAdmin({ passwordSet: false });

    await expect(learnerAccessLink(admin, "nouveau@example.com")).resolves.toEqual({
      actionLink: "https://app.example.com/connexion/reinitialisation?token_hash=abc123&type=recovery",
      passwordSet: false,
    });
    expect(generateLink).toHaveBeenCalledWith({
      type: "recovery",
      email: "nouveau@example.com",
      options: { redirectTo: "https://app.example.com/connexion/reinitialisation" },
    });
  });

  it("compte avec mot de passe : lien qui préremplit /connexion, sans generateLink", async () => {
    const { admin, generateLink } = makeAccessAdmin({ passwordSet: true });

    await expect(learnerAccessLink(admin, "Connu@Example.com")).resolves.toEqual({
      actionLink: "https://app.example.com/connexion?email=connu%40example.com",
      passwordSet: true,
    });
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("renvoie null si Supabase échoue à générer le lien recovery", async () => {
    const { admin } = makeAccessAdmin({
      passwordSet: false,
      generateLink: { data: null, error: { message: "boom" } },
    });
    await expect(learnerAccessLink(admin, "panne@example.com")).resolves.toBeNull();
  });

  it("renvoie null si Supabase ne renvoie pas de hashed_token, même sans erreur", async () => {
    const { admin } = makeAccessAdmin({
      passwordSet: false,
      generateLink: { data: { properties: {} }, error: null },
    });
    await expect(learnerAccessLink(admin, "panne@example.com")).resolves.toBeNull();
  });
});

describe("decideLearnerAccessEmail (règle du 04/11/2026)", () => {
  it("compte sans mot de passe prouvé : création du mot de passe, même avec une formation", () => {
    expect(decideLearnerAccessEmail({ passwordSet: false, hasTraining: true })).toBe("create_password");
  });
  it("compte avec mot de passe ajouté à une formation : accès ouvert", () => {
    expect(decideLearnerAccessEmail({ passwordSet: true, hasTraining: true })).toBe("course_access");
  });
  it("compte avec mot de passe sans formation : accès à l'espace", () => {
    expect(decideLearnerAccessEmail({ passwordSet: true, hasTraining: false })).toBe("space_access");
  });
});

describe("mails d'accès selon l'état du compte", () => {
  beforeEach(() => sendEmailMock.mockReset().mockResolvedValue({ success: true, id: "email-1" }));

  it("mot de passe défini : « Votre accès à … est ouvert » avec lien direct vers le cours, sans jeton", async () => {
    const { admin, generateLink } = makeAccessAdmin({ passwordSet: true });
    await expect(sendLearnerAccessEmail(admin, "connu@example.com", { trainingName: "Facilitation graphique", courseId: "course-1" }))
      .resolves.toEqual({ sent: true, kind: "course_access" });
    expect(generateLink).not.toHaveBeenCalled();
    const call = sendEmailMock.mock.calls[0][0];
    expect(call.subject).toBe("Votre accès à « Facilitation graphique » est ouvert");
    expect(call.html).toContain("https://app.example.com/lms/course-1/home?email=connu%40example.com");
    expect(call.html).not.toContain("token_hash");
  });

  it("compte existant sans mot de passe : création du mot de passe, formation nommée et plateforme changée", async () => {
    const { admin } = makeAccessAdmin({ passwordSet: false });
    await expect(sendLearnerAccessEmail(admin, "ancien@example.com", { trainingName: "Agilité", accountCreated: false }))
      .resolves.toEqual({ sent: true, kind: "create_password" });
    const call = sendEmailMock.mock.calls[0][0];
    expect(call.subject).toBe("Créez votre mot de passe SuperTools");
    expect(call.html).toContain("Agilité");
    expect(call.html).toContain("plateforme de formation a changé");
  });

  it("compte tout juste créé : création du mot de passe sans mention de changement de plateforme", async () => {
    const { admin } = makeAccessAdmin({ passwordSet: false });
    await sendLearnerAccessEmail(admin, "nouveau@example.com", { trainingName: "Agilité", accountCreated: true });
    expect(sendEmailMock.mock.calls[0][0].html).not.toContain("plateforme de formation a changé");
  });
});
