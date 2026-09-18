import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { createTestDb, loadFunctions, createAuthUser, actAs, type TestDb } from "./helpers/db";

/**
 * Critère 11 et faille S4 : les données du portail ne s'obtiennent qu'avec une
 * session, et seulement pour sa propre adresse. Le staff garde la
 * prévisualisation.
 */
let db: TestDb;
const STAFF = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

async function portal(email: string) {
  const res = await db.query<{ get_learner_portal_data: { email: string } }>(
    "SELECT public.get_learner_portal_data($1)", [email],
  );
  return res.rows[0].get_learner_portal_data;
}

beforeAll(async () => {
  db = await createTestDb();
  await loadFunctions(db, [
    { migration: "20260918140000_academie_formations_dans_portail.sql", name: "get_learner_portal_data" },
  ]);
});

beforeEach(async () => {
  await db.exec(
    "TRUNCATE profiles, training_participants, trainings, lms_enrollments, lms_courses; DELETE FROM auth.users;",
  );
  await db.query("INSERT INTO profiles (user_id, email) VALUES ($1, $2)", [STAFF, "staff@supertilt.fr"]);
});

describe("get_learner_portal_data", () => {
  it("refuse un appelant sans session", async () => {
    await actAs(db, null);
    await expect(portal("alice@exemple.fr")).rejects.toThrow(/Authentification requise/);
  });

  it("refuse un apprenant qui demande l'adresse d'un autre", async () => {
    const id = await createAuthUser(db, "alice@exemple.fr");
    await actAs(db, { uid: id, email: "alice@exemple.fr" });
    await expect(portal("bob@exemple.fr")).rejects.toThrow(/Accès refusé/);
  });

  it("laisse un apprenant lire sa propre adresse", async () => {
    const id = await createAuthUser(db, "alice@exemple.fr");
    await actAs(db, { uid: id, email: "alice@exemple.fr" });
    const data = await portal("alice@exemple.fr");
    expect(data.email).toBe("alice@exemple.fr");
  });

  it("ignore la casse entre le jeton et l'adresse demandée", async () => {
    const id = await createAuthUser(db, "alice@exemple.fr");
    await actAs(db, { uid: id, email: "alice@exemple.fr" });
    const data = await portal("Alice@Exemple.FR");
    expect(data.email).toBe("Alice@Exemple.FR");
  });

  it("laisse l'équipe prévisualiser l'espace d'un apprenant", async () => {
    await actAs(db, { uid: STAFF, email: "staff@supertilt.fr" });
    const data = await portal("alice@exemple.fr");
    expect(data.email).toBe("alice@exemple.fr");
  });

  it("affiche une formation gratuite rejointe en autonomie, sans ligne training_participants", async () => {
    const id = await createAuthUser(db, "carla@exemple.fr");
    await actAs(db, { uid: id, email: "carla@exemple.fr" });
    const course = await db.query<{ id: string }>(
      "INSERT INTO lms_courses (title, status) VALUES ($1, 'published') RETURNING id",
      ["Sketchnoting débutant"],
    );
    const courseId = course.rows[0].id;
    await db.query(
      "INSERT INTO lms_enrollments (course_id, learner_email, completion_percentage) VALUES ($1, $2, $3)",
      [courseId, "carla@exemple.fr", 42],
    );

    const data = await portal("carla@exemple.fr");
    expect(data.trainings).toHaveLength(1);
    expect(data.trainings[0]).toMatchObject({
      training_name: "Sketchnoting débutant",
      lms_course_id: courseId,
      lms_completion: 42,
      participant_id: null,
      is_permanent: true,
    });
  });

  it("ne duplique pas une formation déjà comptée via training_participants", async () => {
    const id = await createAuthUser(db, "dan@exemple.fr");
    await actAs(db, { uid: id, email: "dan@exemple.fr" });
    const course = await db.query<{ id: string }>(
      "INSERT INTO lms_courses (title, status) VALUES ($1, 'published') RETURNING id",
      ["IA appliquée"],
    );
    const courseId = course.rows[0].id;
    const training = await db.query<{ id: string }>(
      "INSERT INTO trainings (training_name, supports_lms_course_id) VALUES ($1, $2) RETURNING id",
      ["IA appliquée — session", courseId],
    );
    await db.query(
      "INSERT INTO training_participants (training_id, email) VALUES ($1, $2)",
      [training.rows[0].id, "dan@exemple.fr"],
    );
    await db.query(
      "INSERT INTO lms_enrollments (course_id, learner_email) VALUES ($1, $2)",
      [courseId, "dan@exemple.fr"],
    );

    const data = await portal("dan@exemple.fr");
    expect(data.trainings).toHaveLength(1);
    expect(data.trainings[0].participant_id).not.toBeNull();
  });
});
