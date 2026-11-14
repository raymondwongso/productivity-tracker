CREATE TABLE meal_details (
  activity_id    BIGINT PRIMARY KEY REFERENCES activities (id) ON DELETE CASCADE,
  total_calories INTEGER CHECK (total_calories >= 0)  -- = SUM(meal_items.calories) when items exist
);
CREATE TABLE meal_items (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  activity_id BIGINT NOT NULL REFERENCES meal_details (activity_id) ON DELETE CASCADE,
  position    INTEGER NOT NULL CHECK (position >= 0),
  name        TEXT NOT NULL,
  calories    INTEGER NOT NULL CHECK (calories >= 0),
  UNIQUE (activity_id, position)
);
