import type { FastifyInstance } from "fastify";
import type { CreateProjectRequest, ProjectStatus } from "@productivitytracker/shared";
import { authenticate } from "../lib/auth.js";
import type { CreateProjectService } from "../services/create-project.service.js";
import type { ListProjectsService } from "../services/list-projects.service.js";
import { str } from "./schemas.js";

interface Deps {
  listProjects: Pick<ListProjectsService, "execute">;
  createProject: Pick<CreateProjectService, "execute">;
}

export function projectsController({ listProjects, createProject }: Deps) {
  return async (app: FastifyInstance) => {
    app.addHook("onRequest", authenticate);

    app.get<{ Querystring: { status?: ProjectStatus } }>(
      "/projects",
      {
        schema: {
          querystring: { type: "object", properties: { status: { type: "string", enum: ["ongoing", "on_hold", "completed"] } } },
        },
      },
      async (request) => listProjects.execute(request.user.id, request.query.status ?? null),
    );

    app.post<{ Body: CreateProjectRequest }>(
      "/projects",
      { schema: { body: { type: "object", required: ["name"], properties: { name: str(200) } } } },
      async (request, reply) => reply.code(201).send(await createProject.execute(request.user.id, request.body)),
    );
  };
}
