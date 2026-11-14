CREATE TABLE categories (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,                 -- the code switches on this
  name       TEXT NOT NULL,
  color      TEXT NOT NULL CHECK (color ~ '^#[0-9a-f]{6}$'),
  sort_order INTEGER NOT NULL DEFAULT 0
);
INSERT INTO categories (slug, name, color, sort_order) VALUES
  ('sleep',   'Sleep',   '#9dcffa', 1),
  ('work',    'Work',    '#b67747', 2),
  ('workout', 'Workout', '#e0d00d', 3),
  ('meals',   'Meals',   '#02a193', 4),
  ('watch',   'Watch',   '#9d82e1', 5);
