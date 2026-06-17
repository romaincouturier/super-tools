import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase, createLearnerClient } from "@/integrations/supabase/client";
import { resolveContentType } from "@/lib/file-utils";
import { todayAsISO } from "@/lib/dateFormatters";

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
  is_pinned: boolean;
  is_staff_treated: boolean;
  file_rotation: number;
  created_at: string;
  updated_at: string;
  // enriched client-side
  author_first_name?: string | null;
  author_last_name?: string | null;
  author_photo_url?: string | null;
  author_is_staff?: boolean;
  lesson_title?: string | null;
  course_title?: string | null;
  reaction_count: number;
  i_reacted: boolean;
  reactions_by_type: Record<string, number>;
  reactions_by_type_users: Record<string, string[]>;
  my_reaction_types: string[];
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
  author_display_name?: string | null;
  is_staff_reply?: boolean;
}

const POSTS_KEY = ["practice_posts"];
const COMMENTS_KEY = (postId: string) => ["practice_comments", postId];

/** Supabase client alias for tables absent from generated types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function clientFor(email?: string | null, asAdmin = false) {
  if (asAdmin) return supabase;
  return email ? createLearnerClient(email) : supabase;
}

/**
 * Returns a Supabase-compatible query client for tables not present in the
 * generated schema. Accepts either the main supabase client or a learner
 * client (both expose the same `.from()` API at runtime).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function clientDb(email?: string | null, asAdmin = false): any {
  return clientFor(email, asAdmin);
}

// ── Internal raw row types ────────────────────────────────────────────────────

interface RawPost {
  id: string;
  author_email: string;
  content: string | null;
  file_url: string | null;
  file_name: string | null;
  file_mime: string | null;
  file_size: number | null;
  course_id: string | null;
  lesson_id: string | null;
  is_pinned: boolean;
  is_staff_treated: boolean;
  file_rotation: number;
  created_at: string;
  updated_at: string;
}

interface RawReaction {
  post_id: string;
  author_email: string;
  reaction_type: string | null;
}

interface RawCommentCount {
  id: string;
  post_id: string;
}

interface RawProfile {
  email: string;
  first_name: string | null;
  last_name: string | null;
  photo_url: string | null;
}

interface RawHashtag {
  post_id: string;
  tag: string;
}

interface RawPoll {
  id: string;
  post_id: string;
}

interface RawPollOption {
  id: string;
  poll_id: string;
  label: string;
  position: number | null;
}

interface RawPollVote {
  poll_id: string;
  option_id: string;
  author_email: string;
}

interface RawLesson {
  id: string;
  title: string;
}

interface RawCourse {
  id: string;
  title: string;
}

interface RawComment {
  id: string;
  post_id: string;
  author_email: string;
  content: string;
  created_at: string;
  is_staff_reply?: boolean;
  author_display_name?: string | null;
}


// ── Posts ────────────────────────────────────────────────────────────────────

export interface PracticePostsFilter {
  lessonId?: string | null;
  /** Only posts attached to this course. */
  courseId?: string | null;
  /** Only posts attached to one of these courses (admin cross-session view). */
  courseIds?: string[] | null;
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
  isAdmin = false,
) {
  const lessonFilter = options?.lessonId ?? null;
  const courseFilter = options?.courseId ?? null;
  const courseIdsFilter = options?.courseIds ?? null;
  const authorFilter = options?.authorEmail ?? null;
  const likedByFilter = options?.likedBy ?? null;
  const tagFilter = options?.tag ?? null;
  return useQuery({
    queryKey: [...POSTS_KEY, learnerEmail, limit, lessonFilter, courseFilter, courseIdsFilter, authorFilter, likedByFilter, tagFilter, isAdmin],
    queryFn: async (): Promise<PracticePost[]> => {
      if (!learnerEmail) return [];
      const c = clientDb(learnerEmail, isAdmin);

      // Resolve post-id restrictions from like / tag filters first.
      let restrictIds: string[] | null = null;
      const intersect = (ids: string[]) => {
        restrictIds = restrictIds === null ? ids : restrictIds.filter((id) => ids.includes(id));
      };
      if (likedByFilter) {
        const { data } = await c.from("practice_post_reactions").select("post_id").eq("author_email", likedByFilter);
        intersect(Array.from(new Set(((data || []) as { post_id: string }[]).map((r) => r.post_id))));
      }
      if (tagFilter) {
        const { data } = await c.from("practice_post_hashtags").select("post_id").eq("tag", tagFilter);
        intersect(Array.from(new Set(((data || []) as { post_id: string }[]).map((r) => r.post_id))));
      }
      if (restrictIds !== null && restrictIds.length === 0) return [];

      let postsQuery = c.from("practice_posts").select("*").order("is_pinned", { ascending: false }).order("created_at", { ascending: false }).limit(limit);
      if (lessonFilter) postsQuery = postsQuery.eq("lesson_id", lessonFilter);
      if (courseFilter) postsQuery = postsQuery.eq("course_id", courseFilter);
      if (courseIdsFilter && courseIdsFilter.length > 0) postsQuery = postsQuery.in("course_id", courseIdsFilter);
      if (authorFilter) postsQuery = postsQuery.eq("author_email", authorFilter);
      if (restrictIds !== null) postsQuery = postsQuery.in("id", restrictIds);

      const [postsRes, reactionsRes, commentsRes, profilesRes, staffProfilesRes, hashtagsRes, pollsRes, optionsRes, votesRes] = await Promise.all([
        postsQuery,
        c.from("practice_post_reactions").select("post_id, author_email, reaction_type"),
        c.from("practice_post_comments").select("id, post_id"),
        db.from("learner_profiles").select("email, first_name, last_name, photo_url"),
        db.rpc("get_staff_public_profiles"),
        c.from("practice_post_hashtags").select("post_id, tag"),
        c.from("practice_polls").select("id, post_id"),
        c.from("practice_poll_options").select("id, poll_id, label, position"),
        c.from("practice_poll_votes").select("poll_id, option_id, author_email"),
      ]);

      if (postsRes.error) throw postsRes.error;

      const posts: RawPost[] = postsRes.data || [];
      const reactions: RawReaction[] = reactionsRes.data || [];
      const comments: RawCommentCount[] = commentsRes.data || [];
      // Merge staff profiles + learner profiles; staff profile takes precedence
      // so a staff member's real name and avatar are used instead of any legacy
      // learner_profile they may also have for testing.
      const learnerProfiles: RawProfile[] = profilesRes.data || [];
      const staffProfiles: RawProfile[] = staffProfilesRes.data || [];
      const staffEmailSet = new Set(staffProfiles.map((p) => p.email));
      const profiles: RawProfile[] = [
        ...staffProfiles,
        ...learnerProfiles.filter((lp) => !staffEmailSet.has(lp.email)),
      ];
      const hashtags: RawHashtag[] = hashtagsRes.data || [];
      const polls: RawPoll[] = pollsRes.data || [];
      const pollOptions: RawPollOption[] = optionsRes.data || [];
      const votes: RawPollVote[] = votesRes.data || [];

      const profileMap = new Map(profiles.map((p) => [p.email, p]));
      const pollByPost = new Map(polls.map((p) => [p.post_id, p]));

      // Enrich with lesson/course titles when present
      const lessonIds = Array.from(new Set(posts.map((p) => p.lesson_id).filter(Boolean))) as string[];
      const courseIds = Array.from(new Set(posts.map((p) => p.course_id).filter(Boolean))) as string[];
      const [lessonsRes, coursesRes] = await Promise.all([
        lessonIds.length
          ? db.from("lms_lessons").select("id, title").in("id", lessonIds)
          : Promise.resolve({ data: [] as RawLesson[] }),
        courseIds.length
          ? db.from("lms_courses").select("id, title").in("id", courseIds)
          : Promise.resolve({ data: [] as RawCourse[] }),
      ]);
      const lessonMap = new Map(((lessonsRes.data || []) as RawLesson[]).map((l) => [l.id, l.title]));
      const courseMap = new Map(((coursesRes.data || []) as RawCourse[]).map((c) => [c.id, c.title]));

      const buildPoll = (postId: string): PracticePoll | null => {
        const poll = pollByPost.get(postId);
        if (!poll) return null;
        const opts = pollOptions
          .filter((o) => o.poll_id === poll.id)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        const pollVotes = votes.filter((v) => v.poll_id === poll.id);
        const myVote = pollVotes.find((v) => v.author_email === learnerEmail);
        return {
          id: poll.id,
          total_votes: pollVotes.length,
          my_option_id: myVote?.option_id ?? null,
          options: opts.map((o) => ({
            id: o.id,
            label: o.label,
            vote_count: pollVotes.filter((v) => v.option_id === o.id).length,
          })),
        };
      };

      return posts.map((post) => {
        const postReactions = reactions.filter((r) => r.post_id === post.id);
        const postComments = comments.filter((c) => c.post_id === post.id);
        const profile = profileMap.get(post.author_email);
        return {
          ...post,
          author_first_name: profile?.first_name ?? null,
          author_last_name: profile?.last_name ?? null,
          author_photo_url: profile?.photo_url ?? null,
          author_is_staff: staffEmailSet.has(post.author_email),
          lesson_title: post.lesson_id ? (lessonMap.get(post.lesson_id) ?? null) : null,
          course_title: post.course_id ? (courseMap.get(post.course_id) ?? null) : null,
          reaction_count: postReactions.length,
          i_reacted: postReactions.some((r) => r.author_email === learnerEmail),
          reactions_by_type: postReactions.reduce((acc: Record<string, number>, r) => {
            const t = r.reaction_type ?? '👍';
            acc[t] = (acc[t] ?? 0) + 1;
            return acc;
          }, {}),
          reactions_by_type_users: postReactions.reduce((acc: Record<string, string[]>, r) => {
            const t = r.reaction_type ?? '👍';
            const p = profileMap.get(r.author_email);
            const name = p ? [p.first_name, p.last_name].filter(Boolean).join(" ") || r.author_email : r.author_email;
            acc[t] = [...(acc[t] ?? []), name];
            return acc;
          }, {}),
          my_reaction_types: postReactions
            .filter((r) => r.author_email === learnerEmail)
            .map((r) => r.reaction_type ?? '👍'),
          comment_count: postComments.length,
          hashtags: hashtags.filter((h) => h.post_id === post.id).map((h) => h.tag),
          poll: buildPoll(post.id),
        };
      });
    },
    enabled: !!learnerEmail,
  });
}

