import type { Pool } from "pg";
import type { Game } from "@productivitytracker/shared";

interface GameRow {
  id: number;
  name: string;
}

const toGame = (r: GameRow): Game => ({ id: r.id, name: r.name });

export class GameRepository {
  constructor(private readonly pool: Pool) {}

  async list(userId: number): Promise<Game[]> {
    const { rows } = await this.pool.query<GameRow>("SELECT id, name FROM games WHERE user_id = $1 ORDER BY lower(name), id", [userId]);
    return rows.map(toGame);
  }

  async findByIdForUser(id: number, userId: number): Promise<Game | null> {
    const { rows } = await this.pool.query<GameRow>("SELECT id, name FROM games WHERE id = $1 AND user_id = $2", [id, userId]);
    return rows[0] ? toGame(rows[0]) : null;
  }

  async findByName(userId: number, name: string): Promise<Game | null> {
    const { rows } = await this.pool.query<GameRow>(
      "SELECT id, name FROM games WHERE user_id = $1 AND lower(name) = lower($2)",
      [userId, name],
    );
    return rows[0] ? toGame(rows[0]) : null;
  }

  async create(userId: number, name: string): Promise<Game> {
    const { rows } = await this.pool.query<GameRow>("INSERT INTO games (user_id, name) VALUES ($1, $2) RETURNING id, name", [userId, name]);
    return toGame(rows[0]!);
  }
}
