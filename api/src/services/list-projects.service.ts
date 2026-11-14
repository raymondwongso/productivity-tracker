import type { Project, ProjectStatus } from "@productivitytracker/shared";
import type { ProjectRepository } from "../repositories/postgres/project.repository.js";

export class ListProjectsService {
  constructor(private readonly projects: Pick<ProjectRepository, "list">) {}

  execute(userId: number, status: ProjectStatus | null): Promise<Project[]> {
    return this.projects.list(userId, status);
  }
}
