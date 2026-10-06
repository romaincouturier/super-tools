# Architecture rules

- Preparation-questionnaire reminder templates use `{{questionnaire_link}}` as a protected CTA placeholder, rendered server-side as an email-safe button plus fallback link, because editable templates must not inject arbitrary HTML.
- Evaluation templates must never contain Google Forms URLs; participant and sponsor links are tokenized SuperTools URLs generated at send time, because external forms bypass evaluation tracking.- Storage backup is an incremental Drive mirror driven by `backup_storage_manifest` (one row per copied file, checkpoint for resume); DB and storage have separate statuses on `backup_runs`, and the "no backup" alert reads `db_status` only, because a full storage copy no longer fits in one cron window.
