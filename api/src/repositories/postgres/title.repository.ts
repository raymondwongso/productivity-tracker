import type { Pool } from "pg";
import type { Title, TitleKind } from "@productivitytracker/shared";

interface TitleRow {
  id: number;
  name: string;
  kind: TitleKind;
}

const toTitle = (r: TitleRow): Title => ({ id: r.id, name: r.name, kind: r.kind });

export class TitleRepository {
  constructor(private readonly pool: Pool) {}

  async list(userId: number): Promise<Title[]> {
    const { rows } = await this.pool.query<TitleRow>(
      "SELECT id, name, kind FROM titles WHERE user_id = $1 ORDER BY lower(name), id",
      [userId],
    );
    return rows.map(toTitle);
  }

  async findByIdForUser(id: number, userId: number): Promise<Title | null> {
    const { rows } = await this.pool.query<TitleRow>(
      "SELECT id, name, kind FROM titles WHERE id = $1 AND user_id = $2",
      [id, userId],
    );
    return rows[0] ? toTitle(rows[0]) : null;
  }

  async findByName(userId: number, kind: TitleKind, name: string): Promise<Title | null> {
    const { rows } = await this.pool.query<TitleRow>(
      "SELECT id, name, kind FROM titles WHERE user_id = $1 AND kind = $2 AND lower(name) = lower($3)",
      [userId, kind, name],
    );
    return rows[0] ? toTitle(rows[0]) : null;
  }

  async create(userId: number, kind: TitleKind, name: string): Promise<Title> {
    const { rows } = await this.pool.query<TitleRow>(
      "INSERT INTO titles (user_id, kind, name) VALUES ($1, $2, $3) RETURNING id, name, kind",
      [userId, kind, name],
    );
    return toTitle(rows[0]!);
  }
}