// ── Comments ─────────────────────────────────────────────────────────────────

export function usePracticeComments(postId: string | null, learnerEmail: string | null, isAdmin = false) {
  return useQuery({
    queryKey: [...COMMENTS_KEY(postId ?? ""), isAdmin],
    queryFn: async (): Promise<PracticeComment[]> => {
      if (!postId || !learnerEmail) return [];
      const c = clientDb(learnerEmail, isAdmin);
      const [commentsRes, learnerProfilesRes, staffProfilesRes] = await Promise.all([
        c.from("practice_post_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true }),
        db.from("learner_profiles").select("email, first_name, last_name, photo_url"),
        db.rpc("get_staff_public_profiles"),
      ]);

      if (commentsRes.error) throw commentsRes.error;
      const learnerProfiles: RawProfile[] = learnerProfilesRes.data || [];
      const staffProfiles: RawProfile[] = staffProfilesRes.data || [];
      const staffEmailSet = new Set(staffProfiles.map((p) => p.email));
      // Staff profile takes precedence so a staff member's real name and avatar
      // are used instead of any legacy learner_profile with the same email.
      const profileMap = new Map<string, RawProfile>([
        ...learnerProfiles.filter((lp) => !staffEmailSet.has(lp.email)).map((p) => [p.email, p] as [string, RawProfile]),
        ...staffProfiles.map((p) => [p.email, p] as [string, RawProfile]),
      ]);
      return ((commentsRes.data || []) as RawComment[]).map((c) => {
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
      const c = clientDb(learnerEmail);
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
      const c = clientDb(learnerEmail);
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
      interface RawMyComment { id: string; post_id: string; content: string; created_at: string }
      interface RawPostExcerpt { id: string; content: string | null; author_email: string }
      const c = clientDb(learnerEmail);
      const { data: comments, error } = await c.from("practice_post_comments")
        .select("id, post_id, content, created_at")
        .eq("author_email", learnerEmail)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list: RawMyComment[] = comments || [];
      const postIds = Array.from(new Set(list.map((x) => x.post_id)));
      const postsRes = postIds.length
        ? await c.from("practice_posts").select("id, content, author_email").in("id", postIds)
        : { data: [] as RawPostExcerpt[] };
      const postMap = new Map<string, RawPostExcerpt>(((postsRes.data || []) as RawPostExcerpt[]).map((p) => [p.id, p]));
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

export function useCreatePracticePost(learnerEmail: string | null, isAdmin = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ content, file, courseId, lessonId, poll, gifUrl }: {
      content: string;
      file: File | null;
      courseId?: string | null;
      lessonId?: string | null;
      poll?: NewPoll | null;
      gifUrl?: string | null;
    }) => {
      if (!learnerEmail) throw new Error("Not authenticated");
      const c = clientDb(learnerEmail, isAdmin);
      let fileData: { url: string; name: string; size: number; mime: string } | null = null;
      if (gifUrl) {
        fileData = { url: gifUrl, name: "gif", size: 0, mime: "image/gif" };
      } else if (file) {
        fileData = await uploadPracticeFile(file, learnerEmail);
      }

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
      return postId;
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
      const c = clientDb(learnerEmail);
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
      const c = clientDb(learnerEmail);
      const { data, error } = await c.rpc("practice_popular_hashtags", { p_limit: limit });
      if (error) throw error;
      return ((data || []) as { tag: string; post_count: number | string }[]).map((r) => ({ tag: r.tag, post_count: Number(r.post_count) }));
    },
    enabled: !!learnerEmail,
  });
}

// ── Reaction toggle ───────────────────────────────────────────────────────────

export function useTogglePracticeReaction(learnerEmail: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, emoji, iReacted }: { postId: string; emoji: string; iReacted: boolean }) => {
      if (!learnerEmail) throw new Error("Not authenticated");
      const c = clientDb(learnerEmail);
      if (iReacted) {
        const { error } = await c.from("practice_post_reactions")
          .delete().eq("post_id", postId).eq("author_email", learnerEmail).eq("reaction_type", emoji);
        if (error) throw error;
      } else {
        const { error } = await c.from("practice_post_reactions")
          .insert({ post_id: postId, author_email: learnerEmail, reaction_type: emoji });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: POSTS_KEY }),
  });
}

