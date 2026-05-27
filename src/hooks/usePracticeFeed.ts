import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, createLearnerClient } from "@/integrations/supabase/client";
import { resolveContentType } from "@/lib/file-utils";

// ── Types ────────────────────────────────────────────────────────────────────

export interface PracticePollOption {
  id: string;
  label: string;
  vote_count: number;
}

export interface PracticePoll {
  id: string;
  options: PracticePollOption[];
  total_votes: number;
  my_option_id: string | null;
}

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
  hashtags: string[];
  poll: PracticePoll | null;
}

export interface NewPoll {
  options: string[];
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

export interface PracticePostsFilter {
  lessonId?: string | null;
  /** Only posts attached to this course. */
  courseId?: string | null;
  /** Only posts authored by this email (Mes publications). */
  authorEmail?: string | null;
  /** Only posts the given email reacted to (Mes likes). */
  likedBy?: string | null;
  /** Only posts carrying this hashtag. */
  tag?: string | null;
}

export function usePracticePosts(
  learnerEmail: string | null,
  limit = 50,
  options?: PracticePostsFilter,
) {
  const lessonFilter = options?.lessonId ?? null;
  const courseFilter = options?.courseId ?? null;
  const authorFilter = options?.authorEmail ?? null;
  const likedByFilter = options?.likedBy ?? null;
  const tagFilter = options?.tag ?? null;
  return useQuery({
    queryKey: [...POSTS_KEY, learnerEmail, limit, lessonFilter, courseFilter, authorFilter, likedByFilter, tagFilter],
    queryFn: async (): Promise<PracticePost[]> => {
      if (!learnerEmail) return [];
      const c = clientFor(learnerEmail) as any;

      // Resolve post-id restrictions from like / tag filters first.
      let restrictIds: string[] | null = null;
      const intersect = (ids: string[]) => {
        restrictIds = restrictIds === null ? ids : restrictIds.filter((id) => ids.includes(id));
      };
      if (likedByFilter) {
        const { data } = await c.from("practice_post_reactions").select("post_id").eq("author_email", likedByFilter);
        intersect(Array.from(new Set((data || []).map((r: any) => r.post_id))));
      }
      if (tagFilter) {
        const { data } = await c.from("practice_post_hashtags").select("post_id").eq("tag", tagFilter);
        intersect(Array.from(new Set((data || []).map((r: any) => r.post_id))));
      }
      if (restrictIds !== null && restrictIds.length === 0) return [];

      let postsQuery = c.from("practice_posts").select("*").order("created_at", { ascending: false }).limit(limit);
      if (lessonFilter) postsQuery = postsQuery.eq("lesson_id", lessonFilter);
      if (courseFilter) postsQuery = postsQuery.eq("course_id", courseFilter);
      if (authorFilter) postsQuery = postsQuery.eq("author_email", authorFilter);
      if (restrictIds !== null) postsQuery = postsQuery.in("id", restrictIds);

      const [postsRes, reactionsRes, commentsRes, profilesRes, hashtagsRes, pollsRes, optionsRes, votesRes] = await Promise.all([
        postsQuery,
        c.from("practice_post_reactions").select("post_id, author_email"),
        c.from("practice_post_comments").select("id, post_id"),
        (supabase as any).from("learner_profiles").select("email, first_name, last_name, photo_url"),
        c.from("practice_post_hashtags").select("post_id, tag"),
        c.from("practice_polls").select("id, post_id"),
        c.from("practice_poll_options").select("id, poll_id, label, position"),
        c.from("practice_poll_votes").select("poll_id, option_id, author_email"),
      ]);

      if (postsRes.error) throw postsRes.error;

      const posts: any[] = postsRes.data || [];
      const reactions: any[] = reactionsRes.data || [];
      const comments: any[] = commentsRes.data || [];
      const profiles: any[] = profilesRes.data || [];
      const hashtags: any[] = hashtagsRes.data || [];
      const polls: any[] = pollsRes.data || [];
      const pollOptions: any[] = optionsRes.data || [];
      const votes: any[] = votesRes.data || [];

      const profileMap = new Map(profiles.map((p: any) => [p.email, p]));
      const pollByPost = new Map(polls.map((p: any) => [p.post_id, p]));

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

      const buildPoll = (postId: string): PracticePoll | null => {
        const poll = pollByPost.get(postId);
        if (!poll) return null;
        const opts = pollOptions
          .filter((o: any) => o.poll_id === poll.id)
          .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
        const pollVotes = votes.filter((v: any) => v.poll_id === poll.id);
        const myVote = pollVotes.find((v: any) => v.author_email === learnerEmail);
        return {
          id: poll.id,
          total_votes: pollVotes.length,
          my_option_id: myVote?.option_id ?? null,
          options: opts.map((o: any) => ({
            id: o.id,
            label: o.label,
            vote_count: pollVotes.filter((v: any) => v.option_id === o.id).length,
          })),
        };
      };

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
          hashtags: hashtags.filter((h: any) => h.post_id === post.id).map((h: any) => h.tag),
          poll: buildPoll(post.id),
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

// ── Lesson title (for the "return to formation" card) ──────────────────────────

export function useLessonTitle(learnerEmail: string | null, lessonId: string | null) {
  return useQuery({
    queryKey: ["practice_lesson_title", lessonId],
    queryFn: async (): Promise<string | null> => {
      if (!lessonId) return null;
      const c = clientFor(learnerEmail) as any;
      const { data } = await c.from("lms_lessons").select("title").eq("id", lessonId).maybeSingle();
      return (data as { title?: string } | null)?.title ?? null;
    },
    enabled: !!lessonId,
  });
}

export function useCourseTitle(learnerEmail: string | null, courseId: string | null) {
  return useQuery({
    queryKey: ["practice_course_title", courseId],
    queryFn: async (): Promise<string | null> => {
      if (!courseId) return null;
      const c = clientFor(learnerEmail) as any;
      const { data } = await c.from("lms_courses").select("title").eq("id", courseId).maybeSingle();
      return (data as { title?: string } | null)?.title ?? null;
    },
    enabled: !!courseId,
  });
}

// ── My comments (author-scoped) ────────────────────────────────────────────────

export interface MyPracticeComment {
  id: string;
  post_id: string;
  content: string;
  created_at: string;
  post_excerpt: string | null;
  post_author_email: string;
}

export function useMyPracticeComments(learnerEmail: string | null) {
  return useQuery({
    queryKey: ["practice_my_comments", learnerEmail],
    queryFn: async (): Promise<MyPracticeComment[]> => {
      if (!learnerEmail) return [];
      const c = clientFor(learnerEmail) as any;
      const { data: comments, error } = await c.from("practice_post_comments")
        .select("id, post_id, content, created_at")
        .eq("author_email", learnerEmail)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list: any[] = comments || [];
      const postIds = Array.from(new Set(list.map((x) => x.post_id)));
      const postsRes = postIds.length
        ? await c.from("practice_posts").select("id, content, author_email").in("id", postIds)
        : { data: [] };
      const postMap = new Map<string, any>(((postsRes.data || []) as any[]).map((p: any) => [p.id, p]));
      return list.map((cm) => {
        const post = postMap.get(cm.post_id);
        return {
          id: cm.id,
          post_id: cm.post_id,
          content: cm.content,
          created_at: cm.created_at,
          post_excerpt: post?.content ?? null,
          post_author_email: post?.author_email ?? "",
        };
      });
    },
    enabled: !!learnerEmail,
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

async function generateHashtags(content: string): Promise<string[]> {
  const text = content.trim();
  if (!text) return [];
  try {
    const { data } = await supabase.functions.invoke("generate-practice-hashtags", { body: { content: text } });
    const tags = (data as { hashtags?: unknown } | null)?.hashtags;
    return Array.isArray(tags) ? tags.filter((t): t is string => typeof t === "string").slice(0, 3) : [];
  } catch (err) {
    console.warn("generate-practice-hashtags failed:", err);
    return [];
  }
}

export function useCreatePracticePost(learnerEmail: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ content, file, courseId, lessonId, poll }: {
      content: string;
      file: File | null;
      courseId?: string | null;
      lessonId?: string | null;
      poll?: NewPoll | null;
    }) => {
      if (!learnerEmail) throw new Error("Not authenticated");
      const c = clientFor(learnerEmail) as any;
      let fileData: { url: string; name: string; size: number; mime: string } | null = null;
      if (file) fileData = await uploadPracticeFile(file, learnerEmail);

      // Synchronous AI hashtags at publish (1-3 tags, never blocks on failure).
      const hashtags = await generateHashtags(content);

      const { data: inserted, error } = await c.from("practice_posts").insert({
        author_email: learnerEmail,
        content: content.trim() || null,
        file_url: fileData?.url ?? null,
        file_name: fileData?.name ?? null,
        file_mime: fileData?.mime ?? null,
        file_size: fileData?.size ?? null,
        course_id: courseId ?? null,
        lesson_id: lessonId ?? null,
      }).select("id").single();
      if (error) throw error;
      const postId = (inserted as { id: string }).id;

      if (hashtags.length) {
        await c.from("practice_post_hashtags").insert(hashtags.map((tag) => ({ post_id: postId, tag })));
      }

      const pollOptions = (poll?.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (pollOptions.length >= 2) {
        const { data: pollRow, error: pollErr } = await c.from("practice_polls")
          .insert({ post_id: postId }).select("id").single();
        if (pollErr) throw pollErr;
        const pollId = (pollRow as { id: string }).id;
        await c.from("practice_poll_options").insert(
          pollOptions.map((label, position) => ({ poll_id: pollId, label, position })),
        );
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: POSTS_KEY }),
  });
}

// ── Poll vote ──────────────────────────────────────────────────────────────────

export function useVotePracticePoll(learnerEmail: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pollId, optionId, currentOptionId }: { pollId: string; optionId: string; currentOptionId: string | null }) => {
      if (!learnerEmail) throw new Error("Not authenticated");
      const c = clientFor(learnerEmail) as any;
      if (currentOptionId === optionId) {
        // Toggle off: remove the vote.
        const { error } = await c.from("practice_poll_votes")
          .delete().eq("poll_id", pollId).eq("author_email", learnerEmail);
        if (error) throw error;
        return;
      }
      if (currentOptionId) {
        const { error } = await c.from("practice_poll_votes")
          .update({ option_id: optionId }).eq("poll_id", pollId).eq("author_email", learnerEmail);
        if (error) throw error;
      } else {
        const { error } = await c.from("practice_poll_votes")
          .insert({ poll_id: pollId, option_id: optionId, author_email: learnerEmail });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: POSTS_KEY }),
  });
}

// ── Popular hashtags ─────────────────────────────────────────────────────────

export interface PopularHashtag { tag: string; post_count: number }

export function usePracticePopularHashtags(learnerEmail: string | null, limit = 5) {
  return useQuery({
    queryKey: ["practice_popular_hashtags", learnerEmail, limit],
    queryFn: async (): Promise<PopularHashtag[]> => {
      if (!learnerEmail) return [];
      const c = clientFor(learnerEmail) as any;
      const { data, error } = await c.rpc("practice_popular_hashtags", { p_limit: limit });
      if (error) throw error;
      return (data || []).map((r: any) => ({ tag: r.tag, post_count: Number(r.post_count) }));
    },
    enabled: !!learnerEmail,
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
