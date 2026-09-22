CREATE TABLE IF NOT EXISTS sponsor_source_snapshot (
 id text PRIMARY KEY CHECK (id = 'club-site'),
 html text NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
