import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as logistics from "@/services/logistics";
import type { LogisticsChecklistItem, LogisticsEntityType, ChecklistTemplate, ChecklistTemplateItem } from "@/types/logistics";

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

// ── Unified templates ──────────────────────────────────────────────────────

const QK_TMPL = "checklist-templates";

export function useChecklistTemplates(entityType?: LogisticsEntityType) {
  return useQuery({
    queryKey: [QK_TMPL, entityType ?? "all"],
    queryFn: () => logistics.fetchChecklistTemplates(entityType),
  });
}

export function useCreateChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: logistics.createChecklistTemplate,
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK_TMPL] }),
  });
}

export function useUpdateChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<ChecklistTemplate, "name" | "entity_type">> }) =>
      logistics.updateChecklistTemplate(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK_TMPL] }),
  });
}

export function useDeleteChecklistTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => logistics.deleteChecklistTemplate(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK_TMPL] }),
  });
}

export function useCreateChecklistTemplateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<ChecklistTemplateItem, "id" | "created_at">) =>
      logistics.createChecklistTemplateItem(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK_TMPL] }),
  });
}

export function useUpdateChecklistTemplateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Pick<ChecklistTemplateItem, "label" | "day_offset" | "notify_days_before" | "position">> }) =>
      logistics.updateChecklistTemplateItem(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK_TMPL] }),
  });
}

export function useDeleteChecklistTemplateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => logistics.deleteChecklistTemplateItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK_TMPL] }),
  });
}

export function useImportTemplate(entityType: LogisticsEntityType, entityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, startDate }: { templateId: string; startDate: string | null }) =>
      logistics.importTemplate({ templateId, entityType, entityId, startDate }),
    onSuccess: () => qc.invalidateQueries({ queryKey: [QK, entityType, entityId] }),
  });
}
