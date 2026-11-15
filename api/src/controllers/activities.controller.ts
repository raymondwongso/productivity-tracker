import type { FastifyInstance } from "fastify";
import type { CategorySlug, CreateActivityRequest, UpdateActivityRequest } from "@productivitytracker/shared";
import { authenticate } from "../lib/auth.js";
import { WORKOUT_FOCUSES } from "../lib/activities.js";
import type { CancelActivityService } from "../services/cancel-activity.service.js";
import type { CreateActivityService } from "../services/create-activity.service.js";
import type { DeleteActivityService } from "../services/delete-activity.service.js";
import type { GetActivityService } from "../services/get-activity.service.js";
import type { ListActivitiesService } from "../services/list-activities.service.js";
import type { RestoreActivityService } from "../services/restore-activity.service.js";
import type { UpdateActivityService } from "../services/update-activity.service.js";
import { idParams, str } from "./schemas.js";

interface Deps {
  listActivities: Pick<ListActivitiesService, "execute">;
  getActivity: Pick<GetActivityService, "execute">;
  createActivity: Pick<CreateActivityService, "execute">;
  updateActivity: Pick<UpdateActivityService, "execute">;
  deleteActivity: Pick<DeleteActivityService, "execute">;
  cancelActivity: Pick<CancelActivityService, "execute">;
  restoreActivity: Pick<RestoreActivityService, "execute">;
}

const isoTime = { type: "string", format: "date-time" } as const;
const isoTimeOrNull = { type: ["string", "null"], format: "date-time" } as const;
export const CATEGORY_SLUGS: readonly CategorySlug[] = ["sleep", "work", "workout", "meals", "watch", "gaming", "misc"];
const caloriesOrNull = { type: ["integer", "null"], minimum: 0, maximum: 100000 } as const;

/** Fields any category may send; the service rejects the ones that don't apply. */
const activityProperties = {
  name: str(200),
  plannedStart: isoTime,
  plannedEnd: isoTime,
  actualStart: isoTimeOrNull,
  actualEnd: isoTimeOrNull,
  notes: { type: "string", maxLength: 50000 },
  focus: { type: ["string", "null"], enum: [...WORKOUT_FOCUSES, null] },
  caloriesBurned: caloriesOrNull,
  totalCalories: caloriesOrNull,
  projectId: { type: ["integer", "null"], minimum: 1 },
  titleId: { type: ["integer", "null"], minimum: 1 },
  gameId: { type: ["integer", "null"], minimum: 1 },
  items: {
    type: "array",
    maxItems: 50,
    items: {
      type: "object",
      required: ["name"],
      properties: {
        name: str(200),
        amount: { type: "number" },
        unit: { type: "string", enum: ["x", "mins"] },
        calories: { type: "integer", minimum: 0, maximum: 100000 },
      },
    },
  },
} as const;

export function activitiesController(d: Deps) {
  return async (app: FastifyInstance) => {
    app.addHook("onRequest", authenticate);

    app.get<{ Querystring: { from: string; to: string; category?: CategorySlug } }>(
      "/activities",
      {
        schema: {
          querystring: {
            type: "object",
            required: ["from", "to"],
            properties: { from: isoTime, to: isoTime, category: { type: "string", enum: CATEGORY_SLUGS } },
          },
        },
      },
      async (request) =>
        d.listActivities.execute(request.user.id, request.query.from, request.query.to, request.query.category ?? null),
    );

    app.get<{ Params: { id: number } }>("/activities/:id", { schema: { params: idParams } }, async (request) =>
      d.getActivity.execute(request.user.id, request.params.id),
    );

    app.post<{ Body: CreateActivityRequest }>(
      "/activities",
      {
        schema: {
          body: {
            type: "object",
            required: ["category", "name", "plannedStart", "plannedEnd"],
            properties: { category: { type: "string", enum: CATEGORY_SLUGS }, ...activityProperties },
          },
        },
      },
      async (request, reply) => reply.code(201).send(await d.createActivity.execute(request.user.id, request.body)),
    );

    app.patch<{ Params: { id: number }; Body: UpdateActivityRequest & { category?: string } }>(
      "/activities/:id",
      {
        schema: {
          params: idParams,
          // `category` is accepted here only so the service can refuse a change with a clear message.
          body: { type: "object", properties: { category: { type: "string" }, ...activityProperties } },
        },
      },
      async (request) => d.updateActivity.execute(request.user.id, request.params.id, request.body),
    );

    app.delete<{ Params: { id: number } }>("/activities/:id", { schema: { params: idParams } }, async (request, reply) => {
      await d.deleteActivity.execute(request.user.id, request.params.id);
      return reply.code(204).send();
    });

    app.post<{ Params: { id: number } }>("/activities/:id/cancel", { schema: { params: idParams } }, async (request) =>
      d.cancelActivity.execute(request.user.id, request.params.id),
    );

    app.post<{ Params: { id: number } }>("/activities/:id/restore", { schema: { params: idParams } }, async (request) =>
      d.restoreActivity.execute(request.user.id, request.params.id),
    );
  };
}
