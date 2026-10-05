/**
 * Outils MCP enroll_lms_learner / unenroll_lms_learner : gestion directe des
 * inscriptions lms_enrollments. Sans confirm=true : aperçu seul, rien n'est écrit.
 * Chaque écriture est tracée dans activity_logs (lms_access_added / lms_access_removed).
 */

// deno-lint-ignore no-explicit-any
type Db = any;
type Log = (message: string) => Promise<void>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PREVIEW_MSG = "Aperçu seulement, rien n'a été modifié. Relance avec confirm=true après validation explicite de l'utilisateur.";

async function loadCourse(db: Db, courseId: string) {
  if (!UUID_RE.test(courseId || "")) throw new Error("course_id invalide");
  const { data, error } = await db.from("lms_courses").select("id, title, status, access_type").eq("id", courseId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Cours introuvable");
  return data;
}

export interface EnrollInput { course_id: string; email?: string; emails?: string[]; confirm?: boolean }

export async function enrollLmsLearner(db: Db, input: EnrollInput, log: Log, actorEmail: string): Promise<string> {
  const course = await loadCourse(db, input.course_id);
  const raw = [...(input.emails ?? []), ...(input.email ? [input.email] : [])].map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  const emails = [...new Set(raw)];
  if (!emails.length) throw new Error("email ou emails requis");
  if (emails.length > 200) throw new Error("200 emails maximum par appel");
  const invalid = emails.filter((e) => !EMAIL_RE.test(e));
  const valid = emails.filter((e) => EMAIL_RE.test(e));

  const { data: existing, error } = await db.from("lms_enrollments").select("learner_email").eq("course_id", course.id);
  if (error) throw new Error(error.message);
  const known = new Set((existing || []).map((r: Db) => String(r.learner_email).toLowerCase()));
  const already = valid.filter((e) => known.has(e));
  const toEnroll = valid.filter((e) => !known.has(e));
  const courseInfo = { id: course.id, title: course.title, status: course.status, access_type: course.access_type };
  const warnings = course.status !== "published" ? [`Cours au statut « ${course.status} » : l'accès sera ouvert mais le cours n'est pas publié.`] : [];

  if (input.confirm !== true) {
    return JSON.stringify({ preview: true, message: PREVIEW_MSG, course: courseInfo, to_enroll: toEnroll, already_enrolled: already, invalid_emails: invalid, warnings,
      note: "Aucun email n'est envoyé : l'inscription ouvre seulement l'accès au cours dans l'espace apprenant." });
  }
  if (toEnroll.length) {
    const { error: iErr } = await db.from("lms_enrollments")
      .upsert(toEnroll.map((e) => ({ course_id: course.id, learner_email: e })), { onConflict: "course_id,learner_email", ignoreDuplicates: true });
    if (iErr) throw new Error(iErr.message);
    await db.from("activity_logs").insert(toEnroll.map((e) => ({
      action_type: "lms_access_added", recipient_email: e,
      details: { course_id: course.id, course_title: course.title, via: "mcp", actor: actorEmail },
    })));
  }
  await log(`enroll_lms_learner: ${toEnroll.length} -> ${course.title}`);
  return JSON.stringify({ enrolled: toEnroll, already_enrolled: already, invalid_emails: invalid, course: courseInfo });
}

export interface UnenrollInput { course_id: string; email?: string; enrollment_id?: string; reason?: string; confirm?: boolean }

export async function unenrollLmsLearner(db: Db, input: UnenrollInput, log: Log, actorEmail: string): Promise<string> {
  const course = await loadCourse(db, input.course_id);
  let q = db.from("lms_enrollments").select("id, learner_email, enrolled_at, completion_percentage, completed_at, status").eq("course_id", course.id);
  if (input.enrollment_id) {
    if (!UUID_RE.test(input.enrollment_id)) throw new Error("enrollment_id invalide");
    q = q.eq("id", input.enrollment_id);
  } else if (input.email?.trim()) {
    q = q.ilike("learner_email", input.email.trim());
  } else throw new Error("email ou enrollment_id requis");
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);
  if (!rows?.length) throw new Error("Aucune inscription trouvée sur ce cours");
  const en = rows[0];
  const email = String(en.learner_email).toLowerCase();

  const count = async (table: string, build: (x: Db) => Db) => {
    const { count: c, error: e } = await build(db.from(table).select("id", { count: "exact", head: true }));
    if (e) throw new Error(`${table}: ${e.message}`);
    return c ?? 0;
  };
  const { data: quizzes } = await db.from("lms_quizzes").select("id").eq("course_id", course.id);
  const quizIds = (quizzes || []).map((z: Db) => z.id);
  const progress = await count("lms_progress", (x) => x.eq("course_id", course.id).ilike("learner_email", email));
  const quizAttempts = quizIds.length ? await count("lms_quiz_attempts", (x) => x.in("quiz_id", quizIds).ilike("learner_email", email)) : 0;
  const deposits = await count("lms_work_deposits", (x) => x.eq("course_id", course.id).ilike("learner_email", email));

  const { data: sessions } = await db.from("training_participants")
    .select("training_id, repositioned_to_training_id, trainings!inner(training_name, start_date, supports_lms_course_id)")
    .ilike("email", email).eq("trainings.supports_lms_course_id", course.id);
  const linked = (sessions || []).filter((s: Db) => !s.repositioned_to_training_id)
    .map((s: Db) => `${s.trainings.training_name} (${s.trainings.start_date ?? "sans date"})`);
  const warnings = [
    ...(linked.length ? [`Encore participant de session(s) reliée(s) à ce cours : ${linked.join(", ")}. L'accès sera quand même retiré et ne sera pas recréé automatiquement.`] : []),
    ...(course.access_type === "gratuit" ? ["Cours en accès libre : l'apprenant pourra se réinscrire lui-même depuis l'Academy."] : []),
  ];
  const data_kept = {
    progress_rows: progress, quiz_attempts: quizAttempts, work_deposits: deposits,
    note: "Rien n'est supprimé : progression, tentatives de quiz et dépôts restent en base mais ne sont plus accessibles à l'apprenant. Ils réapparaissent s'il est réinscrit.",
  };
  const enrollment = { id: en.id, email, enrolled_at: en.enrolled_at, completion_percentage: en.completion_percentage, completed_at: en.completed_at };

  if (input.confirm !== true) {
    return JSON.stringify({ preview: true, message: PREVIEW_MSG, course: { id: course.id, title: course.title }, enrollment, data_kept, warnings });
  }
  const { error: dErr } = await db.from("lms_enrollments").delete().eq("id", en.id);
  if (dErr) throw new Error(dErr.message);
  const reason = input.reason?.trim() || null;
  await db.from("activity_logs").insert({
    action_type: "lms_access_removed", recipient_email: email,
    details: { course_id: course.id, course_title: course.title, reason, via: "mcp", actor: actorEmail, completion_percentage: en.completion_percentage },
  });
  await log(`unenroll_lms_learner: ${email} <- ${course.title}`);
  return JSON.stringify({ unenrolled: true, course: { id: course.id, title: course.title }, email, reason, data_kept });
}
