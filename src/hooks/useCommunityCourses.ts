import { useQuery } from "@tanstack/react-query";
import { listCommunityCourses } from "@/services/training-community";

export function useCommunityCourses() {
  return useQuery({ queryKey: ["training-community-courses"], queryFn: listCommunityCourses });
}