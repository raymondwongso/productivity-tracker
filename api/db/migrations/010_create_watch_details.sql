CREATE TABLE watch_details (
  activity_id BIGINT PRIMARY KEY REFERENCES activities (id) ON DELETE CASCADE,
  title_id    BIGINT REFERENCES titles (id) ON DELETE RESTRICT
);
CREATE INDEX watch_details_title_id_idx ON watch_details (title_id);
