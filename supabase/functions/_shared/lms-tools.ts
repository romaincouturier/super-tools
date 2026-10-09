import { getSupabaseClient } from "./supabase-client.ts";
import {
  getBlockCatalog,
  getCatalogEntry,
  getEditableCatalog,
  isEditableBlockType,
  sanitizeHtml,
  sanitizePlainText,
  sanitizeRestructureBlocks,
  sanitizeUpdatePatch,
  type CatalogEntry,
  type SanitizedBlock,
} from "./lms-block-catalog.ts";


const PAGE_LIMIT_DEFAULT = 25;
const PAGE_LIMIT_MAX = 100;

export interface ListCoursesInput {
  status?: "draft" | "published" | "archived";
  page?: number;
  limit?: number;
}

export interface CourseSummary {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  updated_at: string;
}

export interface ListLessonsInput {
  courseId: string;
  page?: number;
  limit?: number;
}

export interface LessonSummary {
  id: string;
  title: string;
  lesson_type: string;
  module_id: string;
  module_title: string;
  module_position: number;
  position: number;
  estimated_minutes: number | null;
  updated_at: string;
  block_count: number;
  fingerprint: string;
}

export interface LessonDetail {
  id: string;
  course_id: string | null;
  module_id: string;
  module_title: string | null;
  title: string;
  lesson_type: string;
  position: number;
  estimated_minutes: number | null;
  content_html: string | null;
  source_transcript_id: string | null;
  blocks: LessonBlock[];
  fingerprint: string;
}

export interface LessonBlock {
  id: string;
  type: string;
  kind: "content" | "layout" | "media" | "assessment" | "embed";
  parent_block_id: string | null;
  position: number;
  hidden: boolean;
  content: Record<string, unknown> | null;
  updated_at: string;
}

export interface VersionSummary {
  id: string;
  created_at: string;
  source: string;
  created_by: string | null;
  block_count: number;
}

function isValidUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function pageLimit(limit?: number): number {
  if (!limit) return PAGE_LIMIT_DEFAULT;
  return Math.min(Math.max(1, limit), PAGE_LIMIT_MAX);
}

/**
 * The fingerprint is computed by the database (public.lms_lesson_fingerprint), which is
 * also what apply_lesson_restructure compares against. Never recompute it here: any
 * client-side hash would differ from the SQL one and every restructure would be rejected.
 */
async function fetchFingerprint(lessonId: string): Promise<string> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("lms_lesson_fingerprint", { p_lesson_id: lessonId });
  if (error) throw new Error(`Failed to compute fingerprint: ${error.message}`);
  return (data as string) ?? "";
}

async function fetchFingerprints(lessonIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (lessonIds.length === 0) return map;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("lms_lesson_fingerprints", { p_lesson_ids: lessonIds });
  if (error) throw new Error(`Failed to compute fingerprints: ${error.message}`);
  for (const row of (data ?? []) as Array<{ lesson_id: string; fingerprint: string }>) {
    map.set(row.lesson_id, row.fingerprint ?? "");
  }
  return map;
}

async function requireStaffOrService() {
  const supabase = getSupabaseClient();
  const [{ data: isStaff }, { data: isService }] = await Promise.all([
    supabase.rpc("is_staff_user"),
    supabase.rpc("is_service_role"),
  ]);
  if (isStaff || isService) return;
  throw new Error("Permission denied: staff access required");
}

export async function listLmsCourses(input: ListCoursesInput = {}): Promise<{ courses: CourseSummary[]; count: number }> {
  await requireStaffOrService();
  const supabase = getSupabaseClient();
  const limit = pageLimit(input.limit);
  const offset = ((input.page ?? 1) - 1) * limit;

  let query = supabase
    .from("lms_courses")
    .select("id, title, description, status, updated_at", { count: "exact" })
    .order("updated_at", { ascending: false });
  if (input.status) query = query.eq("status", input.status);

  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(`Failed to list courses: ${error.message}`);

  const courses: CourseSummary[] = (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description,
    status: c.status,
    updated_at: c.updated_at,
  }));

  return { courses, count: count ?? 0 };
}

