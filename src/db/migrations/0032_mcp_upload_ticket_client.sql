ALTER TABLE mcp_upload_tickets ADD COLUMN client_id TEXT;

-- Tickets created before client binding cannot safely survive an application revoke.
DELETE FROM mcp_upload_tickets;

ALTER TABLE mcp_upload_tickets ALTER COLUMN client_id SET NOT NULL;
CREATE INDEX mcp_upload_tickets_user_client ON mcp_upload_tickets(user_id, client_id);
