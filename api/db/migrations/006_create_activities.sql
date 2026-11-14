CREATE TABLE activities (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id       BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  category_id   BIGINT NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  name          TEXT NOT NULL CHECK (length(trim(name)) > 0),
  planned_start TIMESTAMPTZ NOT NULL,
  planned_end   TIMESTAMPTZ NOT NULL,
  actual_start  TIMESTAMPTZ,
  actual_end    TIMESTAMPTZ,
  notes         TEXT NOT NULL DEFAULT '',          -- sanitized HTML
  cancelled_at  TIMESTAMPTZ,
  labels        TEXT[] NOT NULL,                   -- no default: the API always writes it
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT activities_planned_order CHECK (planned_end > planned_start),
  CONSTRAINT activities_planned_max_24h CHECK (planned_end <= planned_start + interval '24 hours'),
  CONSTRAINT activities_actual_order CHECK (
    actual_end IS NULL OR (actual_start IS NOT NULL AND actual_end > actual_start)),

  -- the nine label sets computeLabels can produce, in canonical order
  CONSTRAINT activities_labels_valid CHECK (labels IN (
    '{}', '{pending}', '{cancelled}', '{done}', '{late}', '{premature}', '{overrun}',
    '{late,premature}', '{late,overrun}')),
  CONSTRAINT activities_labels_cancelled CHECK (
    (cancelled_at IS NOT NULL) = (labels = '{cancelled}')),
  CONSTRAINT activities_labels_pending CHECK (
    (cancelled_at IS NULL AND actual_start IS NULL) = (labels = '{pending}')),
  CONSTRAINT activities_labels_end_needs_end CHECK (
    NOT (labels && '{done,premature,overrun}') OR actual_end IS NOT NULL),
  CONSTRAINT activities_labels_finished CHECK (
    cancelled_at IS NOT NULL OR actual_end IS NULL OR labels && '{done,premature,overrun}')
);
-- calendar: planned_start >= $from - interval '24 hours' AND planned_start < $to AND planned_end > $from
CREATE INDEX activities_user_id_planned_start_idx ON activities (user_id, planned_start);
-- tracker pages: one category over time
CREATE INDEX activities_user_id_category_id_planned_start_idx ON activities (user_id, category_id, planned_start);
CREATE INDEX activities_category_id_idx ON activities (category_id);
-- label filters and counts: WHERE labels @> '{late}'
CREATE INDEX activities_labels_idx ON activities USING GIN (labels);
