import type { Game } from "@productivitytracker/shared";
import type { GameRepository } from "../repositories/postgres/game.repository.js";

export class ListGamesService {
  constructor(private readonly games: Pick<GameRepository, "list">) {}

  execute(userId: number): Promise<Game[]> {
    return this.games.list(userId);
  }
}
