-- A finished activity that started late but ended on time is labeled {late} alone (see computeLabels).
-- 006 wrongly required done, premature or overrun on every finished row; only the empty set is impossible.
ALTER TABLE activities
  DROP CONSTRAINT activities_labels_finished,
  ADD CONSTRAINT activities_labels_finished CHECK (
    cancelled_at IS NOT NULL OR actual_end IS NULL OR labels <> '{}');
