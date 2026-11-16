import { supabase } from "@/integrations/supabase/client";

export async function listCommunityCourses() {
  const { data, error } = await supabase.from("lms_courses").select("id, title").order("title");
  if (error) throw error;
  return data ?? [];
}