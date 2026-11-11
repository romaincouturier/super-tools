import { supabase } from "@/integrations/supabase/client";
import type { ProjectAssignee } from "../../supabase/functions/_shared/project-assignee";

export async function fetchProjectAssignees(): Promise<ProjectAssignee[]> {
  const { data, error } = await supabase.rpc("get_project_assignees");
  if (error) throw error;
  return data || [];
}