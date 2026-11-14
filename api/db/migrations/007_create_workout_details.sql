CREATE TABLE workout_details (
  activity_id     BIGINT PRIMARY KEY REFERENCES activities (id) ON DELETE CASCADE,
  focus           TEXT CHECK (focus IN ('cardio', 'full_body', 'upper_body', 'lower_body',
                                        'hiit', 'strength', 'flexibility', 'mobility', 'yoga')),
  calories_burned INTEGER CHECK (calories_burned >= 0)
);
CREATE TABLE workout_items (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  activity_id BIGINT NOT NULL REFERENCES workout_details (activity_id) ON DELETE CASCADE,
  position    INTEGER NOT NULL CHECK (position >= 0),
  name        TEXT NOT NULL,
  amount      NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  unit        TEXT NOT NULL CHECK (unit IN ('x', 'mins')),
  UNIQUE (activity_id, position)
);
