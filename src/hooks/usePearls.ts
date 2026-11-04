import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createPearl,
  deletePearl,
  getRandomPearl,
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
  return useQuery({
    queryKey: ["client-pearl-random"],
    queryFn: () => getRandomPearl(),
    enabled,
    staleTime: Infinity,
    gcTime: 0,
  });
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
