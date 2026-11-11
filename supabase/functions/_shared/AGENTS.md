# Architecture
- Attestation rules live in execution-attestation.ts and in a DB trigger (edits draft sent ones, signed frozen, token hashes only), to keep signed content provable.
- Project action assignments use project-assignee.ts in UI, MCP, daily generation and completion checks; profile emails are service-role aliases and unknown/ambiguous values explicitly target creator plus admins, because label-only matching silently routed email assignments to creators.
