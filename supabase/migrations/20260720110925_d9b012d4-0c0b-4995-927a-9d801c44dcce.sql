update public.book_productions
set thumbnail_url = case id
  when 'bab41b64-f0f3-417a-9466-58a2ce9bc411' then 'thumbnails/bab41b64-f0f3-417a-9466-58a2ce9bc411.jpg'
  when '124c58cd-f43d-49a2-b39f-2c07aa61ee91' then 'thumbnails/124c58cd-f43d-49a2-b39f-2c07aa61ee91.jpg'
  when '070c7413-68a7-4cbf-8f57-ce68d184dfd7' then 'thumbnails/070c7413-68a7-4cbf-8f57-ce68d184dfd7.jpg'
  when '4b0e6d37-a95e-43b4-8e32-a1ce585da5d5' then 'thumbnails/4b0e6d37-a95e-43b4-8e32-a1ce585da5d5.jpg'
  when '29d723c8-5f87-4b93-9ea1-422b09aed3f2' then 'thumbnails/29d723c8-5f87-4b93-9ea1-422b09aed3f2.jpg'
  when 'bd1a17c1-e322-40f0-97ed-587c4c74462b' then 'thumbnails/bd1a17c1-e322-40f0-97ed-587c4c74462b.jpg'
  when '11d7403a-b94e-496f-b3a9-c076231f4cb8' then 'thumbnails/11d7403a-b94e-496f-b3a9-c076231f4cb8.jpg'
  else thumbnail_url
end,
updated_at = now()
where id in (
  'bab41b64-f0f3-417a-9466-58a2ce9bc411',
  '124c58cd-f43d-49a2-b39f-2c07aa61ee91',
  '070c7413-68a7-4cbf-8f57-ce68d184dfd7',
  '4b0e6d37-a95e-43b4-8e32-a1ce585da5d5',
  '29d723c8-5f87-4b93-9ea1-422b09aed3f2',
  'bd1a17c1-e322-40f0-97ed-587c4c74462b',
  '11d7403a-b94e-496f-b3a9-c076231f4cb8'
);