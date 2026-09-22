ALTER TABLE sponsors
	ADD COLUMN IF NOT EXISTS sync_source_key text,
	ADD COLUMN IF NOT EXISTS sync_source_image_url text,
	ADD COLUMN IF NOT EXISTS sync_present boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS sponsors_sync_source_key_idx
	ON sponsors (sync_source_key)
	WHERE sync_source_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS sponsor_sync_settings (
	id text PRIMARY KEY CHECK (id = 'club-site'),
	enabled boolean NOT NULL DEFAULT false,
	last_attempt_at timestamptz,
	last_success_at timestamptz,
	last_error text,
	last_stats jsonb,
	updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO sponsor_sync_settings (id)
VALUES ('club-site')
ON CONFLICT (id) DO NOTHING;
