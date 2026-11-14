-- Global. Read by the API whenever it writes labels; changing a value never relabels existing rows.
CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       INTEGER NOT NULL CHECK (value >= 0),
  description TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO settings (key, value, description) VALUES
  ('graceful_late_period',      10, 'Minutes after planned start before an activity is late'),
  ('graceful_premature_period', 15, 'Minutes before planned end that count as ending early'),
  ('graceful_overrun_period',   15, 'Minutes after planned end before an activity overruns');
