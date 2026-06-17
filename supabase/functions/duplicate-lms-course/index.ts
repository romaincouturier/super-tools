import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";

serve(async (req) => {
  const corsRes = handleCorsPreflightIfNeeded(req);
  if (corsRes) return corsRes;

  const authedUser = await verifyAuth(req.headers.get("Authorization"));
  if (!authedUser) {
    return new Response(JSON.stringify({ error: "Non autorisé" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { courseId, mode } = await req.json() as { courseId: string; mode: "structure" | "full" };
    if (!courseId || !["structure", "full"].includes(mode)) {
      return new Response(JSON.stringify({ error: "Paramètres invalides" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Copy course
    const { data: src, error: srcErr } = await admin
      .from("lms_courses")
      .select("*")
      .eq("id", courseId)
      .single();
    if (srcErr || !src) throw new Error("Cours introuvable");

    const { id: _id, created_at, updated_at, ...courseFields } = src;
    const { data: newCourse, error: courseErr } = await admin
      .from("lms_courses")
      .insert({ ...courseFields, title: `Copie de ${src.title}`, status: "draft" })
      .select()
      .single();
    if (courseErr || !newCourse) throw courseErr ?? new Error("Création cours échouée");

    // 2. Copy modules
    const { data: modules } = await admin
      .from("lms_modules")
      .select("*")
      .eq("course_id", courseId)
      .order("position");

    const moduleIdMap: Record<string, string> = {};

    for (const mod of modules ?? []) {
      const { id: _mId, created_at: _mc, updated_at: _mu, ...modFields } = mod;
      const { data: newMod } = await admin
        .from("lms_modules")
        .insert({ ...modFields, course_id: newCourse.id, prerequisite_module_id: null })
        .select("id")
        .single();
      if (newMod) moduleIdMap[mod.id] = newMod.id;
    }

    // Fix prerequisite_module_id references now that all modules exist
    for (const mod of modules ?? []) {
      if (mod.prerequisite_module_id && moduleIdMap[mod.prerequisite_module_id]) {
        await admin
          .from("lms_modules")
          .update({ prerequisite_module_id: moduleIdMap[mod.prerequisite_module_id] })
          .eq("id", moduleIdMap[mod.id]);
      }
    }

    // 3. Copy lessons
    const { data: lessons } = await admin
      .from("lms_lessons")
      .select("*")
      .in("module_id", Object.keys(moduleIdMap));

    const lessonIdMap: Record<string, string> = {};

    for (const lesson of lessons ?? []) {
      const { id: _lId, created_at: _lc, updated_at: _lu, ...lessonFields } = lesson;
      const newModuleId = moduleIdMap[lesson.module_id];
      if (!newModuleId) continue;
      const { data: newLesson } = await admin
        .from("lms_lessons")
        .insert({ ...lessonFields, module_id: newModuleId })
        .select("id")
        .single();
      if (newLesson) lessonIdMap[lesson.id] = newLesson.id;
    }

    // 4. Copy blocks (only in "full" mode)
    if (mode === "full") {
      const { data: blocks } = await admin
        .from("lms_lesson_blocks")
        .select("*")
        .in("lesson_id", Object.keys(lessonIdMap))
        .order("position");

      const blockIdMap: Record<string, string> = {};

      // First pass: blocks without parent
      for (const block of (blocks ?? []).filter((b) => !b.parent_block_id)) {
        const { id: _bId, created_at: _bc, updated_at: _bu, ...blockFields } = block;
        const newLessonId = lessonIdMap[block.lesson_id];
        if (!newLessonId) continue;
        const { data: newBlock } = await admin
          .from("lms_lesson_blocks")
          .insert({ ...blockFields, lesson_id: newLessonId, parent_block_id: null })
          .select("id")
          .single();
        if (newBlock) blockIdMap[block.id] = newBlock.id;
      }

      // Second pass: child blocks
      for (const block of (blocks ?? []).filter((b) => b.parent_block_id)) {
        const { id: _bId, created_at: _bc, updated_at: _bu, ...blockFields } = block;
        const newLessonId = lessonIdMap[block.lesson_id];
        const newParentId = blockIdMap[block.parent_block_id];
        if (!newLessonId) continue;
        await admin
          .from("lms_lesson_blocks")
          .insert({ ...blockFields, lesson_id: newLessonId, parent_block_id: newParentId ?? null });
      }
    }

    return new Response(
      JSON.stringify({ success: true, newCourseId: newCourse.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("duplicate-lms-course error:", error);
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
