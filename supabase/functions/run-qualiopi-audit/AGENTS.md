# run-qualiopi-audit

- `run-qualiopi-audit` is scheduled as a Lovable-managed HTTP schedule authenticated by `hasManagedCronCredential` (LOVABLE_CRON_SECRET, any header, constant-time), opt-in per function, because inline cron secrets cannot be written without exposing them.
