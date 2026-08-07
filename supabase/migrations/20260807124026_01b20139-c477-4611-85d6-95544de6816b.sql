UPDATE lms_lesson_blocks
   SET content = replace(content::text,
        '/lms/1a8efa6c-fddc-4e4c-9228-e67aff4083b0/playerlessons/les-icebreakers/topic/memo-portraits-croises/',
        '/lms/1a8efa6c-fddc-4e4c-9228-e67aff4083b0/player?lesson=86d06093-0520-4096-b173-6ecc0c4e573e')::jsonb
 WHERE content::text LIKE '%playerlessons/les-icebreakers/topic/memo-portraits-croises/%';