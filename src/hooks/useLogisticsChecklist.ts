import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as logistics from "@/services/logistics";
import type { LogisticsChecklistItem, LogisticsEntityType } from "@/types/logistics";

const QK = "logistics-checklist";

export function useLogisticsChecklist(entityType: LogisticsEntityType, entityId: string | null | undefined) {
  return useQuery({
    queryKey: [QK, entityType, entityId],
    queryFn: () => logistics.fetchItems(entityType, entityId!),
    enabled: !!entityId,
  });
}

export function useCreateLogisticsItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: logistics.createItem,
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: [QK, item.entity_type, item.entity_id] });
    },
  });
}

export function useUpdateLogisticsItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<LogisticsChecklistItem> }) =>
      logistics.updateItem(id, updates),
    onSuccess: (item) => {
      qc.invalidateQueries({ queryKey: [QK, item.entity_type, item.entity_id] });
    },
  });
}

export function useDeleteLogisticsItem(entityType: LogisticsEntityType, entityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => logistics.deleteItem(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK, entityType, entityId] });
    },
  });
}