export async function listLmsLessons(input: ListLessonsInput): Promise<{ lessons: LessonSummary[]; count: number }> {
  const courseId = input.courseId;
  if (!isValidUuid(courseId)) throw new Error("Invalid course_id");
  await requireStaffOrService();

  const supabase = getSupabaseClient();
  const limit = pageLimit(input.limit);
  const offset = ((input.page ?? 1) - 1) * limit;

  // lms_lessons has no course_id: the course is reached through lms_modules.
  const { data: lessons, error: lessonsError, count } = await supabase
    .from("lms_lessons")
    .select(
      "id, title, lesson_type, position, estimated_minutes, updated_at, module_id, lms_modules!inner(id, title, position, course_id)",
      { count: "exact" },
    )
    .eq("lms_modules.course_id", courseId)
    .order("position", { ascending: true })
    .order("id", { ascending: true })
    .range(offset, offset + limit - 1);

  if (lessonsError) throw new Error(`Failed to list lessons: ${lessonsError.message}`);

  const rows = (lessons ?? []) as unknown as Array<Record<string, any>>;
  const lessonIds = rows.map((l) => l.id as string);
  const { data: counts } = lessonIds.length
    ? await supabase
        .from("lms_lesson_blocks")
        .select("lesson_id, id, updated_at, position, parent_block_id")
        .in("lesson_id", lessonIds)
    : { data: [] as any[] };

  const blocksByLesson = new Map<string, { id: string; updated_at: string; position: number }[]>();
  for (const b of (counts ?? []) as any[]) {
    if (b.parent_block_id !== null) continue;
    if (!blocksByLesson.has(b.lesson_id)) blocksByLesson.set(b.lesson_id, []);
    blocksByLesson.get(b.lesson_id)!.push({ id: b.id, updated_at: b.updated_at, position: b.position });
  }

  const fingerprints = await fetchFingerprints(lessonIds);

  const summaries: LessonSummary[] = rows
    .map((l) => {
      const top = blocksByLesson.get(l.id as string) ?? [];
      return {
        id: l.id as string,
        title: l.title as string,
        lesson_type: l.lesson_type as string,
        module_id: l.module_id as string,
        module_title: (l.lms_modules?.title as string) ?? "",
        module_position: (l.lms_modules?.position as number) ?? 0,
        position: (l.position as number) ?? 0,
        estimated_minutes: (l.estimated_minutes as number | null) ?? null,
        updated_at: l.updated_at as string,
        block_count: top.length,
        fingerprint: fingerprints.get(l.id as string) ?? "",
      };
    })
    .sort((a, b) => a.module_position - b.module_position || a.position - b.position);

  return { lessons: summaries, count: count ?? 0 };
}

export async function readLmsLesson(lessonId: string): Promise<LessonDetail> {
  if (!isValidUuid(lessonId)) throw new Error("Invalid lesson_id");
  await requireStaffOrService();

  const supabase = getSupabaseClient();
  // The course is reached through lms_modules — lms_lessons has no course_id column.
  const [{ data: lessonRow, error: lessonError }, { data: blocks, error: blocksError }] = await Promise.all([
    supabase
      .from("lms_lessons")
      .select(
        "id, title, lesson_type, position, estimated_minutes, content_html, source_transcript_id, updated_at, module_id, lms_modules(id, title, course_id)",
      )
      .eq("id", lessonId)
      .single(),
    supabase.from("lms_lesson_blocks").select("id, type, kind, parent_block_id, position, hidden, content, updated_at").eq("lesson_id", lessonId).order("position", { ascending: true }).order("id", { ascending: true }),
  ]);

  if (lessonError) throw new Error(`Failed to read lesson: ${lessonError.message}`);
  if (blocksError) throw new Error(`Failed to read blocks: ${blocksError.message}`);

  const lesson = lessonRow as unknown as Record<string, any>;
  const fingerprint = await fetchFingerprint(lessonId);

  return {
    id: lesson.id,
    course_id: lesson.lms_modules?.course_id ?? null,
    module_id: lesson.module_id,
    module_title: lesson.lms_modules?.title ?? null,
    title: lesson.title,
    lesson_type: lesson.lesson_type,
    position: lesson.position,
    estimated_minutes: lesson.estimated_minutes ?? null,
    content_html: lesson.content_html ?? null,
    source_transcript_id: lesson.source_transcript_id,
    blocks: (blocks ?? []).map((b) => ({
      id: b.id,
      type: b.type,
      kind: b.kind as LessonBlock["kind"],
      parent_block_id: b.parent_block_id,
      position: b.position,
      hidden: b.hidden,
      content: b.content as Record<string, unknown> | null,
      updated_at: b.updated_at,
    })),
    fingerprint,
  };
}

