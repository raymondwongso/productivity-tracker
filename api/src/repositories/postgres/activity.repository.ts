import type { Pool, PoolClient } from "pg";
import type {
  Activity,
  ActivityBase,
  ActivityLabel,
  CategorySlug,
  MealItem,
  TitleKind,
  WorkoutFocus,
  WorkoutItem,
} from "@productivitytracker/shared";

/** Category-specific state, written to the matching detail table. */
export type ActivityDetails =
  | { category: "sleep" }
  | { category: "workout"; focus: WorkoutFocus | null; caloriesBurned: number | null; items: WorkoutItem[] }
  | { category: "meals"; totalCalories: number | null; items: MealItem[] }
  | { category: "work"; projectId: number | null }
  | { category: "watch"; titleId: number | null }
  | { category: "gaming"; gameId: number | null };

/** The full writable state of an activity. Services build it; the repository stores it as-is. */
export interface ActivityState {
  name: string;
  plannedStart: Date;
  plannedEnd: Date;
  actualStart: Date | null;
  actualEnd: Date | null;
  notes: string;
  cancelledAt: Date | null;
  labels: ActivityLabel[];
  details: ActivityDetails;
}

export interface NewActivity extends ActivityState {
  userId: number;
  categoryId: number;
}

interface ActivityRow {
  id: number;
  category_id: number;
  category: CategorySlug;
  name: string;
  planned_start: Date;
  planned_end: Date;
  actual_start: Date | null;
  actual_end: Date | null;
  notes: string;
  cancelled_at: Date | null;
  labels: ActivityLabel[];
  created_at: Date;
  updated_at: Date;
  focus: WorkoutFocus | null;
  calories_burned: number | null;
  total_calories: number | null;
  project_id: number | null;
  project_name: string | null;
  title_id: number | null;
  title_name: string | null;
  title_kind: TitleKind | null;
  game_id: number | null;
  game_name: string | null;
  workout_items: { name: string; amount: number | string; unit: WorkoutItem["unit"] }[];
  meal_items: MealItem[];
}

const iso = (d: Date | null) => (d ? d.toISOString() : null);

function toActivity(r: ActivityRow): Activity {
  const base: ActivityBase = {
    id: r.id,
    categoryId: r.category_id,
    name: r.name,
    plannedStart: r.planned_start.toISOString(),
    plannedEnd: r.planned_end.toISOString(),
    actualStart: iso(r.actual_start),
    actualEnd: iso(r.actual_end),
    notes: r.notes,
    cancelledAt: iso(r.cancelled_at),
    labels: r.labels,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
  switch (r.category) {
    case "workout":
      return {
        ...base,
        category: "workout",
        focus: r.focus,
        caloriesBurned: r.calories_burned,
        items: r.workout_items.map((i) => ({ name: i.name, amount: Number(i.amount), unit: i.unit })),
      };
    case "meals":
      return { ...base, category: "meals", totalCalories: r.total_calories, items: r.meal_items };
    case "work":
      return {
        ...base,
        category: "work",
        project: r.project_id !== null && r.project_name !== null ? { id: r.project_id, name: r.project_name } : null,
      };
    case "watch":
      return {
        ...base,
        category: "watch",
        title:
          r.title_id !== null && r.title_name !== null && r.title_kind !== null
            ? { id: r.title_id, name: r.title_name, kind: r.title_kind }
            : null,
      };
    case "gaming":
      return {
        ...base,
        category: "gaming",
        game: r.game_id !== null && r.game_name !== null ? { id: r.game_id, name: r.game_name } : null,
      };
    default:
      return { ...base, category: "sleep" };
  }
}

const SELECT = `
  SELECT a.id, a.category_id, c.slug AS category, a.name, a.planned_start, a.planned_end,
         a.actual_start, a.actual_end, a.notes, a.cancelled_at, a.labels, a.created_at, a.updated_at,
         wd.focus, wd.calories_burned, md.total_calories,
         wk.project_id, p.name AS project_name,
         wt.title_id, t.name AS title_name, t.kind AS title_kind,
         gd.game_id, g.name AS game_name,
         COALESCE((SELECT json_agg(json_build_object('name', wi.name, 'amount', wi.amount, 'unit', wi.unit) ORDER BY wi.position)
                   FROM workout_items wi WHERE wi.activity_id = a.id), '[]') AS workout_items,
         COALESCE((SELECT json_agg(json_build_object('name', mi.name, 'calories', mi.calories) ORDER BY mi.position)
                   FROM meal_items mi WHERE mi.activity_id = a.id), '[]') AS meal_items
  FROM activities a
  JOIN categories c ON c.id = a.category_id
  LEFT JOIN workout_details wd ON wd.activity_id = a.id
  LEFT JOIN meal_details md ON md.activity_id = a.id
  LEFT JOIN work_details wk ON wk.activity_id = a.id
  LEFT JOIN projects p ON p.id = wk.project_id
  LEFT JOIN watch_details wt ON wt.activity_id = a.id
  LEFT JOIN titles t ON t.id = wt.title_id
  LEFT JOIN gaming_details gd ON gd.activity_id = a.id
  LEFT JOIN games g ON g.id = gd.game_id`;

export class ActivityRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Activities overlapping [from, to). Activities last at most 24 hours (a CHECK constraint),
   * so the planned_start index can bound the scan from both ends.
   */
  async listInRange(userId: number, from: Date, to: Date, category: CategorySlug | null = null): Promise<Activity[]> {
    const { rows } = await this.pool.query<ActivityRow>(
      `${SELECT}
       WHERE a.user_id = $1
         AND a.planned_start >= $2::timestamptz - interval '24 hours'
         AND a.planned_start < $3
         AND a.planned_end > $2
         AND ($4::text IS NULL OR c.slug = $4)
       ORDER BY a.planned_start, a.id`,
      [userId, from, to, category],
    );
    return rows.map(toActivity);
  }

  async findByIdForUser(id: number, userId: number): Promise<Activity | null> {
    const { rows } = await this.pool.query<ActivityRow>(`${SELECT} WHERE a.id = $1 AND a.user_id = $2`, [id, userId]);
    return rows[0] ? toActivity(rows[0]) : null;
  }

  async create(a: NewActivity): Promise<Activity> {
    const id = await this.transaction(async (client) => {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO activities (user_id, category_id, name, planned_start, planned_end, actual_start, actual_end,
                                 notes, cancelled_at, labels)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [a.userId, a.categoryId, a.name, a.plannedStart, a.plannedEnd, a.actualStart, a.actualEnd, a.notes, a.cancelledAt, a.labels],
      );
      const newId = rows[0]!.id;
      await writeDetails(client, newId, a.details);
      return newId;
    });
    return (await this.findByIdForUser(id, a.userId))!;
  }

  /** Replaces the activity's state. Returns null when the user has no such activity. */
  async update(id: number, userId: number, s: ActivityState): Promise<Activity | null> {
    const found = await this.transaction(async (client) => {
      const { rowCount } = await client.query(
        `UPDATE activities
         SET name = $3, planned_start = $4, planned_end = $5, actual_start = $6, actual_end = $7,
             notes = $8, cancelled_at = $9, labels = $10, updated_at = now()
         WHERE id = $1 AND user_id = $2`,
        [id, userId, s.name, s.plannedStart, s.plannedEnd, s.actualStart, s.actualEnd, s.notes, s.cancelledAt, s.labels],
      );
      if (!rowCount) return false;
      await writeDetails(client, id, s.details);
      return true;
    });
    return found ? this.findByIdForUser(id, userId) : null;
  }

  /** Deletes the activity with its detail and item rows (cascade). Returns false when none matched. */
  async delete(id: number, userId: number): Promise<boolean> {
    const { rowCount } = await this.pool.query("DELETE FROM activities WHERE id = $1 AND user_id = $2", [id, userId]);
    return (rowCount ?? 0) > 0;
  }

  private async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

