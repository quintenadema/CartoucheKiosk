CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS spotlights (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	title text NOT NULL,
	image_url text NOT NULL,
	blob_pathname text NOT NULL UNIQUE,
	sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
	active boolean NOT NULL DEFAULT true,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS spotlights_public_order_idx
	ON spotlights (active, sort_order, title);
