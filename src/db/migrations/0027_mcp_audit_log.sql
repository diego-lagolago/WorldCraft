CREATE TABLE mcp_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  tool_name TEXT NOT NULL,
  world_id UUID REFERENCES worlds(id) ON DELETE SET NULL,
  duration_ms INTEGER NOT NULL,
  result TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX mcp_audit_logs_created_at ON mcp_audit_logs(created_at);
CREATE INDEX mcp_audit_logs_user_created ON mcp_audit_logs(user_id, created_at);
