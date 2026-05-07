-- Create training_venues table
create table if not exists public.training_venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  postal_code text not null,
  city text not null,
  email text not null,
  room_name text,
  formal_address boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.training_venues enable row level security;

create policy "Authenticated users can manage venues"
  on public.training_venues
  for all
  to authenticated
  using (true)
  with check (true);

-- Add venue_id and venue_booking_sent_at to trainings
alter table public.trainings
  add column if not exists venue_id uuid references public.training_venues(id) on delete set null,
  add column if not exists venue_booking_sent_at timestamptz;
