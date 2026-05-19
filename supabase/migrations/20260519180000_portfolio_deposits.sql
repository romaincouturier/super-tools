-- Allow portfolio (free-form) deposits not tied to a specific lesson or course
alter table lms_work_deposits
  alter column lesson_id drop not null,
  alter column course_id drop not null;
