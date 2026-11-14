CREATE TABLE titles (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('movie', 'series')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX titles_user_id_kind_name_lower_key ON titles (user_id, kind, lower(name));