export interface UpdateBlockInput {
  blockId: string;
  type: string;
  patch: Record<string, unknown>;
}

export async function updateLmsBlock(input: UpdateBlockInput): Promise<LessonBlock> {
  const { blockId, type, patch } = input;
  if (!isValidUuid(blockId)) throw new Error("Invalid block_id");
  if (!isEditableBlockType(type)) throw new Error(`Block type "${type}" is not editable via MCP`);
  await requireStaffOrService();

  const entry = getCatalogEntry(type);
  if (!entry) throw new Error(`Unknown block type "${type}"`);

  // Only allow fields defined in the catalog for this type.
  const sanitizedPatch = sanitizeUpdatePatch(type, patch);
  if (Object.keys(sanitizedPatch).length === 0) {
    throw new Error(`No editable field provided for block type "${type}"`);
  }


  const supabase = getSupabaseClient();
  const { data: existing } = await supabase
    .from("lms_lesson_blocks")
    .select("id, type, content")
    .eq("id", blockId)
    .maybeSingle();
  if (!existing) throw new Error(`Block ${blockId} not found`);
  // Type changes are NOT supported here: writing another type's content shape under the
  // existing type would silently corrupt the block. Use apply_lesson_restructure instead.
  if (existing.type !== type) {
    throw new Error(
      `Block ${blockId} has type "${existing.type}", not "${type}". update_lms_block cannot change a block type; use apply_lesson_restructure (with a fingerprint and explicit human validation) to convert a block to another type.`,
    );
  }

  // Merge into the existing content so untouched fields (styles, medias) survive.
  const currentContent = (existing.content ?? {}) as Record<string, unknown>;
  const sanitizedContent = { ...currentContent, ...sanitizedPatch };

  const { data, error } = await supabase
    .from("lms_lesson_blocks")
    .update({ content: sanitizedContent, updated_at: new Date().toISOString() })
    .eq("id", blockId)
    .select("id, type, kind, parent_block_id, position, hidden, content, updated_at")
    .single();


  if (error || !data) throw new Error(error?.message ?? "Failed to update block");

  return {
    id: data.id,
    type: data.type,
    kind: data.kind as LessonBlock["kind"],
    parent_block_id: data.parent_block_id,
    position: data.position,
    hidden: data.hidden,
    content: data.content as Record<string, unknown> | null,
    updated_at: data.updated_at,
  };
}

export interface ApplyRestructureInput {
  lessonId: string;
  fingerprint: string;
  blocks: unknown[];
  source?: string;
}

export async function applyLessonRestructure(input: ApplyRestructureInput): Promise<{ fingerprint: string; block_count: number }> {
  const { lessonId, fingerprint, blocks, source = "mcp" } = input;
  if (!isValidUuid(lessonId)) throw new Error("Invalid lesson_id");
  if (!Array.isArray(blocks)) throw new Error("blocks must be an array");
  await requireStaffOrService();

  // Sanitize and validate all blocks (including layout children) before sending to DB.
  const sanitized = sanitizeRestructureBlocks(blocks);
  const toJsonb = (b: SanitizedBlock): Record<string, unknown> => ({
    type: b.type,
    kind: b.kind,
    content: b.content,
    hidden: b.hidden ?? false,
    ...(b.children ? { children: b.children.map(toJsonb) } : {}),
  });
  const asJsonb = sanitized.map(toJsonb);


  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("apply_lesson_restructure", {
    p_lesson_id: lessonId,
    p_fingerprint: fingerprint,
    p_blocks: asJsonb,
    p_source: source,
  });

  if (error) throw new Error(`Failed to apply restructure: ${error.message}`);

  const detail = await readLmsLesson(lessonId);
  return { fingerprint: detail.fingerprint, block_count: detail.blocks.filter((b) => b.parent_block_id === null).length };
}

