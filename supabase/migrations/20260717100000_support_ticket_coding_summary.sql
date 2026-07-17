-- Conclusion du dev auto-coding, écrite par le skill /process-ticket à la fin
-- du traitement. Affichée dans le détail du ticket pour décider du merge.

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS coding_summary text;
