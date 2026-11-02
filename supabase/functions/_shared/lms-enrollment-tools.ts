/**
 * Outils MCP enroll_lms_learner / unenroll_lms_learner : gestion directe des
 * inscriptions lms_enrollments. Sans confirm=true : aperçu seul, rien n'est écrit.
 * Chaque écriture est tracée dans activity_logs (lms_access_added / lms_access_removed).
 */

import { sendLearnerAccessEmail } from "./learner-account.ts";

// deno-lint-ignore no-explicit-any
type Db = any;
type Log = (message: string) => Promise<void>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PREVIEW_MSG = "Aperçu seulement, rien n'a été modifié. Relance avec confirm=true après validation explicite de l'utilisateur.";

async function loadCourse(db: Db, courseId: string) {
  if (!UUID_RE.test(courseId || "")) throw new Error("course_id invalide");
  const { data, error } = await db.from("lms_courses").select("id, title, status, access_type, formation_config_id").eq("id", courseId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Cours introuvable");
  return data;
}

export interface EnrollInput {
  course_id: string; email?: string; emails?: string[]; confirm?: boolean;
  formula?: string; training_id?: string; send_access_email?: boolean;
}

/**
 * La formule n'existe pas sur lms_enrollments : comme dans l'interface, elle est portée par
 * la participation à une session reliée au cours (training_participants.formula / formula_id).
 */
async function loadFormulaContext(db: Db, course: Db, emails: string[]) {
  const { data: formulas, error: fErr } = course.formation_config_id
    ? await db.from("formation_formulas").select("id, name, coaching_sessions_count").eq("formation_config_id", course.formation_config_id).order("display_order")
    : { data: [], error: null };
  if (fErr) throw new Error(fErr.message);
  const { data: sessions, error: sErr } = await db.from("trainings")
    .select("id, training_name, start_date, end_date, session_type").eq("supports_lms_course_id", course.id).eq("is_cancelled", false).order("start_date");
  if (sErr) throw new Error(sErr.message);
  const sessionIds = (sessions || []).map((t: Db) => t.id);
  const { data: parts, error: pErr } = sessionIds.length && emails.length
    ? await db.from("training_participants").select("id, email, training_id, formula, formula_id, coaching_sessions_total, coaching_sessions_completed, repositioned_to_training_id").in("training_id", sessionIds)
    : { data: [], error: null };
  if (pErr) throw new Error(pErr.message);
  const wanted = new Set(emails);
  const participations = (parts || []).filter((p: Db) => wanted.has(String(p.email).toLowerCase()) && !p.repositioned_to_training_id);
  return { formulas: (formulas || []) as Array<{ id: string; name: string; coaching_sessions_count: number | null }>, sessions: sessions || [], participations };
}

export async function enrollLmsLearner(db: Db, input: EnrollInput, log: Log, actorEmail: string): Promise<string> {
  const course = await loadCourse(db, input.course_id);
  const raw = [...(input.emails ?? []), ...(input.email ? [input.email] : [])].map((e) => String(e).trim().toLowerCase()).filter(Boolean);
  const emails = [...new Set(raw)];
  if (!emails.length) throw new Error("email ou emails requis");
  if (emails.length > 200) throw new Error("200 emails maximum par appel");
  const invalid = emails.filter((e) => !EMAIL_RE.test(e));
  const valid = emails.filter((e) => EMAIL_RE.test(e));
  if (input.training_id && !UUID_RE.test(input.training_id)) throw new Error("training_id invalide");

  const { data: existing, error } = await db.from("lms_enrollments").select("learner_email").eq("course_id", course.id);
  if (error) throw new Error(error.message);
  const known = new Set((existing || []).map((r: Db) => String(r.learner_email).toLowerCase()));
  const already = valid.filter((e) => known.has(e));
  const toEnroll = valid.filter((e) => !known.has(e));
  const courseInfo = { id: course.id, title: course.title, status: course.status, access_type: course.access_type };
  const warnings: string[] = course.status !== "published" ? [`Cours au statut « ${course.status} » : l'accès sera ouvert mais le cours n'est pas publié.`] : [];

  const ctx = await loadFormulaContext(db, course, valid);
  const sessionById = new Map(ctx.sessions.map((t: Db) => [t.id, t]));
  if (input.training_id && !sessionById.has(input.training_id)) throw new Error("training_id n'est pas une session active reliée à ce cours");

  let formula: (typeof ctx.formulas)[number] | null = null;
  const wanted = input.formula?.trim().toLowerCase();
  if (wanted) {
    formula = ctx.formulas.find((f) => f.id === input.formula!.trim() || f.name.toLowerCase() === wanted) ?? null;
    if (!formula) throw new Error(`Formule inconnue pour ce cours. Formules disponibles : ${ctx.formulas.map((f) => `${f.name} (${f.id})`).join(", ") || "aucune"}`);
  }

  // Plan formule par email : participation à mettre à jour, ou blocage.
  const formulaPlan = formula ? valid.map((email) => {
    let mine = ctx.participations.filter((p: Db) => String(p.email).toLowerCase() === email);
    if (input.training_id) mine = mine.filter((p: Db) => p.training_id === input.training_id);
    if (mine.length === 1) {
      const p = mine[0];
      return { email, participant_id: p.id, training_id: p.training_id, session: sessionById.get(p.training_id)?.training_name + " (" + (sessionById.get(p.training_id)?.start_date ?? "sans date") + ")",
        before: p.formula ?? null, after: formula!.name, coaching_sessions_total_before: p.coaching_sessions_total ?? 0,
        coaching_sessions_total_after: Math.max(formula!.coaching_sessions_count ?? 0, p.coaching_sessions_completed ?? 0), unchanged: p.formula_id === formula!.id };
    }
    if (mine.length > 1) return { email, blocked: "Participant de plusieurs sessions reliées : préciser training_id." };
    return { email, blocked: input.training_id
      ? "Pas encore participant de cette session : utiliser add_training_participant (training_id, formula_name) pour l'ajouter avec sa formule, comme dans l'interface."
      : "Pas participant d'une session reliée au cours : la formule est portée par la session. Choisir une session dans linked_sessions puis utiliser add_training_participant avec training_id et formula_name." };
  }) : [];

  const formulaInfo = {
    available_formulas: ctx.formulas.map((f) => ({ id: f.id, name: f.name, coaching_sessions: f.coaching_sessions_count ?? 0 })),
    linked_sessions: ctx.sessions.map((t: Db) => ({ id: t.id, name: t.training_name, start_date: t.start_date, end_date: t.end_date, session_type: t.session_type })),
    current_formulas: ctx.participations.map((p: Db) => ({ email: String(p.email).toLowerCase(), training_id: p.training_id, formula: p.formula ?? null })),
  };
  const sendEmail = input.send_access_email === true;

  if (input.confirm !== true) {
    return JSON.stringify({ preview: true, message: PREVIEW_MSG, course: courseInfo, to_enroll: toEnroll, already_enrolled: already, invalid_emails: invalid, warnings,
      ...formulaInfo, ...(formula ? { formula_changes: formulaPlan } : {}),
      access_email: sendEmail ? `Email « Accéder à votre espace SuperTools » envoyé à : ${valid.join(", ")}` : "Aucun email envoyé (send_access_email=true pour envoyer l'email d'accès à l'espace apprenant)." });
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
  const formulaResults: Db[] = [];
  for (const step of formulaPlan as Db[]) {
    if (step.blocked || step.unchanged) { formulaResults.push(step); continue; }
    const { error: uErr } = await db.from("training_participants")
      .update({ formula: formula!.name, formula_id: formula!.id, coaching_sessions_total: step.coaching_sessions_total_after }).eq("id", step.participant_id);
    if (uErr) { formulaResults.push({ ...step, error: uErr.message }); continue; }
    await db.from("activity_logs").insert({
      action_type: "participant_formula_changed", recipient_email: step.email,
      details: { course_id: course.id, course_title: course.title, training_id: step.training_id, participant_id: step.participant_id,
        formula_before: step.before, formula_after: formula!.name, formula_id: formula!.id, via: "mcp", actor: actorEmail },
    });
    formulaResults.push({ ...step, updated: true });
  }
  const emailResults: Db[] = [];
  if (sendEmail) {
    for (const e of valid) {
      try {
        const { sent } = await sendLearnerAccessEmail(db, e, { trainingName: course.title });
        if (sent) await db.from("activity_logs").insert({ action_type: "learner_access_email_sent", recipient_email: e,
          details: { course_id: course.id, course_title: course.title, via: "mcp", actor: actorEmail } });
        emailResults.push({ email: e, sent });
      } catch (err) { emailResults.push({ email: e, sent: false, error: err instanceof Error ? err.message : "échec" }); }
    }
  }
  await log(`enroll_lms_learner: ${toEnroll.length} -> ${course.title}${formula ? ` formule ${formula.name}` : ""}${sendEmail ? " +email" : ""}`);
  return JSON.stringify({ enrolled: toEnroll, already_enrolled: already, invalid_emails: invalid, course: courseInfo,
    ...(formula ? { formula_changes: formulaResults } : {}), ...(sendEmail ? { access_emails: emailResults } : {}) });
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