export async function listLessonVersions(lessonId: string, page = 1, limit?: number): Promise<{ versions: VersionSummary[]; count: number }> {
  if (!isValidUuid(lessonId)) throw new Error("Invalid lesson_id");
  await requireStaffOrService();

  const supabase = getSupabaseClient();
  const l = pageLimit(limit);
  const offset = (Math.max(1, page) - 1) * l;

  const { data, error, count } = await supabase
    .from("lms_lesson_snapshots")
    .select("id, created_at, source, created_by, blocks", { count: "exact" })
    .eq("lesson_id", lessonId)
    .order("created_at", { ascending: false })
    .range(offset, offset + l - 1);

  if (error) throw new Error(`Failed to list versions: ${error.message}`);

  const versions: VersionSummary[] = (data ?? []).map((row) => ({
    id: row.id,
    created_at: row.created_at,
    source: row.source,
    created_by: row.created_by,
    block_count: Array.isArray(row.blocks) ? row.blocks.length : 0,
  }));

  return { versions, count: count ?? 0 };
}

export async function restoreLessonVersion(snapshotId: string): Promise<{ lesson_id: string; fingerprint: string }> {
  if (!isValidUuid(snapshotId)) throw new Error("Invalid snapshot_id");
  await requireStaffOrService();

  const supabase = getSupabaseClient();

  // Find the lesson_id first for the response.
  const { data: snap } = await supabase.from("lms_lesson_snapshots").select("lesson_id").eq("id", snapshotId).single();
  if (!snap) throw new Error("Snapshot not found");

  const { error } = await supabase.rpc("restore_lesson_version", { p_snapshot_id: snapshotId });
  if (error) throw new Error(`Failed to restore version: ${error.message}`);

  const detail = await readLmsLesson(snap.lesson_id);
  return { lesson_id: snap.lesson_id, fingerprint: detail.fingerprint };
}

export interface CatalogOutput {
  editableTypes: Pick<CatalogEntry, "type" | "kind" | "blockKind" | "labelFr" | "acceptsChildren" | "fields" | "guidance">[];
  nonEditableTypes: Pick<CatalogEntry, "type" | "kind" | "labelFr" | "guidance">[];
}

export function getLmsBlockCatalog(): CatalogOutput {
  const all = getBlockCatalog();
  const editable = getEditableCatalog().map(({ type, kind, blockKind, labelFr, acceptsChildren, fields, guidance }) => ({
    type,
    kind,
    blockKind,
    labelFr,
    ...(acceptsChildren ? { acceptsChildren } : {}),
    fields,
    guidance,
  }));
  const nonEditable = all
    .filter((e) => !e.editableViaMcp)
    .map(({ type, kind, labelFr, guidance }) => ({ type, kind, labelFr, guidance }));
  return { editableTypes: editable, nonEditableTypes: nonEditable };
}


const CREATABLE_LESSON_TYPES = new Set(["text", "content", "image", "file"]);

export interface CreateLessonInput {
  moduleId: string;
  title: string;
  lessonType?: string;
  position?: number;
  estimatedMinutes?: number | null;
  blocks?: unknown[];
}