/** Upserts the detail row and replaces the item rows (positions 0…n). */
async function writeDetails(client: PoolClient, id: number, d: ActivityDetails): Promise<void> {
  switch (d.category) {
    case "sleep":
      return;
    case "workout":
      await client.query(
        `INSERT INTO workout_details (activity_id, focus, calories_burned) VALUES ($1, $2, $3)
         ON CONFLICT (activity_id) DO UPDATE SET focus = EXCLUDED.focus, calories_burned = EXCLUDED.calories_burned`,
        [id, d.focus, d.caloriesBurned],
      );
      await client.query("DELETE FROM workout_items WHERE activity_id = $1", [id]);
      if (d.items.length) {
        await client.query(
          `INSERT INTO workout_items (activity_id, position, name, amount, unit)
           SELECT $1, t.ord - 1, t.name, t.amount, t.unit
           FROM unnest($2::text[], $3::numeric[], $4::text[]) WITH ORDINALITY AS t(name, amount, unit, ord)`,
          [id, d.items.map((i) => i.name), d.items.map((i) => i.amount), d.items.map((i) => i.unit)],
        );
      }
      return;
    case "meals":
      await client.query(
        `INSERT INTO meal_details (activity_id, total_calories) VALUES ($1, $2)
         ON CONFLICT (activity_id) DO UPDATE SET total_calories = EXCLUDED.total_calories`,
        [id, d.totalCalories],
      );
      await client.query("DELETE FROM meal_items WHERE activity_id = $1", [id]);
      if (d.items.length) {
        await client.query(
          `INSERT INTO meal_items (activity_id, position, name, calories)
           SELECT $1, t.ord - 1, t.name, t.calories
           FROM unnest($2::text[], $3::integer[]) WITH ORDINALITY AS t(name, calories, ord)`,
          [id, d.items.map((i) => i.name), d.items.map((i) => i.calories)],
        );
      }
      return;
    case "work":
      await client.query(
        `INSERT INTO work_details (activity_id, project_id) VALUES ($1, $2)
         ON CONFLICT (activity_id) DO UPDATE SET project_id = EXCLUDED.project_id`,
        [id, d.projectId],
      );
      return;
    case "watch":
      await client.query(
        `INSERT INTO watch_details (activity_id, title_id) VALUES ($1, $2)
         ON CONFLICT (activity_id) DO UPDATE SET title_id = EXCLUDED.title_id`,
        [id, d.titleId],
      );
      return;
    case "gaming":
      await client.query(
        `INSERT INTO gaming_details (activity_id, game_id) VALUES ($1, $2)
         ON CONFLICT (activity_id) DO UPDATE SET game_id = EXCLUDED.game_id`,
        [id, d.gameId],
      );
      return;
  }
}
