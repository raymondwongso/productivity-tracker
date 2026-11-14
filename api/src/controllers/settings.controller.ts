import type { FastifyInstance } from "fastify";
import { authenticate } from "../lib/auth.js";
import type { GetGracePeriodsService } from "../services/get-grace-periods.service.js";

export function settingsController({ getGracePeriods }: { getGracePeriods: Pick<GetGracePeriodsService, "execute"> }) {
  return async (app: FastifyInstance) => {
    app.addHook("onRequest", authenticate);
    app.get("/settings/grace-periods", async () => getGracePeriods.execute());
  };
}
