UPDATE transcripts
SET status='error', error_message='retry-after-fanout-fix', assemblyai_id=NULL, updated_at=now()
WHERE id IN ('0b0e52d7-9a0c-45a8-a11c-239c9f4a5f26','f30b41f5-0336-4f43-82db-2fa9df93494a');