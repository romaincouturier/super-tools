-- Refonte de connexion : l'apprenant est authentifie et n'utilise plus le client
-- anonyme porteur de l'en-tete x-learner-email. Les tables de depots de travaux et
-- de notifications n'avaient que des policies anon : un apprenant connecte ne
-- pouvait plus deposer un exercice ni lire ses notifications.

create policy auth_learner_read_work_deposits
  on public.lms_work_deposits for select to authenticated
  using (
    lower(learner_email) = get_learner_email()
    or (visibility = 'shared' and publication_status = 'published' and lms_learner_is_enrolled(course_id))
  );

create policy auth_learner_insert_work_deposits
  on public.lms_work_deposits for insert to authenticated
  with check (
    lower(learner_email) = get_learner_email()
    and (
      exists (select 1 from public.lms_lessons l where l.id = lms_work_deposits.lesson_id and l.work_deposit_enabled = true)
      or exists (select 1 from public.lms_lesson_blocks b where b.lesson_id = lms_work_deposits.lesson_id and b.type = 'work_deposit' and not b.hidden)
      or exists (select 1 from public.lms_lesson_blocks b where b.lesson_id = lms_work_deposits.lesson_id and b.type = 'exercise' and not b.hidden and (b.content ->> 'work_deposit_enabled')::boolean = true)
    )
    and lms_learner_is_enrolled(course_id)
  );

create policy auth_learner_update_work_deposits
  on public.lms_work_deposits for update to authenticated
  using (lower(learner_email) = get_learner_email())
  with check (lower(learner_email) = get_learner_email());

create policy auth_learner_delete_work_deposits
  on public.lms_work_deposits for delete to authenticated
  using (lower(learner_email) = get_learner_email());

create policy auth_learner_read_deposit_comments
  on public.lms_deposit_comments for select to authenticated
  using (
    status = 'published' and exists (
      select 1 from public.lms_work_deposits d
      where d.id = lms_deposit_comments.deposit_id
        and (lower(d.learner_email) = get_learner_email()
             or (d.visibility = 'shared' and d.publication_status = 'published' and lms_learner_is_enrolled(d.course_id)))
    )
  );

create policy auth_learner_insert_deposit_comments
  on public.lms_deposit_comments for insert to authenticated
  with check (
    lower(author_email) = get_learner_email() and exists (
      select 1 from public.lms_work_deposits d
      where d.id = lms_deposit_comments.deposit_id
        and d.visibility = 'shared' and d.publication_status = 'published'
        and lms_learner_is_enrolled(d.course_id)
    )
  );

create policy auth_learner_update_deposit_comments
  on public.lms_deposit_comments for update to authenticated
  using (lower(author_email) = get_learner_email())
  with check (lower(author_email) = get_learner_email());

create policy auth_learner_delete_deposit_comments
  on public.lms_deposit_comments for delete to authenticated
  using (lower(author_email) = get_learner_email());

create policy auth_learner_read_deposit_reactions
  on public.lms_deposit_reactions for select to authenticated
  using (get_learner_email() is not null);

create policy auth_learner_insert_deposit_reactions
  on public.lms_deposit_reactions for insert to authenticated
  with check (
    lower(author_email) = get_learner_email() and exists (
      select 1 from public.lms_work_deposits d
      where d.id = lms_deposit_reactions.deposit_id
        and d.visibility = 'shared' and d.publication_status = 'published'
        and lms_learner_is_enrolled(d.course_id)
    )
  );

create policy auth_learner_delete_deposit_reactions
  on public.lms_deposit_reactions for delete to authenticated
  using (lower(author_email) = get_learner_email());

create policy auth_learner_read_deposit_feedback
  on public.lms_deposit_feedback for select to authenticated
  using (
    exists (
      select 1 from public.lms_work_deposits d
      where d.id = lms_deposit_feedback.deposit_id
        and (lower(d.learner_email) = get_learner_email()
             or (d.visibility = 'shared' and d.publication_status = 'published' and lms_learner_is_enrolled(d.course_id)))
    )
  );

create policy auth_learner_read_own_learner_notifications
  on public.learner_notifications for select to authenticated
  using (lower(learner_email) = get_learner_email());