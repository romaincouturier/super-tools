CREATE OR REPLACE FUNCTION public.normalize_watch_source_url(value text)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE base text; params text;
BEGIN
  value := lower(btrim(value));
  IF value !~ '^https?://[^/?#[:space:]]+' OR value ~ '[[:space:]]' THEN
    RAISE EXCEPTION 'URL HTTP(S) invalide';
  END IF;
  value := split_part(value, '#', 1);
  base := rtrim(split_part(value, '?', 1), '/');
  IF strpos(value, '?') > 0 THEN
    SELECT string_agg(p, '&' ORDER BY n) INTO params
    FROM unnest(string_to_array(substring(value FROM strpos(value, '?') + 1), '&')) WITH ORDINALITY AS q(p,n)
    WHERE p <> '' AND split_part(p, '=', 1) NOT LIKE 'utm\_%' ESCAPE '\';
  END IF;
  RETURN base || CASE WHEN params IS NULL THEN '' ELSE '?' || params END;
END;
$$;
CREATE TABLE IF NOT EXISTS public.watch_sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 expert text NOT NULL CHECK (expert IN ('strategie','commercial-reseau','marketing-seo','ic-facilitation','pedagogie-qualite','ia-supertools','productivite','daf-juridique','evenements','concurrence','newsletters')),
 theme text NOT NULL DEFAULT '' CHECK (length(theme) <= 160),
 name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 300),
 type text NOT NULL CHECK (type IN ('newsletter','podcast','youtube','tiktok','linkedin','blog','revue','site','autre')),
 language text NOT NULL CHECK (language IN ('fr','en','autre')),
 url text NOT NULL UNIQUE CHECK (length(url) <= 4000),
 why text NOT NULL DEFAULT '',
 how_to_follow text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','to_subscribe','followed','dropped')),
 usefulness integer CHECK (usefulness BETWEEN 1 AND 5),
 items_count integer NOT NULL DEFAULT 0 CHECK (items_count >= 0),
 last_useful_at timestamptz,
 proposed_by text NOT NULL DEFAULT 'romain',
 notes text NOT NULL DEFAULT ''
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_sources TO authenticated;
GRANT ALL ON public.watch_sources TO service_role;
ALTER TABLE public.watch_sources ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='watch_sources' AND policyname='staff_manage_watch_sources') THEN
 CREATE POLICY staff_manage_watch_sources ON public.watch_sources FOR ALL TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.prepare_watch_source()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 NEW.url := public.normalize_watch_source_url(NEW.url);
 NEW.updated_at := now();
 RETURN NEW;
END;
$$;
CREATE TRIGGER prepare_watch_source BEFORE INSERT OR UPDATE ON public.watch_sources FOR EACH ROW EXECUTE FUNCTION public.prepare_watch_source();
ALTER TABLE public.watch_items ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES public.watch_sources(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS watch_items_source_id_idx ON public.watch_items(source_id);
CREATE INDEX IF NOT EXISTS watch_sources_expert_status_idx ON public.watch_sources(expert,status);
CREATE OR REPLACE FUNCTION public.count_watch_source_items()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF TG_OP <> 'INSERT' AND OLD.source_id IS NOT NULL AND (TG_OP='DELETE' OR OLD.source_id IS DISTINCT FROM NEW.source_id) THEN
  UPDATE public.watch_sources SET items_count=greatest(0,items_count-1) WHERE id=OLD.source_id;
 END IF;
 IF TG_OP <> 'DELETE' AND NEW.source_id IS NOT NULL AND (TG_OP='INSERT' OR NEW.source_id IS DISTINCT FROM OLD.source_id) THEN
  UPDATE public.watch_sources SET items_count=items_count+1 WHERE id=NEW.source_id;
 END IF;
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.prepare_watch_source() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.count_watch_source_items() FROM PUBLIC;
CREATE TRIGGER count_watch_source_items AFTER INSERT OR UPDATE OF source_id OR DELETE ON public.watch_items FOR EACH ROW EXECUTE FUNCTION public.count_watch_source_items();