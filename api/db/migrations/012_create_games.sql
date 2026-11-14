CREATE TABLE games (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    BIGINT NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX games_user_id_name_lower_key ON games (user_id, lower(name));

CREATE TABLE gaming_details (
  activity_id BIGINT PRIMARY KEY REFERENCES activities (id) ON DELETE CASCADE,
  game_id     BIGINT REFERENCES games (id) ON DELETE RESTRICT
);
CREATE INDEX gaming_details_game_id_idx ON gaming_details (game_id);
