update public.book_productions
set thumbnail_url = case id
  when '81784774-17ed-4377-9874-01823b2ce5f6' then 'thumbnails/81784774-17ed-4377-9874-01823b2ce5f6.jpg'
  when 'b831cf5b-c819-4a03-a627-838881670366' then 'thumbnails/b831cf5b-c819-4a03-a627-838881670366.jpg'
  when 'b9794a7f-7f3d-4130-b5e6-ec514f9da7f4' then 'thumbnails/b9794a7f-7f3d-4130-b5e6-ec514f9da7f4.jpg'
  when 'a4f79507-66b8-44ce-928f-9a6d86de03c0' then 'thumbnails/a4f79507-66b8-44ce-928f-9a6d86de03c0.jpg'
  when '9c55951e-06bb-416c-9fa9-bd1b93f25fde' then 'thumbnails/9c55951e-06bb-416c-9fa9-bd1b93f25fde.jpg'
  when '62716e57-a380-4a4b-872e-dd5b36fbf2ac' then 'thumbnails/62716e57-a380-4a4b-872e-dd5b36fbf2ac.jpg'
  when '3bc45a40-2071-4f54-89e6-2e3892ac19e1' then 'thumbnails/3bc45a40-2071-4f54-89e6-2e3892ac19e1.jpg'
  when '15ae6bcb-f047-4605-a5f2-4ea39ef8a918' then 'thumbnails/15ae6bcb-f047-4605-a5f2-4ea39ef8a918.jpg'
  when '25364196-4e64-4b14-8532-0fde47491c3f' then 'thumbnails/25364196-4e64-4b14-8532-0fde47491c3f.jpg'
  when 'ddc673e5-5218-4862-8895-0e1865d5b302' then 'thumbnails/ddc673e5-5218-4862-8895-0e1865d5b302.jpg'
  when '030519a5-8703-4a33-a4e2-af5ff0dfe2c5' then 'thumbnails/030519a5-8703-4a33-a4e2-af5ff0dfe2c5.jpg'
  else thumbnail_url
end,
updated_at = now()
where id in (
  '81784774-17ed-4377-9874-01823b2ce5f6',
  'b831cf5b-c819-4a03-a627-838881670366',
  'b9794a7f-7f3d-4130-b5e6-ec514f9da7f4',
  'a4f79507-66b8-44ce-928f-9a6d86de03c0',
  '9c55951e-06bb-416c-9fa9-bd1b93f25fde',
  '62716e57-a380-4a4b-872e-dd5b36fbf2ac',
  '3bc45a40-2071-4f54-89e6-2e3892ac19e1',
  '15ae6bcb-f047-4605-a5f2-4ea39ef8a918',
  '25364196-4e64-4b14-8532-0fde47491c3f',
  'ddc673e5-5218-4862-8895-0e1865d5b302',
  '030519a5-8703-4a33-a4e2-af5ff0dfe2c5'
);