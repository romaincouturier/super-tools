-- Allow e-learning formations to exist without dates ("formation permanente").
-- start_date and end_date become nullable for asynchronous e-learning.

ALTER TABLE public.trainings ALTER COLUMN start_date DROP NOT NULL;
ALTER TABLE public.trainings ALTER COLUMN end_date DROP NOT NULL;
