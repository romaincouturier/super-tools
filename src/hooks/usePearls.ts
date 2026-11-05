import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPearl,
  deletePearl,
  getRandomPearl,
  listPearlLinkTargets,
  listPearls,
  updatePearl,
  uploadPearlImage,
  type PearlInput,
} from "@/services/pearls";

const KEY = ["client-pearls"];

export function usePearls() {
  return useQuery({ queryKey: KEY, queryFn: listPearls });
}

export function useRandomPearl(enabled: boolean) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["client-pearl-random"],
    queryFn: () => getRandomPearl(),
    enabled,
    staleTime: Infinity,
    gcTime: 0,
  });
  const another = useMutation({
    mutationFn: (excludeId?: string) => getRandomPearl(excludeId),
    onSuccess: (pearl) => {
      if (pearl) qc.setQueryData(["client-pearl-random"], pearl);
    },
  });
  return { pearl: query.data ?? null, next: () => another.mutate(query.data?.id), loading: another.isPending };
}

export function usePearlMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: KEY });
  return {
    create: useMutation({
      mutationFn: async ({ input, image }: { input: PearlInput; image?: File | null }) => {
        const image_path = image ? await uploadPearlImage(image) : input.image_path;
        return createPearl({ ...input, image_path });
      },
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: async ({ id, input, image }: { id: string; input: Partial<PearlInput>; image?: File | null }) => {
        const patch = image ? { ...input, image_path: await uploadPearlImage(image) } : input;
        return updatePearl(id, patch);
      },
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: deletePearl, onSuccess: refresh }),
  };
}

export function usePearlLinkTargets(enabled: boolean) {
  return useQuery({ queryKey: ["client-pearl-link-targets"], queryFn: listPearlLinkTargets, enabled, staleTime: 5 * 60 * 1000 });
}
