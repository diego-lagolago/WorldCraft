-- Existing DCR/CIMD clients registered before worlds:write must be allowed to
-- request it, otherwise authorize rejects the expanded MCP scope.
UPDATE oauth_clients
SET scopes = CASE
  WHEN scopes IS NULL THEN ARRAY['worlds:read', 'worlds:write', 'offline_access']::text[]
  WHEN NOT ('worlds:write' = ANY (scopes)) THEN scopes || ARRAY['worlds:write']::text[]
  ELSE scopes
END,
updated_at = now()
WHERE scopes IS NULL OR NOT ('worlds:write' = ANY (scopes));
