-- ============================================================
-- RECALL — Aurora PostgreSQL Schema with pgvector
-- Run: psql $DATABASE_URL -f schema.sql
-- ============================================================

-- Enable pgvector extension (available in Aurora PostgreSQL 15.3+)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- AUTH — NextAuth users, OAuth accounts, sessions, verification
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name text,
  email text UNIQUE,
  "emailVerified" timestamptz,
  image text,
  password text,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS accounts (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  provider text NOT NULL,
  "providerAccountId" text NOT NULL,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  PRIMARY KEY (id),
  UNIQUE (provider, "providerAccountId")
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  "userId" uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires timestamptz NOT NULL,
  "sessionToken" text NOT NULL UNIQUE,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS verification_token (
  identifier text NOT NULL,
  expires timestamptz NOT NULL,
  token text NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- ============================================================
-- WORKSPACES — Team collaboration spaces
-- ============================================================
CREATE TABLE IF NOT EXISTS workspaces (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTES — Core knowledge units with vector embeddings
-- ============================================================
CREATE TABLE IF NOT EXISTS notes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  -- AI-generated fields
  tags            TEXT[]   DEFAULT '{}',
  summary         TEXT,                         -- AI-generated one-liner
  key_concepts    TEXT[]   DEFAULT '{}',        -- extracted concepts
  -- pgvector: 384-dim Xenova text embeddings
  embedding       vector(384),
  -- metadata
  source          TEXT,                         -- 'manual', 'import', 'meeting', etc.
  metadata        JSONB    DEFAULT '{}',
  is_pinned       BOOLEAN  DEFAULT FALSE,
  view_count      INTEGER  DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for ultra-fast approximate nearest neighbor search
-- m=16: graph connectivity; ef_construction=64: build quality
CREATE INDEX IF NOT EXISTS notes_embedding_hnsw_idx
  ON notes USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Standard indexes for common queries
CREATE INDEX IF NOT EXISTS notes_workspace_id_idx ON notes (workspace_id);
CREATE INDEX IF NOT EXISTS notes_created_at_idx   ON notes (created_at DESC);
CREATE INDEX IF NOT EXISTS notes_tags_idx         ON notes USING gin (tags);

-- ============================================================
-- NOTE CONNECTIONS — AI-discovered relationships between notes
-- ============================================================
CREATE TABLE IF NOT EXISTS note_connections (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_note_id      UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  to_note_id        UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  similarity_score  FLOAT NOT NULL CHECK (similarity_score BETWEEN 0 AND 1),
  connection_type   TEXT DEFAULT 'semantic',    -- 'semantic', 'temporal', 'ai_discovered'
  connection_reason TEXT,                       -- Claude's explanation of the link
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(from_note_id, to_note_id),
  CHECK (from_note_id != to_note_id)
);

CREATE INDEX IF NOT EXISTS note_connections_from_idx ON note_connections (from_note_id);
CREATE INDEX IF NOT EXISTS note_connections_to_idx   ON note_connections (to_note_id);

-- ============================================================
-- QA HISTORY — Track AI Q&A sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS qa_history (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  question        TEXT NOT NULL,
  answer          TEXT NOT NULL,
  source_note_ids UUID[] DEFAULT '{}',          -- notes used to generate the answer
  confidence      TEXT DEFAULT 'medium',        -- 'high', 'medium', 'low'
  tokens_used     INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qa_history_workspace_idx ON qa_history (workspace_id);
CREATE INDEX IF NOT EXISTS qa_history_created_idx   ON qa_history (created_at DESC);

-- ============================================================
-- VIEWS — Useful aggregations for the dashboard
-- ============================================================

-- Note with connection count
CREATE OR REPLACE VIEW notes_with_stats AS
SELECT
  n.*,
  COUNT(DISTINCT nc.to_note_id)::INT AS connection_count
FROM notes n
LEFT JOIN note_connections nc ON nc.from_note_id = n.id
GROUP BY n.id;

-- ============================================================
-- FUNCTIONS — Semantic search with configurable threshold
-- ============================================================
CREATE OR REPLACE FUNCTION search_notes(
  query_embedding vector(1536),
  workspace_uuid  UUID,
  match_threshold FLOAT DEFAULT 0.3,
  match_count     INT   DEFAULT 10
)
RETURNS TABLE (
  id               UUID,
  title            TEXT,
  content          TEXT,
  tags             TEXT[],
  summary          TEXT,
  similarity       FLOAT,
  created_at       TIMESTAMPTZ
)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    n.id,
    n.title,
    n.content,
    n.tags,
    n.summary,
    1 - (n.embedding <=> query_embedding) AS similarity,
    n.created_at
  FROM notes n
  WHERE
    n.workspace_id = workspace_uuid
    AND n.embedding IS NOT NULL
    AND 1 - (n.embedding <=> query_embedding) > match_threshold
  ORDER BY n.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ============================================================
-- SEED DATA — Demo workspace so app works immediately
-- ============================================================
INSERT INTO workspaces (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'My Workspace', 'my-workspace')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- Update trigger for updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
