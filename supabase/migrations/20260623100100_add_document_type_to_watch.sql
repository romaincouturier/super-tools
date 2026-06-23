-- Veille — Permettre le dépôt de documents PDF
-- Ajoute le type de contenu 'document' et autorise les PDF dans le bucket de stockage.

-- 1. Étendre la contrainte CHECK sur content_type (contrainte auto-nommée par Postgres)
ALTER TABLE public.watch_items
  DROP CONSTRAINT IF EXISTS watch_items_content_type_check;

ALTER TABLE public.watch_items
  ADD CONSTRAINT watch_items_content_type_check
  CHECK (content_type IN ('text', 'url', 'image', 'audio', 'document'));

-- 2. Autoriser les PDF dans le bucket 'watch'
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
    'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/x-m4a', 'audio/mp3',
    'application/pdf'
  ]
WHERE id = 'watch';