// ── Create comment ────────────────────────────────────────────────────────────

export function useCreatePracticeComment(
  learnerEmail: string | null,
  isAdmin = false,
  authorDisplayName?: string | null,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      if (!learnerEmail) throw new Error("Not authenticated");
      const c = clientDb(learnerEmail, isAdmin);
      const { data: inserted, error } = await c.from("practice_post_comments")
        .insert({
          post_id: postId,
          author_email: learnerEmail,
          content,
          is_staff_reply: isAdmin,
          author_display_name: isAdmin ? (authorDisplayName ?? null) : null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Staff comment counts as treatment: auto-mark the post as treated so
      // it disappears from the "À traiter" filter without an extra click.
      if (isAdmin) {
        db
          .from("practice_posts")
          .update({ is_staff_treated: true })
          .eq("id", postId)
          .then(({ error: e }: { error: unknown }) => {
            if (e) console.warn("auto mark treated failed:", e);
          });
      }

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


// ── Pin / unpin post (admin only) ─────────────────────────────────────────────

export function usePinPracticePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, pin }: { postId: string; pin: boolean }) => {
      const { error } = await db
        .from("practice_posts")
        .update({ is_pinned: pin })
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POSTS_KEY });
    },
  });
}

// ── Update post ───────────────────────────────────────────────────────────────

