import type { CreateGameRequest, Game } from "@productivitytracker/shared";
import { badRequest } from "../errors.js";
import { NAME_MAX_LENGTH } from "../lib/activities.js";
import type { GameRepository } from "../repositories/postgres/game.repository.js";

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";

/** Get-or-create by name, case-insensitive. */
export class CreateGameService {
  constructor(private readonly games: Pick<GameRepository, "findByName" | "create">) {}

  async execute(userId: number, req: CreateGameRequest): Promise<Game> {
    const name = req.name.trim();
    if (!name) throw badRequest("Game name is required");
    if (name.length > NAME_MAX_LENGTH) throw badRequest(`Game name must be at most ${NAME_MAX_LENGTH} characters`);
    const existing = await this.games.findByName(userId, name);
    if (existing) return existing;
    return this.games.create(userId, name).catch(async (err: unknown) => {
      const raced = isUniqueViolation(err) ? await this.games.findByName(userId, name) : null;
      if (raced) return raced;
      throw err;
    });
  }
}
