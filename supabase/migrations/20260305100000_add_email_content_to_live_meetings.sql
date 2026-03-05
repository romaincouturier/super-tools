-- Add configurable email content for live meeting reminders
ALTER TABLE training_live_meetings
ADD COLUMN email_content TEXT;
