-- ── practice_posts ──────────────────────────────────────────────────────────
create table public.practice_posts (
  id uuid primary key default gen_random_uuid(),
  author_email text not null,
  content text,
  file_url text,
  file_name text,
  file_mime text,
  file_size int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index practice_posts_author_idx on practice_posts (author_email);
create index practice_posts_created_idx on practice_posts (created_at desc);

alter table practice_posts enable row level security;

create policy "auth_manage_practice_posts" on practice_posts
  for all to authenticated using (true) with check (true);

create policy "anon_read_practice_posts" on practice_posts
  for select to anon using (get_learner_email() is not null);

create policy "anon_insert_practice_posts" on practice_posts
  for insert to anon with check (author_email = get_learner_email());

create policy "anon_update_practice_posts" on practice_posts
  for update to anon using (author_email = get_learner_email()) with check (author_email = get_learner_email());

create policy "anon_delete_practice_posts" on practice_posts
  for delete to anon using (author_email = get_learner_email());

-- ── practice_post_reactions ──────────────────────────────────────────────────
create table public.practice_post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references practice_posts(id) on delete cascade,
  author_email text not null,
  created_at timestamptz not null default now(),
  unique (post_id, author_email)
);

create index practice_reactions_post_idx on practice_post_reactions (post_id);

alter table practice_post_reactions enable row level security;

create policy "auth_manage_practice_reactions" on practice_post_reactions
  for all to authenticated using (true) with check (true);

create policy "anon_read_practice_reactions" on practice_post_reactions
  for select to anon using (get_learner_email() is not null);

create policy "anon_insert_practice_reactions" on practice_post_reactions
  for insert to anon with check (author_email = get_learner_email());

create policy "anon_delete_practice_reactions" on practice_post_reactions
  for delete to anon using (author_email = get_learner_email());

-- ── practice_post_comments ───────────────────────────────────────────────────
create table public.practice_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references practice_posts(id) on delete cascade,
  author_email text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index practice_comments_post_idx on practice_post_comments (post_id, created_at);

alter table practice_post_comments enable row level security;

create policy "auth_manage_practice_comments" on practice_post_comments
  for all to authenticated using (true) with check (true);

create policy "anon_read_practice_comments" on practice_post_comments
  for select to anon using (get_learner_email() is not null);

create policy "anon_insert_practice_comments" on practice_post_comments
  for insert to anon with check (author_email = get_learner_email());

create policy "anon_update_practice_comments" on practice_post_comments
  for update to anon using (author_email = get_learner_email()) with check (author_email = get_learner_email());

create policy "anon_delete_practice_comments" on practice_post_comments
  for delete to anon using (author_email = get_learner_email());
