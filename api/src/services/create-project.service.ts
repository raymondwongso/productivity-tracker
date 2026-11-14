import type { CreateProjectRequest, Project } from "@productivitytracker/shared";
import { badRequest } from "../errors.js";
import { NAME_MAX_LENGTH } from "../lib/activities.js";
import type { ProjectRepository } from "../repositories/postgres/project.repository.js";

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";

/** Get-or-create by name, case-insensitive, so "+ Create new" selects an existing match. */
export class CreateProjectService {
  constructor(private readonly projects: Pick<ProjectRepository, "findByName" | "create">) {}

  async execute(userId: number, req: CreateProjectRequest): Promise<Project> {
    const name = req.name.trim();
    if (!name) throw badRequest("Project name is required");
    if (name.length > NAME_MAX_LENGTH) throw badRequest(`Project name must be at most ${NAME_MAX_LENGTH} characters`);
    const existing = await this.projects.findByName(userId, name);
    if (existing) return existing;
    return this.projects.create(userId, name).catch(async (err: unknown) => {
      const raced = isUniqueViolation(err) ? await this.projects.findByName(userId, name) : null;
      if (raced) return raced;
      throw err;
    });
  }
}
