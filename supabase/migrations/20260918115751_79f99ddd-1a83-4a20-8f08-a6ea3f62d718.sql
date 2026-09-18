create policy auth_learner_read_user_badges
  on public.lms_user_badges for select to authenticated
  using (lower(learner_email) = get_learner_email());

create policy auth_learner_insert_own_lms_messages
  on public.lms_messages for insert to authenticated
  with check (lower(learner_email) = get_learner_email());