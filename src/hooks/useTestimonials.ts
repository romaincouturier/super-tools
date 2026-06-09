import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TestimonialStatus = "pending_review" | "published" | "rejected";

export interface Testimonial {
  id: string;
  drive_file_id: string | null;
  video_url: string | null;
  client_name: string | null;
  company: string | null;
  service_type: string | null;
  raw_transcript: string | null;
  reviewer_notes: string | null;
  status: TestimonialStatus;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useTestimonials(status?: TestimonialStatus | "") {
  return useQuery({
    queryKey: ["testimonials", status],
    queryFn: async () => {
      let q = (supabase as any)
        .from("testimonials")
        .select("*")
        .order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data as Testimonial[];
    },
  });
}

export function useTestimonialCounts() {
  return useQuery({
    queryKey: ["testimonials-counts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("testimonials")
        .select("status");
      if (error) throw error;
      const rows = data as Array<{ status: TestimonialStatus }>;
      return {
        pending_review: rows.filter((r) => r.status === "pending_review").length,
        published: rows.filter((r) => r.status === "published").length,
        rejected: rows.filter((r) => r.status === "rejected").length,
      };
    },
  });
}

interface CreateTestimonialPayload {
  client_name?: string;
  company?: string;
  service_type?: string;
  video_url: string;
  reviewer_notes?: string;
}

export function useCreateTestimonial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTestimonialPayload) => {
      const { data, error } = await (supabase as any)
        .from("testimonials")
        .insert({ ...payload, status: "pending_review" })
        .select()
        .single();
      if (error) throw error;
      return data as Testimonial;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["testimonials"] });
      qc.invalidateQueries({ queryKey: ["testimonials-counts"] });
    },
  });
}

interface UpdateTestimonialPayload {
  id: string;
  client_name?: string;
  company?: string;
  service_type?: string;
  reviewer_notes?: string;
  status?: TestimonialStatus;
}

export function useUpdateTestimonial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdateTestimonialPayload) => {
      const payload: Record<string, unknown> = { ...updates };
      if (updates.status === "published") {
        payload.published_at = new Date().toISOString();
      }
      const { data, error } = await (supabase as any)
        .from("testimonials")
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as Testimonial;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["testimonials"] });
      qc.invalidateQueries({ queryKey: ["testimonials-counts"] });
    },
  });
}
