import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(here, "../../migrations");
/** Migrations différées après la publication du front : voir leur README. */
const DEFERRED_DIR = path.resolve(here, "../../migrations-apres-front");

/**
 * Harnais SQL des règles de connexion.
 *
 * Les fonctions testées ne sont pas recopiées : elles sont extraites du fichier
 * de migration qui les livre, puis exécutées sur une base Postgres réelle
 * (PGlite, en mémoire). Un changement de comportement dans la migration change
 * donc le résultat du test.
 *
 * Le schéma `auth` de la plateforme n'existe pas ici : il est remplacé par un
 * équivalent minimal, où l'identité de l'appelant se règle depuis le test.
 */
export type TestDb = PGlite;

const AUTH_STUB = `
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE auth.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_sign_in_at timestamptz
);

CREATE TABLE auth.sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL
);

-- Identité de l'appelant, pilotée par le test.
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $stub$
  SELECT NULLIF(current_setting('test.uid', true), '')::uuid
$stub$;

CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $stub$
  SELECT COALESCE(NULLIF(current_setting('test.jwt', true), '')::jsonb, '{}'::jsonb)
$stub$;

-- La plateforme expose les en-têtes de la requête sous ce réglage. Le test
-- doit pouvoir en poser un : c'est la seule façon de vérifier qu'une fonction
-- ne les lit plus.
`;

/** Schéma métier réduit aux colonnes que les règles de connexion touchent. */
const SCHEMA = `
CREATE TABLE profiles (
  user_id uuid PRIMARY KEY,
  email text,
  is_admin boolean NOT NULL DEFAULT false
);

-- Lue par is_staff_user() : staff = is_admin OU accès à un module, jamais une
-- simple ligne profiles.
CREATE TABLE user_module_access (
  user_id uuid NOT NULL
);

CREATE TABLE trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_name text,
  start_date date,
  end_date date,
  location text,
  format_formation text,
  program_file_url text,
  supports_url text,
  objectives text[],
  prerequisites text[],
  trainer_id uuid,
  supports_lms_course_id uuid
);

CREATE TABLE training_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id uuid,
  email text,
  first_name text,
  last_name text,
  needs_survey_status text,
  formula_id uuid,
  coaching_sessions_total integer,
  coaching_sessions_completed integer
);

CREATE TABLE lms_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid,
  learner_email text,
  completion_percentage integer DEFAULT 0
);

CREATE TABLE learner_magic_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  token text NOT NULL DEFAULT gen_random_uuid()::text,
  training_id uuid,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '7 days',
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_security_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  must_change_password boolean NOT NULL DEFAULT false,
  password_set boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE identity_resolution_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  ip_address text NOT NULL DEFAULT 'unknown',
  state text NOT NULL,
  resolved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  ip_address text NOT NULL DEFAULT 'unknown',
  success boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE questionnaire_besoins (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, training_id uuid, token text, etat text);
CREATE TABLE training_evaluations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, training_id uuid, token text, etat text);
CREATE TABLE training_survey_recipients (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);
CREATE TABLE learner_profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text);
CREATE TABLE lms_progress (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learner_email text, updated_at timestamptz DEFAULT now());
CREATE TABLE lms_quiz_attempts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learner_email text);
CREATE TABLE lms_submissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learner_email text);
CREATE TABLE lms_assignment_submissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learner_email text);
CREATE TABLE lms_badge_awards (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learner_email text);
CREATE TABLE lms_user_badges (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learner_email text);
CREATE TABLE lms_work_deposits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learner_email text);
CREATE TABLE lms_page_views (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learner_email text, lesson_id uuid, course_id uuid, viewed_at timestamptz DEFAULT now());
CREATE TABLE lms_lesson_comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learner_email text);
CREATE TABLE lms_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learner_email text);
CREATE TABLE learner_notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learner_email text);
CREATE TABLE group_matching_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learner_email text);
CREATE TABLE group_matching_registrations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), learner_email text);
CREATE TABLE lms_forum_posts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_email text);
CREATE TABLE lms_deposit_comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_email text);
CREATE TABLE lms_deposit_reactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_email text);
CREATE TABLE practice_posts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_email text);
CREATE TABLE practice_post_comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_email text);
CREATE TABLE practice_post_reactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_email text);
CREATE TABLE practice_poll_votes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_email text);

-- Tables lues par get_learner_portal_data, réduites à ce que la fonction touche.
CREATE TABLE app_settings (setting_key text PRIMARY KEY, setting_value text, description text);
CREATE TABLE trainers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, first_name text, last_name text, photo_url text, booking_url text, bio text);
CREATE TABLE lms_courses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, status text, access_type text, cover_image_url text);
CREATE TABLE training_documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), training_id uuid, file_url text, file_name text, document_type text, created_at timestamptz DEFAULT now());
CREATE TABLE participant_files (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), participant_id uuid, file_url text, file_name text, created_at timestamptz DEFAULT now());
CREATE TABLE formation_formulas (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, formation_config_id uuid, coaching_sessions_count integer);
CREATE TABLE formation_configs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), formation_name text, is_active boolean DEFAULT true, supertilt_link text);
CREATE TABLE training_live_meetings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), training_id uuid, title text, scheduled_at timestamptz, meeting_url text, meeting_type text, status text);
CREATE TABLE coaching_bookings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), participant_id uuid, status text);
`;

