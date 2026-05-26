-- Community feature extension: AI hashtags + polls.
-- All learner writes stay on the anon client and are guarded by RLS that checks
-- ownership through get_learner_email() (same invariant as practice_posts).

-- ── practice_post_hashtags ───────────────────────────────────────────────────
create table public.practice_post_hashtags (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references practice_posts(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now()
);

create index practice_post_hashtags_post_idx on practice_post_hashtags (post_id);
create index practice_post_hashtags_tag_idx on practice_post_hashtags (tag);
create unique index practice_post_hashtags_unique on practice_post_hashtags (post_id, tag);

alter table practice_post_hashtags enable row level security;

create policy "auth_manage_practice_hashtags" on practice_post_hashtags
  for all to authenticated using (true) with check (true);

create policy "anon_read_practice_hashtags" on practice_post_hashtags
  for select to anon using (get_learner_email() is not null);

create policy "anon_insert_practice_hashtags" on practice_post_hashtags
  for insert to anon with check (
    exists (select 1 from practice_posts p where p.id = post_id and p.author_email = get_learner_email())
  );

create policy "anon_delete_practice_hashtags" on practice_post_hashtags
  for delete to anon using (
    exists (select 1 from practice_posts p where p.id = post_id and p.author_email = get_learner_email())
  );

-- ── practice_polls ───────────────────────────────────────────────────────────
create table public.practice_polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references practice_posts(id) on delete cascade unique,
  created_at timestamptz not null default now()
);

alter table practice_polls enable row level security;

create policy "auth_manage_practice_polls" on practice_polls
  for all to authenticated using (true) with check (true);

create policy "anon_read_practice_polls" on practice_polls
  for select to anon using (get_learner_email() is not null);

create policy "anon_insert_practice_polls" on practice_polls
  for insert to anon with check (
    exists (select 1 from practice_posts p where p.id = post_id and p.author_email = get_learner_email())
  );

create policy "anon_delete_practice_polls" on practice_polls
  for delete to anon using (
    exists (select 1 from practice_posts p where p.id = post_id and p.author_email = get_learner_email())
  );

-- ── practice_poll_options ────────────────────────────────────────────────────
create table public.practice_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references practice_polls(id) on delete cascade,
  label text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index practice_poll_options_poll_idx on practice_poll_options (poll_id, position);

alter table practice_poll_options enable row level security;

create policy "auth_manage_practice_poll_options" on practice_poll_options
  for all to authenticated using (true) with check (true);

create policy "anon_read_practice_poll_options" on practice_poll_options
  for select to anon using (get_learner_email() is not null);

create policy "anon_insert_practice_poll_options" on practice_poll_options
  for insert to anon with check (
    exists (
      select 1 from practice_polls pl
      join practice_posts p on p.id = pl.post_id
      where pl.id = poll_id and p.author_email = get_learner_email()
    )
  );

-- ── practice_poll_votes ──────────────────────────────────────────────────────
-- Single choice: one vote per learner per poll. Mirrors practice_post_reactions.
create table public.practice_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references practice_polls(id) on delete cascade,
  option_id uuid not null references practice_poll_options(id) on delete cascade,
  author_email text not null,
  created_at timestamptz not null default now(),
  unique (poll_id, author_email)
);

create index practice_poll_votes_poll_idx on practice_poll_votes (poll_id);

alter table practice_poll_votes enable row level security;

create policy "auth_manage_practice_poll_votes" on practice_poll_votes
  for all to authenticated using (true) with check (true);

create policy "anon_read_practice_poll_votes" on practice_poll_votes
  for select to anon using (get_learner_email() is not null);

create policy "anon_insert_practice_poll_votes" on practice_poll_votes
  for insert to anon with check (author_email = get_learner_email());

create policy "anon_update_practice_poll_votes" on practice_poll_votes
  for update to anon using (author_email = get_learner_email()) with check (author_email = get_learner_email());

create policy "anon_delete_practice_poll_votes" on practice_poll_votes
  for delete to anon using (author_email = get_learner_email());

-- ── Popular hashtags RPC ─────────────────────────────────────────────────────
-- Returns the most-used hashtags with their distinct post counts.
create or replace function public.practice_popular_hashtags(p_limit int default 5)
returns table(tag text, post_count bigint)
language sql
stable
security definer
set search_path to 'public'
as $$
  select tag, count(distinct post_id) as post_count
  from practice_post_hashtags
  group by tag
  order by post_count desc, tag asc
  limit greatest(coalesce(p_limit, 5), 0);
$$;

revoke all on function public.practice_popular_hashtags(int) from public;
grant execute on function public.practice_popular_hashtags(int) to anon, authenticated;
