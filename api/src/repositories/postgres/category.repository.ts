import type { Pool } from "pg";
import type { Category, CategorySlug } from "@productivitytracker/shared";

interface CategoryRow {
  id: number;
  slug: CategorySlug;
  name: string;
  color: string;
  sort_order: number;
}

const toCategory = (r: CategoryRow): Category => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  color: r.color,
  sortOrder: r.sort_order,
});

const COLS = "id, slug, name, color, sort_order";

export class CategoryRepository {
  constructor(private readonly pool: Pool) {}

  async list(): Promise<Category[]> {
    const { rows } = await this.pool.query<CategoryRow>(`SELECT ${COLS} FROM categories ORDER BY sort_order, id`);
    return rows.map(toCategory);
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const { rows } = await this.pool.query<CategoryRow>(`SELECT ${COLS} FROM categories WHERE slug = $1`, [slug]);
    return rows[0] ? toCategory(rows[0]) : null;
  }
}
