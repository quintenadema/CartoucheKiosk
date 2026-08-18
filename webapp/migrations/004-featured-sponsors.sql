ALTER TABLE sponsors
	ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
	ADD COLUMN IF NOT EXISTS featured_image_url text,
	ADD COLUMN IF NOT EXISTS featured_blob_pathname text;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'sponsors_featured_image_required'
	) THEN
		ALTER TABLE sponsors
			ADD CONSTRAINT sponsors_featured_image_required
			CHECK (
				featured = false
				OR (featured_image_url IS NOT NULL AND featured_blob_pathname IS NOT NULL)
			);
	END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS sponsors_featured_blob_pathname_idx
	ON sponsors (featured_blob_pathname)
	WHERE featured_blob_pathname IS NOT NULL;

CREATE INDEX IF NOT EXISTS sponsors_featured_order_idx
	ON sponsors (sort_order, name)
	WHERE active = true AND featured = true;