export async function createLmsLesson(input: CreateLessonInput): Promise<{ lesson: LessonDetail }> {
  const { moduleId, title, lessonType = "text", position, estimatedMinutes, blocks } = input;
  if (!isValidUuid(moduleId)) throw new Error("Invalid module_id");
  const cleanTitle = sanitizePlainText(String(title ?? "")).trim();
  if (!cleanTitle) throw new Error("title is required");
  if (!CREATABLE_LESSON_TYPES.has(lessonType)) {
    throw new Error(`lesson_type "${lessonType}" is not allowed. Use one of: ${[...CREATABLE_LESSON_TYPES].join(", ")}`);
  }
  if (blocks !== undefined && !Array.isArray(blocks)) throw new Error("blocks must be an array");
  await requireStaffOrService();

  const supabase = getSupabaseClient();
  const { data: mod } = await supabase.from("lms_modules").select("id").eq("id", moduleId).maybeSingle();
  if (!mod) throw new Error(`Module ${moduleId} not found`);

  // Validate blocks BEFORE inserting the lesson, so a bad payload never leaves an empty lesson behind.
  const sanitizedBlocks = blocks && blocks.length > 0 ? sanitizeRestructureBlocks(blocks) : [];

  const { data: siblings } = await supabase
    .from("lms_lessons")
    .select("id, position")
    .eq("module_id", moduleId)
    .order("position", { ascending: true });

  const existing = (siblings ?? []) as { id: string; position: number }[];
  const maxPosition = existing.length > 0 ? existing[existing.length - 1].position : -1;
  const finalPosition = position === undefined || position === null ? maxPosition + 1 : Math.max(0, Math.trunc(position));

  // Insert at an explicit position: shift the following lessons to keep positions unique and ordered.
  if (position !== undefined && position !== null) {
    const toShift = existing.filter((l) => l.position >= finalPosition).sort((a, b) => b.position - a.position);
    for (const l of toShift) {
      const { error: shiftError } = await supabase
        .from("lms_lessons")
        .update({ position: l.position + 1 })
        .eq("id", l.id);
      if (shiftError) throw new Error(`Failed to shift lesson positions: ${shiftError.message}`);
    }
  }

  const { data, error } = await supabase
    .from("lms_lessons")
    .insert({
      module_id: moduleId,
      title: cleanTitle,
      lesson_type: lessonType,
      position: finalPosition,
      estimated_minutes: estimatedMinutes ?? null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(`Failed to create lesson: ${error?.message ?? "unknown error"}`);

  if (sanitizedBlocks.length > 0) {
    const fingerprint = await fetchFingerprint(data.id);
    await applyLessonRestructure({
      lessonId: data.id,
      fingerprint,
      blocks: sanitizedBlocks,
      source: "mcp:create_lms_lesson",
    });
  }

  return { lesson: await readLmsLesson(data.id) };
}

// ---------------------------------------------------------------------------
// Quiz / assignment creation and lesson metadata (MCP)
// ---------------------------------------------------------------------------

export interface QuizQuestionInput {
  question: string;
  type: "single_choice" | "multiple_choice";
  options: { text: string; is_correct: boolean; feedback?: string }[];
  explanation?: string;
  points?: number;
}

export interface CreateQuizInput {
  courseId: string;
  title: string;
  description?: string;
  passingScore?: number;
  maxAttempts?: number;
  timeLimitMinutes?: number;
  shuffleQuestions?: boolean;
  showCorrectAnswers?: boolean;
  questions: unknown[];
}

function optionalInt(value: unknown, name: string, min: number, max: number): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer between ${min} and ${max}`);
  return n;
}

/** Pure validation, exported for tests. Throws on the first invalid question. */
export function validateQuizQuestions(questions: unknown): Array<{
  question_text: string; question_type: string; multi_select: boolean;
  options: { label: string; is_correct: boolean; feedback?: string }[];
  explanation: string | null; points: number; position: number;
}> {
  if (!Array.isArray(questions) || questions.length === 0) throw new Error("questions must be a non-empty array");
  if (questions.length > 50) throw new Error("questions: at most 50 questions");
  return questions.map((raw, i) => {
    const q = (raw ?? {}) as Record<string, unknown>;
    const label = `questions[${i}]`;
    const text = sanitizePlainText(String(q.question ?? "")).trim();
    if (!text) throw new Error(`${label}.question is required`);
    if (q.type !== "single_choice" && q.type !== "multiple_choice") {
      throw new Error(`${label}.type must be "single_choice" or "multiple_choice"`);
    }
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 10) {
      throw new Error(`${label}.options must contain 2 to 10 options`);
    }
    const options = q.options.map((o, j) => {
      const opt = (o ?? {}) as Record<string, unknown>;
      const optText = sanitizePlainText(String(opt.text ?? "")).trim();
      if (!optText) throw new Error(`${label}.options[${j}].text is required`);
      if (typeof opt.is_correct !== "boolean") throw new Error(`${label}.options[${j}].is_correct must be a boolean`);
      const feedback = opt.feedback ? sanitizePlainText(String(opt.feedback)).trim() : "";
      return { label: optText, is_correct: opt.is_correct, ...(feedback ? { feedback } : {}) };
    });
    const correct = options.filter((o) => o.is_correct).length;
    if (q.type === "single_choice" && correct !== 1) throw new Error(`${label}: single_choice needs exactly one correct option (got ${correct})`);
    if (q.type === "multiple_choice" && correct < 1) throw new Error(`${label}: multiple_choice needs at least one correct option`);
    const explanation = q.explanation ? sanitizePlainText(String(q.explanation)).trim() : "";
    return {
      question_text: text,
      question_type: "mcq",
      multi_select: q.type === "multiple_choice",
      options,
      explanation: explanation || null,
      points: optionalInt(q.points, `${label}.points`, 0, 100) ?? 1,
      position: i,
    };
  });
}

async function requireCourse(courseId: string) {
  if (!isValidUuid(courseId)) throw new Error("Invalid course_id");
  const { data } = await getSupabaseClient().from("lms_courses").select("id").eq("id", courseId).maybeSingle();
  if (!data) throw new Error(`Course ${courseId} not found`);
}

export async function createLmsQuiz(input: CreateQuizInput) {
  const title = sanitizePlainText(String(input.title ?? "")).trim();
  if (!title) throw new Error("title is required");
  const questions = validateQuizQuestions(input.questions);
  const settings = {
    passing_score: optionalInt(input.passingScore, "passing_score", 0, 100),
    max_attempts: optionalInt(input.maxAttempts, "max_attempts", 1, 100),
    time_limit_minutes: optionalInt(input.timeLimitMinutes, "time_limit_minutes", 1, 600),
  };
  await requireStaffOrService();
  await requireCourse(input.courseId);

  const supabase = getSupabaseClient();
  const description = input.description ? sanitizePlainText(String(input.description)).trim() : null;
  const { data: quiz, error } = await supabase
    .from("lms_quizzes")
    .insert({
      course_id: input.courseId,
      title,
      description: description || null,
      ...Object.fromEntries(Object.entries(settings).filter(([, v]) => v !== undefined)),
      ...(typeof input.shuffleQuestions === "boolean" ? { shuffle_questions: input.shuffleQuestions } : {}),
      ...(typeof input.showCorrectAnswers === "boolean" ? { show_correct_answers: input.showCorrectAnswers } : {}),
    })
    .select("id")
    .single();
  if (error || !quiz) throw new Error(`Failed to create quiz: ${error?.message ?? "unknown error"}`);

  const { error: qError } = await supabase
    .from("lms_quiz_questions")
    .insert(questions.map((q) => ({ ...q, quiz_id: quiz.id })));
  if (qError) {
    // All-or-nothing: never leave a quiz without its questions.
    await supabase.from("lms_quizzes").delete().eq("id", quiz.id);
    throw new Error(`Failed to create quiz questions: ${qError.message}`);
  }

  return {
    quiz_id: quiz.id as string,
    question_count: questions.length,
    block: { type: "quiz", content: { quiz_id: quiz.id } },
  };
}

export async function readLmsQuiz(quizId: string) {
  if (!isValidUuid(quizId)) throw new Error("Invalid quiz_id");
  await requireStaffOrService();
  const supabase = getSupabaseClient();
  const { data: quiz } = await supabase
    .from("lms_quizzes")
    .select("id, course_id, title, description, passing_score, max_attempts, time_limit_minutes, shuffle_questions, show_correct_answers")
    .eq("id", quizId)
    .maybeSingle();
  if (!quiz) throw new Error(`Quiz ${quizId} not found`);
  const { data: questions, error } = await supabase
    .from("lms_quiz_questions")
    .select("id, position, question_text, question_type, multi_select, options, explanation, points")
    .eq("quiz_id", quizId)
    .order("position", { ascending: true });
  if (error) throw new Error(`Failed to read questions: ${error.message}`);
  return { quiz, questions: questions ?? [] };
}

export interface CreateAssignmentInput {
  courseId: string;
  title: string;
  instructionsHtml?: string;
  maxScore?: number;
  dueAfterDays?: number;
  allowLateSubmission?: boolean;
  allowedFileTypes?: unknown;
  maxFileSizeMb?: number;
}

export async function createLmsAssignment(input: CreateAssignmentInput) {
  const title = sanitizePlainText(String(input.title ?? "")).trim();
  if (!title) throw new Error("title is required");
  const row: Record<string, unknown> = { course_id: input.courseId, title };
  if (input.instructionsHtml) row.instructions_html = sanitizeHtml(String(input.instructionsHtml));
  const maxScore = optionalInt(input.maxScore, "max_score", 1, 1000);
  if (maxScore !== undefined) row.max_score = maxScore;
  const due = optionalInt(input.dueAfterDays, "due_after_days", 0, 365);
  if (due !== undefined) row.due_after_days = due;
  const size = optionalInt(input.maxFileSizeMb, "max_file_size_mb", 1, 500);
  if (size !== undefined) row.max_file_size_mb = size;
  if (typeof input.allowLateSubmission === "boolean") row.allow_late_submission = input.allowLateSubmission;
  if (input.allowedFileTypes !== undefined) {
    if (!Array.isArray(input.allowedFileTypes) || !input.allowedFileTypes.every((t) => typeof t === "string" && /^[.a-z0-9/*+-]{1,50}$/i.test(t))) {
      throw new Error("allowed_file_types must be an array of extensions or MIME types (e.g. [\".pdf\", \"image/*\"])");
    }
    row.allowed_file_types = input.allowedFileTypes;
  }
  await requireStaffOrService();
  await requireCourse(input.courseId);

  const { data, error } = await getSupabaseClient().from("lms_assignments").insert(row).select("id").single();
  if (error || !data) throw new Error(`Failed to create assignment: ${error?.message ?? "unknown error"}`);
  return { assignment_id: data.id as string, block: { type: "assignment", content: { assignment_id: data.id } } };
}

export const LESSON_PATCH_FIELDS = ["title", "estimated_minutes", "position", "is_mandatory"] as const;

/** Pure validation, exported for tests. */
export function validateLessonPatch(patch: unknown): {
  title?: string; estimated_minutes?: number | null; position?: number; is_mandatory?: boolean;
} {
  if (!patch || typeof patch !== "object" || Array.isArray(patch)) throw new Error("patch must be an object");
  const p = patch as Record<string, unknown>;
  const unknown = Object.keys(p).filter((k) => !(LESSON_PATCH_FIELDS as readonly string[]).includes(k));
  if (unknown.length) throw new Error(`Fields not allowed: ${unknown.join(", ")}. Allowed: ${LESSON_PATCH_FIELDS.join(", ")}`);
  if (Object.keys(p).length === 0) throw new Error("patch is empty");
  const out: ReturnType<typeof validateLessonPatch> = {};
  if ("title" in p) {
    const t = sanitizePlainText(String(p.title ?? "")).trim();
    if (!t) throw new Error("title cannot be empty");
    out.title = t;
  }
  if ("estimated_minutes" in p) {
    out.estimated_minutes = p.estimated_minutes === null ? null : optionalInt(p.estimated_minutes, "estimated_minutes", 0, 600)!;
  }
  if ("position" in p) out.position = optionalInt(p.position, "position", 0, 10000)!;
  if ("is_mandatory" in p) {
    if (typeof p.is_mandatory !== "boolean") throw new Error("is_mandatory must be a boolean");
    out.is_mandatory = p.is_mandatory;
  }
  return out;
}

export async function updateLmsLesson(lessonId: string, rawPatch: unknown) {
  if (!isValidUuid(lessonId)) throw new Error("Invalid lesson_id");
  const patch = validateLessonPatch(rawPatch);
  await requireStaffOrService();
  const supabase = getSupabaseClient();
  const { data: before } = await supabase
    .from("lms_lessons")
    .select("id, module_id, title, estimated_minutes, position, is_mandatory")
    .eq("id", lessonId)
    .maybeSingle();
  if (!before) throw new Error(`Lesson ${lessonId} not found`);

  const { position, ...fields } = patch;
  if (Object.keys(fields).length > 0) {
    const { error } = await supabase.from("lms_lessons").update(fields).eq("id", lessonId);
    if (error) throw new Error(`Failed to update lesson: ${error.message}`);
  }

  if (position !== undefined) {
    const { data: siblings, error } = await supabase
      .from("lms_lessons")
      .select("id, position")
      .eq("module_id", before.module_id)
      .order("position", { ascending: true });
    if (error) throw new Error(`Failed to read module lessons: ${error.message}`);
    const ordered = ((siblings ?? []) as { id: string; position: number }[]).filter((l) => l.id !== lessonId);
    const target = Math.min(position, ordered.length);
    ordered.splice(target, 0, { id: lessonId, position: -1 });
    for (let i = 0; i < ordered.length; i++) {
      const original = (siblings ?? []).find((s: { id: string }) => s.id === ordered[i].id) as { position: number } | undefined;
      if (original?.position === i) continue;
      const { error: posError } = await supabase.from("lms_lessons").update({ position: i }).eq("id", ordered[i].id);
      if (posError) throw new Error(`Failed to reorder lessons: ${posError.message}`);
    }
  }

  const { data: after } = await supabase
    .from("lms_lessons")
    .select("id, module_id, title, estimated_minutes, position, is_mandatory")
    .eq("id", lessonId)
    .single();
  const changes: Record<string, { before: unknown; after: unknown }> = {};
  for (const k of LESSON_PATCH_FIELDS) {
    const b = (before as Record<string, unknown>)[k];
    const a = (after as Record<string, unknown>)[k];
    if (b !== a) changes[k] = { before: b, after: a };
  }
  return { lesson: after, changes };
}
