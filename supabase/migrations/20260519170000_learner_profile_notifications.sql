-- Email notification preferences on learner profiles (default all ON)
alter table public.learner_profiles
  add column if not exists email_notif_work_reply  boolean not null default true,
  add column if not exists email_notif_work_comment boolean not null default true,
  add column if not exists email_notif_live         boolean not null default true,
  add column if not exists email_notif_important    boolean not null default true;
