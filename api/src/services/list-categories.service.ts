import type { Category } from "@productivitytracker/shared";
import type { CategoryRepository } from "../repositories/postgres/category.repository.js";

export class ListCategoriesService {
  constructor(private readonly categories: Pick<CategoryRepository, "list">) {}

  execute(): Promise<Category[]> {
    return this.categories.list();
  }
}
