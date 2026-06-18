import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { createLearnerClient } from "@/integrations/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GroupMatchingConfig {
  id: string;
  post_id: string;
  group_size: number;
  created_at: string;
}

export interface GroupMatchingRegistration {
  id: string;
  post_id: string;
  learner_email: string;
  status: "pending" | "assigned";
  created_at: string;
}

export interface GroupMatchingMember {
  learner_email: string;
  first_name?: string | null;
  last_name?: string | null;
  photo_url?: string | null;
}

export interface GroupMatchingGroup {
  id: string;
  post_id: string;
  wave: number;
  email_sent_at: string | null;
  created_at: string;
  members: GroupMatchingMember[];
}

export interface MatchingPostSummary {
  post_id: string;
  post_content: string | null;
  group_size: number;
  config_id: string;
  pending_count: number;
  assigned_count: number;
  group_count: number;
}

// ── Keys ──────────────────────────────────────────────────────────────────────

const CONFIG_KEY = (postId: string) => ["group-matching-config", postId];
const MY_REG_KEY = (postId: string, email: string) => ["group-matching-my-reg", postId, email];
const GROUPS_KEY = (postId: string) => ["group-matching-groups", postId];
const UNASSIGNED_KEY = (postId: string) => ["group-matching-unassigned", postId];
const ALL_POSTS_KEY = ["group-matching-all-posts"];

// ── Queries ───────────────────────────────────────────────────────────────────

export function useGroupMatchingConfig(postId: string | null) {
  return useQuery({
    queryKey: CONFIG_KEY(postId ?? ""),
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("group_matching_configs")
        .select("*")
        .eq("post_id", postId)
        .maybeSingle();
      if (error) throw error;
      return (data as GroupMatchingConfig) ?? null;
    },
  });
}

export function useMyGroupRegistration(postId: string | null, learnerEmail: string | null) {
  return useQuery({
    queryKey: MY_REG_KEY(postId ?? "", learnerEmail ?? ""),
    enabled: !!postId && !!learnerEmail,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("group_matching_registrations")
        .select("*")
        .eq("post_id", postId)
        .eq("learner_email", learnerEmail)
        .maybeSingle();
      if (error) throw error;
      return (data as GroupMatchingRegistration) ?? null;
    },
  });
}

export function usePostGroups(postId: string | null) {
  return useQuery({
    queryKey: GROUPS_KEY(postId ?? ""),
    enabled: !!postId,
    queryFn: async () => {
      const { data: groups, error } = await (supabase as any)
        .from("group_matching_groups")
        .select("*")
        .eq("post_id", postId)
        .order("wave", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!groups?.length) return [] as GroupMatchingGroup[];

      const groupIds = (groups as Array<{ id: string }>).map((g) => g.id);
      const { data: members } = await (supabase as any)
        .from("group_matching_members")
        .select("group_id, learner_email")
        .in("group_id", groupIds);

      const memberEmails = [...new Set((members ?? []).map((m: any) => m.learner_email as string))];
      const { data: profiles } = memberEmails.length
        ? await (supabase as any)
            .from("learner_profiles")
            .select("email, first_name, last_name, photo_url")
            .in("email", memberEmails)
        : { data: [] };

      const profileMap = new Map<string, GroupMatchingMember>();
      for (const p of (profiles ?? []) as Array<{ email: string; first_name: string | null; last_name: string | null; photo_url: string | null }>) {
        profileMap.set(p.email, { learner_email: p.email, first_name: p.first_name, last_name: p.last_name, photo_url: p.photo_url });
      }

      return (groups as any[]).map((g) => ({
        ...g,
        members: ((members ?? []) as Array<{ group_id: string; learner_email: string }>)
          .filter((m) => m.group_id === g.id)
          .map((m) => profileMap.get(m.learner_email) ?? { learner_email: m.learner_email }),
      })) as GroupMatchingGroup[];
    },
  });
}

export function useUnassignedRegistrations(postId: string | null) {
  return useQuery({
    queryKey: UNASSIGNED_KEY(postId ?? ""),
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("group_matching_registrations")
        .select("*")
        .eq("post_id", postId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GroupMatchingRegistration[];
    },
  });
}