export function useUpdatePracticePost(learnerEmail: string | null, isAdmin = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      if (!isAdmin && !learnerEmail) throw new Error("Not authenticated");
      const c = clientDb(isAdmin ? null : learnerEmail, isAdmin);
      const { error } = await c.from("practice_posts").update({ content }).eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: POSTS_KEY }),
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
      const c = clientDb(isAdmin ? null : learnerEmail, isAdmin);
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
      const c = clientDb(isAdmin ? null : learnerEmail, isAdmin);
      const { error } = await c.from("practice_post_comments").delete().eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: (_, { postId }) => {
      qc.invalidateQueries({ queryKey: POSTS_KEY });
      qc.invalidateQueries({ queryKey: COMMENTS_KEY(postId) });
    },
  });
}

// ── Update comment ────────────────────────────────────────────────────────────

export function useUpdatePracticeComment(learnerEmail: string | null, isAdmin = false) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; postId: string; content: string }) => {
      if (!isAdmin && !learnerEmail) throw new Error("Not authenticated");
      const c = clientDb(isAdmin ? null : learnerEmail, isAdmin);
      const { error } = await c.from("practice_post_comments").update({ content }).eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: (_, { postId }) => {
      qc.invalidateQueries({ queryKey: COMMENTS_KEY(postId) });
    },
  });
}

