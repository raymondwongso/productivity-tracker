-- Recurring activities. A series is stored as one real activity row per occurrence (created up
-- front, so stored labels, stats and the calendar query work unchanged); this table keeps only
-- the rule, to group the occurrences and describe them. A series runs for at most one month.
CREATE TABLE activity_series (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  category_id BIGINT NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  frequency   TEXT NOT NULL,
  every_n     SMALLINT NOT NULL,
  weekdays    SMALLINT[],                 -- ISO 1 = Mon … 7 = Sun; weekly only
  starts_on   DATE NOT NULL,              -- local date of the first occurrence
  ends_on     DATE NOT NULL,              -- inclusive, local
  time_zone   TEXT NOT NULL,              -- IANA zone the occurrences keep their local times in
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT activity_series_frequency CHECK (frequency IN ('daily', 'weekly')),
  CONSTRAINT activity_series_every_n CHECK (every_n BETWEEN 1 AND 30),
  CONSTRAINT activity_series_weekdays CHECK (
    (frequency = 'daily' AND weekdays IS NULL) OR
    (frequency = 'weekly' AND cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ '{1,2,3,4,5,6,7}')),
  CONSTRAINT activity_series_range CHECK (ends_on >= starts_on AND ends_on <= starts_on + interval '1 month')
);
CREATE INDEX activity_series_user_id_idx ON activity_series (user_id);

-- Existing activities are one-offs: NULL, nothing to backfill, labels untouched.
ALTER TABLE activities ADD COLUMN series_id BIGINT REFERENCES activity_series (id) ON DELETE SET NULL;
-- "this and following": one series from a planned start on
CREATE INDEX activities_series_id_planned_start_idx ON activities (series_id, planned_start);
