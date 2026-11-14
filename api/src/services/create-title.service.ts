import type { CreateTitleRequest, Title } from "@productivitytracker/shared";
import { badRequest } from "../errors.js";
import { NAME_MAX_LENGTH } from "../lib/activities.js";
import type { TitleRepository } from "../repositories/postgres/title.repository.js";

const isUniqueViolation = (err: unknown) =>
  typeof err === "object" && err !== null && (err as { code?: string }).code === "23505";

/** Get-or-create by kind and name, case-insensitive. */
export class CreateTitleService {
  constructor(private readonly titles: Pick<TitleRepository, "findByName" | "create">) {}

  async execute(userId: number, req: CreateTitleRequest): Promise<Title> {
    const name = req.name.trim();
    if (!name) throw badRequest("Title is required");
    if (name.length > NAME_MAX_LENGTH) throw badRequest(`Title must be at most ${NAME_MAX_LENGTH} characters`);
    const existing = await this.titles.findByName(userId, req.kind, name);
    if (existing) return existing;
    return this.titles.create(userId, req.kind, name).catch(async (err: unknown) => {
      const raced = isUniqueViolation(err) ? await this.titles.findByName(userId, req.kind, name) : null;
      if (raced) return raced;
      throw err;
    });
  }
}
