CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS sponsors (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	name text NOT NULL,
	image_url text NOT NULL,
	blob_pathname text NOT NULL UNIQUE,
	website_url text,
	sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
	active boolean NOT NULL DEFAULT true,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sponsors_public_order_idx
	ON sponsors (active, sort_order, name);
