import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, createLearnerClient } from "@/integrations/supabase/client";
import { resolveContentType } from "@/lib/file-utils";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PracticePost {
  id: string;
  author_email: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_mime: string | null;
  file_size: number | null;
  course_id: string | null;
  lesson_id: string | null;
  created_at: string;
  updated_at: string;
  // enriched client-side
  author_first_name?: string | null;
  author_last_name?: string | null;
  author_photo_url?: string | null;
  lesson_title?: string | null;
  course_title?: string | null;
  reaction_count: number;
  i_reacted: boolean;
  comment_count: number;
}

export interface PracticeComment {
  id: string;
  post_id: string;
  author_email: string;
  content: string;
  created_at: string;
  author_first_name?: string | null;
  author_last_name?: string | null;
  author_photo_url?: string | null;
}

const POSTS_KEY = ["practice_posts"];
const COMMENTS_KEY = (postId: string) => ["practice_comments", postId];

function clientFor(email?: string | null) {
  return email ? createLearnerClient(email) : supabase;
}

// ── Posts ────────────────────────────────────────────────────────────────────

export function usePracticePosts(
  learnerEmail: string | null,
  limit = 50,
  options?: { lessonId?: string | null },
) {
  const lessonFilter = options?.lessonId ?? null;
  return useQuery({
    queryKey: [...POSTS_KEY, learnerEmail, limit, lessonFilter],
    queryFn: async (): Promise<PracticePost[]> => {
      if (!learnerEmail) return [];
      const c = clientFor(learnerEmail) as any;

      let postsQuery = c.from("practice_posts").select("*").order("created_at", { ascending: false }).limit(limit);
      if (lessonFilter) postsQuery = postsQuery.eq("lesson_id", lessonFilter);

      const [postsRes, reactionsRes, commentsRes, profilesRes] = await Promise.all([
        postsQuery,
        c.from("practice_post_reactions").select("post_id, author_email"),
        c.from("practice_post_comments").select("id, post_id"),
        (supabase as any).from("learner_profiles").select("email, first_name, last_name, photo_url"),
      ]);

      if (postsRes.error) throw postsRes.error;

      const posts: any[] = postsRes.data || [];
      const reactions: any[] = reactionsRes.data || [];
      const comments: any[] = commentsRes.data || [];
      const profiles: any[] = profilesRes.data || [];

      const profileMap = new Map(profiles.map((p: any) => [p.email, p]));

      // Enrich with lesson/course titles when present
      const lessonIds = Array.from(new Set(posts.map((p: any) => p.lesson_id).filter(Boolean)));
      const courseIds = Array.from(new Set(posts.map((p: any) => p.course_id).filter(Boolean)));
      const [lessonsRes, coursesRes] = await Promise.all([
        lessonIds.length
          ? (supabase as any).from("lms_lessons").select("id, title").in("id", lessonIds)
          : Promise.resolve({ data: [] }),
        courseIds.length
          ? (supabase as any).from("lms_courses").select("id, title").in("id", courseIds)
          : Promise.resolve({ data: [] }),
      ]);
      const lessonMap = new Map((lessonsRes.data || []).map((l: any) => [l.id, l.title]));
      const courseMap = new Map((coursesRes.data || []).map((c: any) => [c.id, c.title]));

      return posts.map((post: any) => {
        const postReactions = reactions.filter((r: any) => r.post_id === post.id);
        const postComments = comments.filter((c: any) => c.post_id === post.id);
        const profile = profileMap.get(post.author_email);
        return {
          ...post,
          author_first_name: profile?.first_name ?? null,
          author_last_name: profile?.last_name ?? null,
          author_photo_url: profile?.photo_url ?? null,
          lesson_title: post.lesson_id ? (lessonMap.get(post.lesson_id) ?? null) : null,
          course_title: post.course_id ? (courseMap.get(post.course_id) ?? null) : null,
          reaction_count: postReactions.length,
          i_reacted: postReactions.some((r: any) => r.author_email === learnerEmail),
          comment_count: postComments.length,
        };
      });
    },
    enabled: !!learnerEmail,
  });
}

// ── Comments ─────────────────────────────────────────────────────────────────