// ── Admin community: current & upcoming training sessions (cross-session view) ──

export interface AdminCommunityCourse {
  courseId: string;
  title: string;
}

export function useAdminCommunityCourses() {
  return useQuery({
    queryKey: ["admin_community_courses"],
    queryFn: async (): Promise<AdminCommunityCourse[]> => {
      const today = todayAsISO();
      const { data: trainings, error } = await supabase
        .from("trainings")
        .select("supports_lms_course_id, training_name, start_date, end_date")
        .not("supports_lms_course_id", "is", null)
        .or(`end_date.gte.${today},and(end_date.is.null,start_date.gte.${today})`);
      if (error) throw error;

      interface RawTraining { supports_lms_course_id: string | null }
      const courseIds = Array.from(
        new Set(((trainings || []) as RawTraining[]).map((t) => t.supports_lms_course_id).filter(Boolean)),
      ) as string[];
      if (courseIds.length === 0) return [];

      const { data: courses } = await supabase
        .from("lms_courses")
        .select("id, title")
        .in("id", courseIds);
      const titleMap = new Map((courses || []).map((c) => [c.id, c.title]));

      return courseIds.map((id) => ({
        courseId: id,
        title: (titleMap.get(id) as string | null) ?? "Cours sans titre",
      }));
    },
  });
}

// ── Mark post as staff-treated (manual checkbox) ─────────────────────────────

export function useMarkPostStaffTreated() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, treated }: { postId: string; treated: boolean }) => {
      const { error } = await db
        .from("practice_posts")
        .update({ is_staff_treated: treated })
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: POSTS_KEY }),
  });
}

export function useRotatePracticePostImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, rotation }: { postId: string; rotation: number }) => {
      const { error } = await db
        .from("practice_posts")
        .update({ file_rotation: ((rotation % 360) + 360) % 360 })
        .eq("id", postId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: POSTS_KEY }),
  });
}
