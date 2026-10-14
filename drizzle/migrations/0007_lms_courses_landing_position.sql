ALTER TABLE public.lms_courses ADD COLUMN IF NOT EXISTS landing_position integer;
COMMENT ON COLUMN public.lms_courses.landing_position IS 'Ordre d''affichage dans la section « Commencez gratuitement » de la landing Academy (croissant, null = en fin de liste par created_at).';
UPDATE public.lms_courses SET landing_position = v.pos FROM (VALUES
 ('65592ca7-4cbb-43f1-b9f3-cc2a3134742e'::uuid,1),
 ('f794d041-0794-4ced-b2e2-cd3fb7ac8287'::uuid,2),
 ('1a8efa6c-fddc-4e4c-9228-e67aff4083b0'::uuid,3),
 ('2da412a9-4917-4306-9187-a2137b17700c'::uuid,4),
 ('d20bf41f-6eeb-47b7-aab7-57def92d69ca'::uuid,5),
 ('523576df-b909-4b02-8ccc-dfc0626b812c'::uuid,6),
 ('63b845af-1c32-43fe-af3a-3e1cde39cdcb'::uuid,7)
) AS v(id,pos) WHERE lms_courses.id = v.id;