# Architecture
- Company archives tools reuse admin_documents and private storage with caller-scoped admin authorization and insert audit; never update, remove or trigger automatic analysis, because existing versions must remain intact.
- New MCP extensions use SDK-generated transport and managed OAuth with caller-scoped clients; keep the legacy endpoint untouched to preserve existing connections.
- Module reordering and training transcript links use staff-only invoker RPCs with atomic audit logs; never edit lesson content through these tools.
