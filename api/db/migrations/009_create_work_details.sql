CREATE TABLE work_details (
  activity_id BIGINT PRIMARY KEY REFERENCES activities (id) ON DELETE CASCADE,
  project_id  BIGINT REFERENCES projects (id) ON DELETE RESTRICT
);
CREATE INDEX work_details_project_id_idx ON work_details (project_id);
