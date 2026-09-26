CREATE TABLE oauth_clients (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL UNIQUE, client_secret TEXT, client_discovery_id TEXT,
  disabled BOOLEAN NOT NULL DEFAULT false, skip_consent BOOLEAN, enable_end_session BOOLEAN, subject_type TEXT,
  scopes TEXT[], client_credentials_scopes TEXT[] NOT NULL DEFAULT '{}', user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), name TEXT, uri TEXT, icon TEXT,
  contacts TEXT[], tos TEXT, policy TEXT, software_id TEXT, software_version TEXT, software_statement TEXT,
  redirect_uris TEXT[] NOT NULL, post_logout_redirect_uris TEXT[], backchannel_logout_uri TEXT,
  backchannel_logout_session_required BOOLEAN, token_endpoint_auth_method TEXT, application_type TEXT,
  jwks TEXT, jwks_uri TEXT, grant_types TEXT[], response_types TEXT[], require_pkce BOOLEAN,
  dpop_bound_access_tokens BOOLEAN NOT NULL DEFAULT false, reference_id TEXT, metadata JSONB
);
CREATE INDEX oauth_clients_user_id ON oauth_clients(user_id);

CREATE TABLE oauth_resources (
  id TEXT PRIMARY KEY, identifier TEXT NOT NULL UNIQUE, name TEXT NOT NULL, access_token_ttl INTEGER, refresh_token_ttl INTEGER,
  signing_algorithm TEXT, signing_key_id TEXT, allowed_scopes TEXT[], custom_claims JSONB,
  dpop_bound_access_tokens_required BOOLEAN NOT NULL DEFAULT false, disabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  policy_version INTEGER NOT NULL DEFAULT 1, metadata JSONB
);

CREATE TABLE oauth_client_resources (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  resource_id TEXT NOT NULL REFERENCES oauth_resources(identifier) ON DELETE CASCADE, metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(client_id, resource_id)
);
CREATE INDEX oauth_client_resources_client_id ON oauth_client_resources(client_id);
CREATE INDEX oauth_client_resources_resource_id ON oauth_client_resources(resource_id);

CREATE TABLE oauth_refresh_tokens (
  id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reference_id TEXT, authorization_code_id TEXT, resources TEXT[], requested_user_info_claims TEXT[],
  expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), revoked TIMESTAMPTZ, rotated_at TIMESTAMPTZ,
  rotation_replay_response TEXT, rotation_replay_expires_at TIMESTAMPTZ, auth_time TIMESTAMPTZ, confirmation JSONB, scopes TEXT[] NOT NULL
);
CREATE INDEX oauth_refresh_tokens_client_id ON oauth_refresh_tokens(client_id);
CREATE INDEX oauth_refresh_tokens_user_id ON oauth_refresh_tokens(user_id);

CREATE TABLE oauth_access_tokens (
  id TEXT PRIMARY KEY, token TEXT UNIQUE, client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL, user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  reference_id TEXT, authorization_code_id TEXT, resources TEXT[], requested_user_info_claims TEXT[],
  refresh_id TEXT REFERENCES oauth_refresh_tokens(id) ON DELETE CASCADE, expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), revoked TIMESTAMPTZ, confirmation JSONB, scopes TEXT[] NOT NULL
);
CREATE INDEX oauth_access_tokens_client_id ON oauth_access_tokens(client_id);
CREATE INDEX oauth_access_tokens_user_id ON oauth_access_tokens(user_id);

CREATE TABLE oauth_consents (
  id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE, reference_id TEXT, resources TEXT[], requested_user_info_claims TEXT[],
  scopes TEXT[] NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX oauth_consents_client_id ON oauth_consents(client_id);
CREATE INDEX oauth_consents_user_id ON oauth_consents(user_id);

CREATE TABLE oauth_client_assertions (id TEXT PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL);
