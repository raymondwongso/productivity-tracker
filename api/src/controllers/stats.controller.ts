import type { FastifyInstance } from "fastify";
import type { StatsQuery } from "@productivitytracker/shared";
import { authenticate } from "../lib/auth.js";
import type { GetCinemaStatsService } from "../services/get-cinema-stats.service.js";
import type { GetFitnessStatsService } from "../services/get-fitness-stats.service.js";
import type { GetGamingStatsService } from "../services/get-gaming-stats.service.js";
import type { GetSleepStatsService } from "../services/get-sleep-stats.service.js";
import type { GetWorkStatsService } from "../services/get-work-stats.service.js";

interface Deps {
  sleep: Pick<GetSleepStatsService, "execute">;
  fitness: Pick<GetFitnessStatsService, "execute">;
  work: Pick<GetWorkStatsService, "execute">;
  cinema: Pick<GetCinemaStatsService, "execute">;
  gaming: Pick<GetGamingStatsService, "execute">;
}

const day = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } as const;
const querystring = {
  type: "object",
  required: ["from", "to", "tz"],
  properties: { from: day, to: day, tz: { type: "string", minLength: 1, maxLength: 64 } },
} as const;

export function statsController(d: Deps) {
  return async (app: FastifyInstance) => {
    app.addHook("onRequest", authenticate);
    for (const [name, service] of Object.entries(d) as [keyof Deps, Deps[keyof Deps]][]) {
      app.get<{ Querystring: StatsQuery }>(`/stats/${name}`, { schema: { querystring } }, async (request) =>
        service.execute(request.user.id, request.query),
      );
    }
  };
}
