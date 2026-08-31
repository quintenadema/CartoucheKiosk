CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS training_sessions (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	source_key text UNIQUE,
	season_label text NOT NULL DEFAULT '2026-2027',
	day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
	field_name text NOT NULL,
	field_area text NOT NULL DEFAULT 'Volledig',
	title text NOT NULL,
	start_time time NOT NULL,
	end_time time NOT NULL,
	valid_from date NOT NULL DEFAULT DATE '2026-07-06',
	valid_until date NOT NULL DEFAULT DATE '2027-07-04',
	notes text,
	active boolean NOT NULL DEFAULT true,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now(),
	CHECK (end_time > start_time),
	CHECK (valid_until >= valid_from)
);

CREATE INDEX IF NOT EXISTS training_sessions_public_schedule_idx
	ON training_sessions (active, day_of_week, start_time, field_name);

CREATE INDEX IF NOT EXISTS training_sessions_admin_schedule_idx
	ON training_sessions (day_of_week, field_name, start_time);
