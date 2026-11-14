import type { Title } from "@productivitytracker/shared";
import type { TitleRepository } from "../repositories/postgres/title.repository.js";

export class ListTitlesService {
  constructor(private readonly titles: Pick<TitleRepository, "list">) {}

  execute(userId: number): Promise<Title[]> {
    return this.titles.list(userId);
  }
}
