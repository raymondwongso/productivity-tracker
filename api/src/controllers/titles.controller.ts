import type { FastifyInstance } from "fastify";
import type { CreateTitleRequest } from "@productivitytracker/shared";
import { authenticate } from "../lib/auth.js";
import type { CreateTitleService } from "../services/create-title.service.js";
import type { ListTitlesService } from "../services/list-titles.service.js";
import { str } from "./schemas.js";

interface Deps {
  listTitles: Pick<ListTitlesService, "execute">;
  createTitle: Pick<CreateTitleService, "execute">;
}

export function titlesController({ listTitles, createTitle }: Deps) {
  return async (app: FastifyInstance) => {
    app.addHook("onRequest", authenticate);

    app.get("/titles", async (request) => listTitles.execute(request.user.id));

    app.post<{ Body: CreateTitleRequest }>(
      "/titles",
      {
        schema: {
          body: {
            type: "object",
            required: ["name", "kind"],
            properties: { name: str(200), kind: { type: "string", enum: ["movie", "series"] } },
          },
        },
      },
      async (request, reply) => reply.code(201).send(await createTitle.execute(request.user.id, request.body)),
    );
  };
}