export function useAllMatchingPosts() {
  return useQuery({
    queryKey: ALL_POSTS_KEY,
    queryFn: async () => {
      const { data: configs, error } = await (supabase as any)
        .from("group_matching_configs")
        .select("id, post_id, group_size, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!configs?.length) return [] as MatchingPostSummary[];

      const postIds = (configs as Array<{ post_id: string }>).map((c) => c.post_id);

      const [{ data: posts }, { data: regs }, { data: groups }] = await Promise.all([
        (supabase as any).from("practice_posts").select("id, content").in("id", postIds),
        (supabase as any).from("group_matching_registrations").select("post_id, status").in("post_id", postIds),
        (supabase as any).from("group_matching_groups").select("post_id").in("post_id", postIds),
      ]);

      const postMap = new Map<string, string | null>();
      for (const p of (posts ?? []) as Array<{ id: string; content: string | null }>) {
        postMap.set(p.id, p.content);
      }

      return (configs as Array<{ id: string; post_id: string; group_size: number }>).map((c) => {
        const allRegs = ((regs ?? []) as Array<{ post_id: string; status: string }>).filter((r) => r.post_id === c.post_id);
        return {
          post_id: c.post_id,
          post_content: postMap.get(c.post_id) ?? null,
          group_size: c.group_size,
          config_id: c.id,
          pending_count: allRegs.filter((r) => r.status === "pending").length,
          assigned_count: allRegs.filter((r) => r.status === "assigned").length,
          group_count: ((groups ?? []) as Array<{ post_id: string }>).filter((g) => g.post_id === c.post_id).length,
        } satisfies MatchingPostSummary;
      });
    },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export function useRegisterForMatching(postId: string, learnerEmail: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const c = createLearnerClient(learnerEmail);
      const { error } = await (c as any)
        .from("group_matching_registrations")
        .insert({ post_id: postId, learner_email: learnerEmail, status: "pending" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MY_REG_KEY(postId, learnerEmail) });
      qc.invalidateQueries({ queryKey: CONFIG_KEY(postId) });
      qc.invalidateQueries({ queryKey: ALL_POSTS_KEY });
    },
  });
}

export function useUnregisterFromMatching(postId: string, learnerEmail: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const c = createLearnerClient(learnerEmail);
      const { error } = await (c as any)
        .from("group_matching_registrations")
        .delete()
        .eq("post_id", postId)
        .eq("learner_email", learnerEmail)
        .eq("status", "pending");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: MY_REG_KEY(postId, learnerEmail) });
      qc.invalidateQueries({ queryKey: CONFIG_KEY(postId) });
      qc.invalidateQueries({ queryKey: ALL_POSTS_KEY });
    },
  });
}

export function usePendingRegistrationProfiles(postId: string | null) {
  return useQuery({
    queryKey: ["group-matching-pending-profiles", postId ?? ""],
    enabled: !!postId,
    queryFn: async () => {
      const { data: regs, error } = await (supabase as any)
        .from("group_matching_registrations")
        .select("learner_email")
        .eq("post_id", postId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!regs?.length) return [] as GroupMatchingMember[];

      const emails = (regs as Array<{ learner_email: string }>).map((r) => r.learner_email);
      const { data: profiles } = await (supabase as any)
        .from("learner_profiles")
        .select("email, first_name, last_name, photo_url")
        .in("email", emails);

      const profileMap = new Map<string, GroupMatchingMember>();
      for (const p of (profiles ?? []) as Array<{ email: string; first_name: string | null; last_name: string | null; photo_url: string | null }>) {
        profileMap.set(p.email, { learner_email: p.email, first_name: p.first_name, last_name: p.last_name, photo_url: p.photo_url });
      }
      return emails.map((e) => profileMap.get(e) ?? { learner_email: e });
    },
  });
}

export function useRegistrationCount(postId: string | null) {
  return useQuery({
    queryKey: ["group-matching-reg-count", postId ?? ""],
    enabled: !!postId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("group_matching_registrations")
        .select("status")
        .eq("post_id", postId);
      if (error) throw error;
      const rows = (data ?? []) as Array<{ status: string }>;
      return {
        total: rows.length,
        pending: rows.filter((r) => r.status === "pending").length,
        assigned: rows.filter((r) => r.status === "assigned").length,
      };
    },
  });
}

