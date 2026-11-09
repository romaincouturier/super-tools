import { supabase } from "@/integrations/supabase/client";
import { fetchStaffPublicProfiles } from "@/lib/supabase-helpers";

const db = supabase as any;

async function readRows(query: () => any): Promise<any[]> {
  const rows: any[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await query().range(offset, offset + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}

export async function fetchPracticePostDetails(posts: { id: string; author_email: string }[]) {
  const postIds = posts.map((post) => post.id);
  if (!postIds.length) return { reactions: [], comments: [], profiles: [], staffProfiles: [], hashtags: [], polls: [], options: [], votes: [] };
  const [reactions, comments, hashtags, polls, staffProfiles] = await Promise.all([
    readRows(() => db.from("practice_post_reactions").select("id, post_id, author_email, reaction_type").in("post_id", postIds).order("id")),
    readRows(() => db.from("practice_post_comments").select("id, post_id").in("post_id", postIds).order("id")),
    readRows(() => db.from("practice_post_hashtags").select("id, post_id, tag").in("post_id", postIds).order("id")),
    readRows(() => db.from("practice_polls").select("id, post_id").in("post_id", postIds).order("id")),
    fetchStaffPublicProfiles(),
  ]);
  const emails = [...new Set([...posts.map((post) => post.author_email), ...reactions.map((reaction) => reaction.author_email)])];
  const pollIds = polls.map((poll) => poll.id);
  const [profiles, options, votes] = await Promise.all([
    readRows(() => db.from("learner_profiles").select("email, first_name, last_name, photo_url").in("email", emails).order("email")),
    pollIds.length ? readRows(() => db.from("practice_poll_options").select("id, poll_id, label, position").in("poll_id", pollIds).order("id")) : [],
    pollIds.length ? readRows(() => db.from("practice_poll_votes").select("id, poll_id, option_id, author_email").in("poll_id", pollIds).order("id")) : [],
  ]);
  return { reactions, comments, profiles, staffProfiles, hashtags, polls, options, votes };
}