-- Synchronisation programmée Sendcloud : curseur de polling (dernier passage réussi)
ALTER TABLE public.polling_cursors DROP CONSTRAINT polling_cursors_source_check;
ALTER TABLE public.polling_cursors ADD CONSTRAINT polling_cursors_source_check
  CHECK (source IN ('drive_transcripts','drive_testimonials','fireflies','woocommerce','loom','sendcloud'));

INSERT INTO public.polling_cursors (source) VALUES ('sendcloud')
  ON CONFLICT (source) DO NOTHING;