export function useFormGroups(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupSize }: { groupSize: number }) => {
      const { data: pending, error } = await (supabase as any)
        .from("group_matching_registrations")
        .select("id, learner_email")
        .eq("post_id", postId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!pending?.length) return [];

      const { data: lastGroup } = await (supabase as any)
        .from("group_matching_groups")
        .select("wave")
        .eq("post_id", postId)
        .order("wave", { ascending: false })
        .limit(1)
        .maybeSingle();
      const wave = ((lastGroup as any)?.wave ?? 0) + 1;

      const rows = pending as Array<{ id: string; learner_email: string }>;
      // Only build COMPLETE groups; the remainder stays pending so the admin
      // can attach them to an existing group.
      const fullGroupsCount = Math.floor(rows.length / groupSize);
      if (fullGroupsCount === 0) return [];

      const chunks: typeof rows[] = [];
      for (let i = 0; i < fullGroupsCount; i++) {
        chunks.push(rows.slice(i * groupSize, (i + 1) * groupSize));
      }

      const createdGroups: GroupMatchingGroup[] = [];
      for (const chunk of chunks) {
        const { data: newGroup, error: gErr } = await (supabase as any)
          .from("group_matching_groups")
          .insert({ post_id: postId, wave })
          .select("*")
          .single();
        if (gErr) throw gErr;
        const groupId = (newGroup as any).id;

        await (supabase as any)
          .from("group_matching_members")
          .insert(chunk.map((r) => ({ group_id: groupId, registration_id: r.id, learner_email: r.learner_email })));

        await (supabase as any)
          .from("group_matching_registrations")
          .update({ status: "assigned" })
          .in("id", chunk.map((r) => r.id));

        createdGroups.push({ ...(newGroup as any), members: chunk.map((r) => ({ learner_email: r.learner_email })) });
      }
      return createdGroups;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GROUPS_KEY(postId) });
      qc.invalidateQueries({ queryKey: UNASSIGNED_KEY(postId) });
      qc.invalidateQueries({ queryKey: ALL_POSTS_KEY });
    },
  });
}

export function useAddMemberToGroup(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, registrationId, learnerEmail }: { groupId: string; registrationId: string; learnerEmail: string }) => {
      const { error } = await (supabase as any)
        .from("group_matching_members")
        .upsert(
          { group_id: groupId, registration_id: registrationId, learner_email: learnerEmail },
          { onConflict: "registration_id" }
        );
      if (error) throw error;
      const { error: updateError } = await (supabase as any)
        .from("group_matching_registrations")
        .update({ status: "assigned" })
        .eq("id", registrationId);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GROUPS_KEY(postId) });
      qc.invalidateQueries({ queryKey: UNASSIGNED_KEY(postId) });
      qc.invalidateQueries({ queryKey: ALL_POSTS_KEY });
    },
  });
}

export function useRemoveMemberFromGroup(postId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ groupId, registrationId }: { groupId: string; registrationId: string }) => {
      const { error: delErr } = await (supabase as any)
        .from("group_matching_members")
        .delete()
        .eq("group_id", groupId)
        .eq("registration_id", registrationId);
      if (delErr) throw delErr;

      const { error: updErr } = await (supabase as any)
        .from("group_matching_registrations")
        .update({ status: "pending" })
        .eq("id", registrationId);
      if (updErr) throw updErr;

      const { data: remaining, error: cErr } = await (supabase as any)
        .from("group_matching_members")
        .select("registration_id")
        .eq("group_id", groupId);
      if (cErr) throw cErr;

      if (!remaining || (remaining as any[]).length === 0) {
        await (supabase as any).from("group_matching_groups").delete().eq("id", groupId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: GROUPS_KEY(postId) });
      qc.invalidateQueries({ queryKey: UNASSIGNED_KEY(postId) });
      qc.invalidateQueries({ queryKey: ALL_POSTS_KEY });
    },
  });
}

export function useSendGroupEmail() {
  return useMutation({
    mutationFn: async (groupId: string) => {
      const { data, error } = await supabase.functions.invoke("send-group-matching-email", {
        body: { group_id: groupId },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error ?? "Échec de l'envoi");
      return data;
    },
  });
}

export function useCreateMatchingConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ postId, groupSize }: { postId: string; groupSize: number }) => {
      const { error } = await (supabase as any)
        .from("group_matching_configs")
        .insert({ post_id: postId, group_size: groupSize });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: CONFIG_KEY(vars.postId) });
      qc.invalidateQueries({ queryKey: ALL_POSTS_KEY });
    },
  });
}
