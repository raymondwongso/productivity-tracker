import type { FastifyInstance } from "fastify";
import type { CreateActivitySeriesRequest } from "@productivitytracker/shared";
import { MAX_REPEAT_EVERY } from "@productivitytracker/shared";
import { authenticate } from "../lib/auth.js";
import type { CreateActivitySeriesService } from "../services/create-activity-series.service.js";
import type { GetActivitySeriesService } from "../services/get-activity-series.service.js";
import { activityProperties, CATEGORY_SLUGS } from "./activities.controller.js";
import { idParams } from "./schemas.js";

interface Deps {
  createActivitySeries: Pick<CreateActivitySeriesService, "execute">;
  getActivitySeries: Pick<GetActivitySeriesService, "execute">;
}

const repeatSchema = {
  type: "object",
  required: ["frequency", "every", "weekdays", "until", "timeZone"],
  properties: {
    frequency: { type: "string", enum: ["daily", "weekly"] },
    every: { type: "integer", minimum: 1, maximum: MAX_REPEAT_EVERY },
    weekdays: { type: ["array", "null"], maxItems: 7, items: { type: "integer", minimum: 1, maximum: 7 } },
    until: { type: "string", format: "date" },
    timeZone: { type: "string", minLength: 1, maxLength: 64 },
  },
} as const;

export function activitySeriesController(d: Deps) {
  return async (app: FastifyInstance) => {
    app.addHook("onRequest", authenticate);

    app.post<{ Body: CreateActivitySeriesRequest }>(
      "/activity-series",
      {
        schema: {
          body: {
            type: "object",
            required: ["category", "name", "plannedStart", "plannedEnd", "repeat"],
            properties: { category: { type: "string", enum: CATEGORY_SLUGS }, ...activityProperties, repeat: repeatSchema },
          },
        },
      },
      async (request, reply) => reply.code(201).send(await d.createActivitySeries.execute(request.user.id, request.body)),
    );

    app.get<{ Params: { id: number } }>("/activity-series/:id", { schema: { params: idParams } }, async (request) =>
      d.getActivitySeries.execute(request.user.id, request.params.id),
    );
  };
}
