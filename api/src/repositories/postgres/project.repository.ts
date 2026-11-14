import type { Pool } from "pg";
import type { Project, ProjectStatus } from "@productivitytracker/shared";

interface ProjectRow {
  id: number;
  name: string;
  status: ProjectStatus;
}

const toProject = (r: ProjectRow): Project => ({ id: r.id, name: r.name, status: r.status });

export class ProjectRepository {
  constructor(private readonly pool: Pool) {}

  async list(userId: number, status: ProjectStatus | null): Promise<Project[]> {
    const { rows } = await this.pool.query<ProjectRow>(
      `SELECT id, name, status FROM projects
       WHERE user_id = $1 AND ($2::text IS NULL OR status = $2)
       ORDER BY lower(name), id`,
      [userId, status],
    );
    return rows.map(toProject);
  }

  async findByIdForUser(id: number, userId: number): Promise<Project | null> {
    const { rows } = await this.pool.query<ProjectRow>(
      "SELECT id, name, status FROM projects WHERE id = $1 AND user_id = $2",
      [id, userId],
    );
    return rows[0] ? toProject(rows[0]) : null;
  }

  async findByName(userId: number, name: string): Promise<Project | null> {
    const { rows } = await this.pool.query<ProjectRow>(
      "SELECT id, name, status FROM projects WHERE user_id = $1 AND lower(name) = lower($2)",
      [userId, name],
    );
    return rows[0] ? toProject(rows[0]) : null;
  }

  async create(userId: number, name: string): Promise<Project> {
    const { rows } = await this.pool.query<ProjectRow>(
      "INSERT INTO projects (user_id, name) VALUES ($1, $2) RETURNING id, name, status",
      [userId, name],
    );
    return toProject(rows[0]!);
  }
}
