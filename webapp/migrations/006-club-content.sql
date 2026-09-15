CREATE TABLE IF NOT EXISTS kiosk_club_content (
  id text PRIMARY KEY CHECK (id = 'club'),
  payload jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
