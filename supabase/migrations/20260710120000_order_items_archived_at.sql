-- Soft delete des cartes du kanban dropshipping.
-- Un DELETE brut serait recréé par supertilt-webhook (upsert + filet de
-- sécurité "0 order_items") : on archive au lieu de supprimer.
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.order_items.archived_at IS
'Soft delete : la ligne est masquée du kanban mais conservée pour que l''upsert webhook ne la recrée pas. Ne jamais remettre à NULL depuis le webhook.';