/**
 * Extrait une fonction de son fichier de migration, telle qu'elle sera livrée.
 * Les instructions de droits sont laissées de côté : les rôles de la
 * plateforme n'existent pas ici.
 */
export function readFunctionSql(migrationFile: string, functionName: string): string {
  const candidates = [
    path.join(MIGRATIONS_DIR, migrationFile),
    path.join(DEFERRED_DIR, migrationFile),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error(`Migration ${migrationFile} introuvable`);
  }
  const source = fs.readFileSync(found, "utf8");
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${functionName}\\s*\\(([\\s\\S]*?)AS (\\$[a-z_]*\\$)([\\s\\S]*?)\\2\\s*;`,
    "i",
  );
  const match = source.match(pattern);
  if (!match) {
    throw new Error(`Fonction ${functionName} introuvable dans ${migrationFile}`);
  }
  return match[0];
}

/** Base prête à l'emploi : schéma minimal, stub d'authentification. */
export async function createTestDb(): Promise<TestDb> {
  const db = await PGlite.create();
  await db.exec(AUTH_STUB);
  await db.exec(SCHEMA);
  return db;
}

/** Charge dans la base les fonctions nommées, depuis leurs migrations. */
export async function loadFunctions(
  db: TestDb,
  functions: { migration: string; name: string }[],
): Promise<void> {
  for (const fn of functions) {
    await db.exec(readFunctionSql(fn.migration, fn.name));
  }
}

/**
 * Règle l'identité de l'appelant pour les appels qui suivent.
 *
 * `declaredEmail` pose l'en-tête `x-learner-email` que le navigateur peut
 * envoyer. Il sert à vérifier qu'une fonction ne s'y fie plus : sans ce
 * réglage, un test sur l'en-tête ne prouverait rien.
 */
export async function actAs(
  db: TestDb,
  identity: { uid?: string | null; email?: string | null; declaredEmail?: string | null } | null,
): Promise<void> {
  const uid = identity?.uid ?? "";
  const jwt = identity?.email ? JSON.stringify({ email: identity.email }) : "";
  const headers = identity?.declaredEmail
    ? JSON.stringify({ "x-learner-email": identity.declaredEmail })
    : "";
  await db.query("SELECT set_config('test.uid', $1, false)", [uid]);
  await db.query("SELECT set_config('test.jwt', $1, false)", [jwt]);
  await db.query("SELECT set_config('request.headers', $1, false)", [headers]);
}

/** Crée un compte d'authentification et rend son identifiant. */
export async function createAuthUser(
  db: TestDb,
  email: string,
  options: { passwordSet?: boolean; lastSignInAt?: string | null } = {},
): Promise<string> {
  const res = await db.query<{ id: string }>(
    "INSERT INTO auth.users (email, last_sign_in_at) VALUES ($1, $2) RETURNING id",
    [email, options.lastSignInAt ?? null],
  );
  const id = res.rows[0].id;
  if (options.passwordSet !== undefined) {
    await db.query(
      "INSERT INTO user_security_metadata (user_id, password_set) VALUES ($1, $2)",
      [id, options.passwordSet],
    );
  }
  return id;
}
