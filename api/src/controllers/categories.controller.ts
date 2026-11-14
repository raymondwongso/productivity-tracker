import type { FastifyInstance } from "fastify";
import { authenticate } from "../lib/auth.js";
import type { ListCategoriesService } from "../services/list-categories.service.js";

export function categoriesController({ listCategories }: { listCategories: Pick<ListCategoriesService, "execute"> }) {
  return async (app: FastifyInstance) => {
    app.addHook("onRequest", authenticate);
    app.get("/categories", async () => listCategories.execute());
  };
}
