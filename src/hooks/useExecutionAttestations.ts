import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  cancelExecutionAttestation, createExecutionAttestation, generateExecutionAttestationLink,
  listExecutionAttestations, updateExecutionAttestation, type AttestationFilter, type ExecutionAttestationPatch,
} from "@/services/executionAttestations";

const KEY = "execution-attestations";

export function useExecutionAttestations(filter: AttestationFilter = {}) {
  return useQuery({ queryKey: [KEY, filter], queryFn: () => listExecutionAttestations(filter) });
}

export function useExecutionAttestationMutations() {
  const qc = useQueryClient();
  const done = () => qc.invalidateQueries({ queryKey: [KEY] });
  return {
    create: useMutation({ mutationFn: createExecutionAttestation, onSuccess: done }),
    update: useMutation({ mutationFn: ({ id, patch }: { id: string; patch: ExecutionAttestationPatch }) => updateExecutionAttestation(id, patch), onSuccess: done }),
    cancel: useMutation({ mutationFn: cancelExecutionAttestation, onSuccess: done }),
    link: useMutation({ mutationFn: generateExecutionAttestationLink, onSuccess: done }),
  };
}
