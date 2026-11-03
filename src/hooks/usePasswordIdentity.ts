import { useQuery } from "@tanstack/react-query";
import { loadPasswordIdentity, savePasswordIdentity } from "@/services/passwordIdentity";

export function usePasswordIdentity(enabled: boolean) {
  const query = useQuery({
    queryKey: ["password-identity"],
    queryFn: loadPasswordIdentity,
    enabled,
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
  return { ...query, saveIdentity: savePasswordIdentity };
}