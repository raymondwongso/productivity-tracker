import type { Pool } from "pg";
import type { ActivityLabel, CategorySlug, TitleKind, WorkoutFocus } from "@productivitytracker/shared";

/** One activity as the trackers need it: its local planned day, times, labels and the category fields they read. */
export interface StatsActivity {
  id: number;
  /** Local date of the planned start in the requested zone, YYYY-MM-DD. */
  date: string;
  plannedStart: Date;
  plannedEnd: Date;
  actualStart: Date | null;
  actualEnd: Date | null;
  cancelled: boolean;
  labels: ActivityLabel[];
  focus: WorkoutFocus | null;
  caloriesBurned: number | null;
  totalCalories: number | null;
  /** The project, title or game, for work, watch and gaming. */
  refId: number | null;
  refName: string | null;
  refKind: TitleKind | null;
}

interface Row {
  id: number;
  date: string;
  planned_start: Date;
  planned_end: Date;
  actual_start: Date | null;
  actual_end: Date | null;
  cancelled: boolean;
  labels: ActivityLabel[];
  focus: WorkoutFocus | null;
  calories_burned: number | null;
  total_calories: number | null;
  ref_id: number | null;
  ref_name: string | null;
  ref_kind: TitleKind | null;
}

export class StatsRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Activities of one category planned to start on the local dates [from, to] in `tz`. The bounds are
   * local midnights, so the (user_id, category_id, planned_start) index serves the scan.
   */
  async listForStats(userId: number, category: CategorySlug, from: string, to: string, tz: string): Promise<StatsActivity[]> {
    const { rows } = await this.pool.query<Row>(
      `SELECT a.id, to_char(a.planned_start AT TIME ZONE $5, 'YYYY-MM-DD') AS date,
              a.planned_start, a.planned_end, a.actual_start, a.actual_end,
              a.cancelled_at IS NOT NULL AS cancelled, a.labels,
              wd.focus, wd.calories_burned, md.total_calories,
              COALESCE(wk.project_id, wt.title_id, gd.game_id) AS ref_id,
              COALESCE(p.name, t.name, g.name) AS ref_name,
              t.kind AS ref_kind
       FROM activities a
       JOIN categories c ON c.id = a.category_id
       LEFT JOIN workout_details wd ON wd.activity_id = a.id
       LEFT JOIN meal_details md ON md.activity_id = a.id
       LEFT JOIN work_details wk ON wk.activity_id = a.id
       LEFT JOIN projects p ON p.id = wk.project_id
       LEFT JOIN watch_details wt ON wt.activity_id = a.id
       LEFT JOIN titles t ON t.id = wt.title_id
       LEFT JOIN gaming_details gd ON gd.activity_id = a.id
       LEFT JOIN games g ON g.id = gd.game_id
       WHERE a.user_id = $1
         AND c.slug = $2
         AND a.planned_start >= ($3::date)::timestamp AT TIME ZONE $5
         AND a.planned_start < ($4::date + 1)::timestamp AT TIME ZONE $5
       ORDER BY a.planned_start, a.id`,
      [userId, category, from, to, tz],
    );
    return rows.map((r) => ({
      id: r.id,
      date: r.date,
      plannedStart: r.planned_start,
      plannedEnd: r.planned_end,
      actualStart: r.actual_start,
      actualEnd: r.actual_end,
      cancelled: r.cancelled,
      labels: r.labels,
      focus: r.focus,
      caloriesBurned: r.calories_burned,
      totalCalories: r.total_calories,
      refId: r.ref_id,
      refName: r.ref_name,
      refKind: r.ref_kind,
    }));
  }
}