export function usePracticeComments(postId: string | null, learnerEmail: string | null) {
  return useQuery({
    queryKey: COMMENTS_KEY(postId ?? ""),
    queryFn: async (): Promise<PracticeComment[]> => {
      if (!postId || !learnerEmail) return [];
      const c = clientFor(learnerEmail) as any;
      const [commentsRes, profilesRes] = await Promise.all([
        c.from("practice_post_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true }),
        (supabase as any).from("learner_profiles").select("email, first_name, last_name, photo_url"),
      ]);
      if (commentsRes.error) throw commentsRes.error;
      const profiles: any[] = profilesRes.data || [];
      const profileMap = new Map(profiles.map((p: any) => [p.email, p]));
      return (commentsRes.data || []).map((c: any) => {
        const profile = profileMap.get(c.author_email);
        return {
          ...c,
          author_first_name: profile?.first_name ?? null,
          author_last_name: profile?.last_name ?? null,
          author_photo_url: profile?.photo_url ?? null,
        };
      });
    },
    enabled: !!postId && !!learnerEmail,
  });
}

// ── Upload + Create post ──────────────────────────────────────────────────────

async function uploadPracticeFile(file: File, learnerEmail: string) {
  const mime = resolveContentType(file);
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const path = `practice/${learnerEmail}/${Date.now()}_${safeName}`;
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("path", path);
  const { data, error } = await supabase.functions.invoke("upload-lms-content", { body: formData });
  if (error) throw error;
  const publicUrl = (data as { publicUrl?: string } | null)?.publicUrl;
  if (!publicUrl) throw new Error("URL introuvable après l'upload");
  return { url: publicUrl, name: file.name, size: file.size, mime };
}

export function useCreatePracticePost(learnerEmail: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ content, file, courseId, lessonId }: { content: string; file: File | null; courseId?: string | null; lessonId?: string | null }) => {
      if (!learnerEmail) throw new Error("Not authenticated");
      const c = clientFor(learnerEmail) as any;
      let fileData: { url: string; name: string; size: number; mime: string } | null = null;
      if (file) fileData = await uploadPracticeFile(file, learnerEmail);
      const { error } = await c.from("practice_posts").insert({
        author_email: learnerEmail,
        content: content.trim() || null,
        file_url: fileData?.url ?? null,
        file_name: fileData?.name ?? null,
        file_mime: fileData?.mime ?? null,
        file_size: fileData?.size ?? null,
        course_id: courseId ?? null,
        lesson_id: lessonId ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: POSTS_KEY }),
  });
}

// ── Reaction toggle ───────────────────────────────────────────────────────────

export function useTogglePracticeReaction(learnerEmail: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, iReacted }: { postId: string; iReacted: boolean }) => {
      if (!learnerEmail) throw new Error("Not authenticated");
      const c = clientFor(learnerEmail) as any;
      if (iReacted) {
        const { error } = await c.from("practice_post_reactions")
          .delete().eq("post_id", postId).eq("author_email", learnerEmail);
        if (error) throw error;
      } else {
        const { error } = await c.from("practice_post_reactions")
          .insert({ post_id: postId, author_email: learnerEmail });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: POSTS_KEY }),
  });
}

// ── Create comment ────────────────────────────────────────────────────────────

export function useCreatePracticeComment(learnerEmail: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      if (!learnerEmail) throw new Error("Not authenticated");
      const c = clientFor(learnerEmail) as any;
      const { data: inserted, error } = await c.from("practice_post_comments")
        .insert({ post_id: postId, author_email: learnerEmail, content })
        .select("id")
        .single();
      if (error) throw error;

      // Fire-and-forget: notify the post author (respects email_notif_work_comment)
      supabase.functions
        .invoke("notify-practice-comment", {
          body: { postId, commentId: inserted?.id, commenterEmail: learnerEmail },
        })
        .catch((err) => console.warn("notify-practice-comment failed:", err));
    },
    onSuccess: (_, { postId }) => {
      qc.invalidateQueries({ queryKey: POSTS_KEY });
      qc.invalidateQueries({ queryKey: COMMENTS_KEY(postId) });
    },
  });
}


// ── Delete post ───────────────────────────────────────────────────────────────

export function useDeletePracticePost(learnerEmail: string | null, isAdmin = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (postId: string) => {
      // Admins delete via the authenticated client (auth_manage_practice_posts);
      // learners delete their own via the learner client.
      if (!isAdmin && !learnerEmail) throw new Error("Not authenticated");
      const c = (isAdmin ? supabase : clientFor(learnerEmail)) as any;
      const { error } = await c.from("practice_posts").delete().eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: POSTS_KEY }),
  });
}

// ── Delete comment ────────────────────────────────────────────────────────────

export function useDeletePracticeComment(learnerEmail: string | null, isAdmin = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId }: { commentId: string; postId: string }) => {
      if (!isAdmin && !learnerEmail) throw new Error("Not authenticated");
      const c = (isAdmin ? supabase : clientFor(learnerEmail)) as any;
      const { error } = await c.from("practice_post_comments").delete().eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: (_, { postId }) => {
      qc.invalidateQueries({ queryKey: POSTS_KEY });
      qc.invalidateQueries({ queryKey: COMMENTS_KEY(postId) });
    },
  });
}
