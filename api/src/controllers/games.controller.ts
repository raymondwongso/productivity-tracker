import type { FastifyInstance } from "fastify";
import type { CreateGameRequest } from "@productivitytracker/shared";
import { authenticate } from "../lib/auth.js";
import type { CreateGameService } from "../services/create-game.service.js";
import type { ListGamesService } from "../services/list-games.service.js";
import { str } from "./schemas.js";

interface Deps {
  listGames: Pick<ListGamesService, "execute">;
  createGame: Pick<CreateGameService, "execute">;
}

export function gamesController({ listGames, createGame }: Deps) {
  return async (app: FastifyInstance) => {
    app.addHook("onRequest", authenticate);

    app.get("/games", async (request) => listGames.execute(request.user.id));

    app.post<{ Body: CreateGameRequest }>(
      "/games",
      { schema: { body: { type: "object", required: ["name"], properties: { name: str(200) } } } },
      async (request, reply) => reply.code(201).send(await createGame.execute(request.user.id, request.body)),
    );
  };
}
