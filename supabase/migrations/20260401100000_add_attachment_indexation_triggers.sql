-- ============================================================
-- Indexation triggers for file attachments (CRM + Support)
-- ============================================================

-- CRM Attachments
CREATE TRIGGER trg_index_crm_attachment
  AFTER INSERT
  ON public.crm_attachments
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('crm_attachment');

CREATE TRIGGER trg_delete_crm_attachment_embedding
  AFTER DELETE
  ON public.crm_attachments
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('crm_attachment');

-- Support Ticket Attachments
CREATE TRIGGER trg_index_support_attachment
  AFTER INSERT
  ON public.support_ticket_attachments
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('support_attachment');

CREATE TRIGGER trg_delete_support_attachment_embedding
  AFTER DELETE
  ON public.support_ticket_attachments
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_indexation('support_attachment');
