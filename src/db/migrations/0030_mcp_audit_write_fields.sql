ALTER TABLE mcp_audit_logs
  ADD COLUMN target_kind TEXT,
  ADD COLUMN target_id TEXT,
  ADD COLUMN confirmed BOOLEAN,
  ADD COLUMN origin TEXT NOT NULL DEFAULT 'mcp';
