CREATE TABLE projects (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  name       TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'on_hold', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX projects_user_id_name_lower_key ON projects (user_id, lower(name));
