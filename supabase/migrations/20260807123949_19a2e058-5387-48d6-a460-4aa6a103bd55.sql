DO $$
DECLARE
  m record;
  ib uuid := '1a8efa6c-fddc-4e4c-9228-e67aff4083b0';
  cc uuid := '98f7aa46-a2e9-40af-a408-d680d5f4b995';
  fg uuid := 'a1958c5d-17cb-4ede-8823-728e6c874cfc';
  sk uuid := 'c3801b50-f819-4b58-b51c-383075abd40d';
  base text := '/courses/icebreakers-a-la-carte/lessons/les-icebreakers/topic/memo-';
  tdd  text := '/courses/sortir-de-la-dette-technique-le-programme-dentrainement/lessons/module-1-introduction-a-la-dette-technique-et-au-tdd-test-driven-development/topic/';
  pairs text[][] := ARRAY[
    [base||'1-2-3/',                  '/lms/'||ib||'/player?lesson=6b4c7efe-7381-4a2c-8424-6c78e93d2ad7'],
    [base||'bingo/',                  '/lms/'||ib||'/player?lesson=519e6504-7684-45c5-8770-8b0dfb5e9f0d'],
    [base||'brainstorming-musical/',  '/lms/'||ib||'/player?lesson=05130b0f-a847-46cd-a0a6-a89b2b765a61'],
    [base||'ce-sera-un-succes-si/',   '/lms/'||ib||'/player?lesson=93535d89-fce9-4641-b26d-56a3f4427864'],
    [base||'combat-de-pouces/',       '/lms/'||ib||'/player?lesson=ab46aa84-d3ec-41af-bc0c-a6a8357e64ea'],
    [base||'constellation/',          '/lms/'||ib||'/player?lesson=955aaa0c-e0c6-45c6-80a8-36a953a88a37'],
    [base||'creation-de-badge/',      '/lms/'||ib||'/player?lesson=d8dd49c8-7cc7-4140-8e9f-428b5af8fcff'],
    [base||'gribouillis/',            '/lms/'||ib||'/player?lesson=1c3ef0f6-1977-44b1-bfbf-ffb5701d975f'],
    [base||'jai-besoin-de/',          '/lms/'||ib||'/player?lesson=ba969207-3414-4db8-b262-886334c7e1e8'],
    [base||'la-gourmandise-en-couleur/','/lms/'||ib||'/player?lesson=54d038ad-10b9-4ea1-b8ea-86eca34a98ef'],
    [base||'lile-deserte/',           '/lms/'||ib||'/player?lesson=f40467b9-4fa0-4cd0-bce0-f5fa9203c097'],
    [base||'match-des-attentes/',     '/lms/'||ib||'/player?lesson=d32cd355-8769-4750-b7be-57b98519fd8b'],
    [base||'parler-dimages/',         '/lms/'||ib||'/player?lesson=23c5fe3b-8736-4381-80d6-17f6aed0eede'],
    [base||'slogans/',                '/lms/'||ib||'/player?lesson=38ae4320-5ae0-485d-90bc-2f390df0963f'],
    [tdd||'le-cycle-tdd/',            '/lms/'||cc||'/player?lesson=cb9e8f2e-79b6-4b48-b7e3-7970b52d9ff1'],
    [tdd||'exercice-un-premier-bout-de-code-en-tdd/', '/lms/'||cc||'/player?lesson=f589ae87-b77c-4cf0-b4a2-27851f431cf8'],
    ['/courses/icebreakers-a-la-carte/',  '/lms/'||ib||'/player'],
    ['/courses/icebreakers-mode-demploi/','/lms/f794d041-0794-4ced-b2e2-cd3fb7ac8287/player']
  ];
  i int;
BEGIN
  FOR i IN 1..array_length(pairs,1) LOOP
    UPDATE lms_lesson_blocks
       SET content = replace(replace(content::text,
             'https://www.supertilt.fr'||pairs[i][1], pairs[i][2]),
             'https://supertilt.fr'||pairs[i][1], pairs[i][2])::jsonb
     WHERE content::text LIKE '%supertilt.fr'||pairs[i][1]||'%';
  END LOOP;

  -- "module ressources" (vidéos coups de pouce) : cible propre à chaque cours
  UPDATE lms_lesson_blocks b
     SET content = replace(replace(content::text,
           'https://www.supertilt.fr/courses/facilitation-graphique-communiquer-avec-le-visuel-facilitateur-graphique-pro/lessons/ressources/',
           '/lms/'||fg||'/player?lesson=9cfe9860-c62d-4de8-8e40-4ced5ab8dee8'),
           'https://supertilt.fr/courses/facilitation-graphique-communiquer-avec-le-visuel-facilitateur-graphique-pro/lessons/ressources/',
           '/lms/'||fg||'/player?lesson=9cfe9860-c62d-4de8-8e40-4ced5ab8dee8')::jsonb
   WHERE content::text LIKE '%/lessons/ressources/%'
     AND EXISTS (SELECT 1 FROM lms_lessons l JOIN lms_modules mo ON mo.id=l.module_id
                  WHERE l.id=b.lesson_id AND mo.course_id=fg);

  UPDATE lms_lesson_blocks b
     SET content = replace(replace(content::text,
           'https://www.supertilt.fr/courses/facilitation-graphique-communiquer-avec-le-visuel-facilitateur-graphique-pro/lessons/ressources/',
           '/lms/'||sk||'/player?lesson=5f249bd7-27d0-4820-8939-131ecac9f4c5'),
           'https://supertilt.fr/courses/facilitation-graphique-communiquer-avec-le-visuel-facilitateur-graphique-pro/lessons/ressources/',
           '/lms/'||sk||'/player?lesson=5f249bd7-27d0-4820-8939-131ecac9f4c5')::jsonb
   WHERE content::text LIKE '%/lessons/ressources/%'
     AND EXISTS (SELECT 1 FROM lms_lessons l JOIN lms_modules mo ON mo.id=l.module_id
                  WHERE l.id=b.lesson_id AND mo.course_id=sk);
END $$;