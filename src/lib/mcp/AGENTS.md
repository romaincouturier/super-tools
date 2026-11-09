# Architecture
- New MCP extensions use SDK-generated transport and managed OAuth with caller-scoped clients; keep the legacy endpoint untouched to preserve existing connections.
- Module reordering and training transcript links use staff-only invoker RPCs with atomic audit logs; never edit lesson content through these tools.
