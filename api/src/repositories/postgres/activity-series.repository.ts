import type { Pool, PoolClient } from "pg";
import type { ActivitySeries, RepeatFrequency, Weekday } from "@productivitytracker/shared";
import { insertActivity, type NewActivity } from "./activity.repository.js";
import { withTransaction } from "./pool.js";

export interface NewSeries {
  userId: number;
  categoryId: number;
  frequency: RepeatFrequency;
  every: number;
  weekdays: Weekday[] | null;
  /** Local dates, YYYY-MM-DD. */
  startsOn: string;
  until: string;
  timeZone: string;
}

interface SeriesRow {
  id: number;
  category_id: number;
  frequency: RepeatFrequency;
  every_n: number;
  weekdays: Weekday[] | null;
  starts_on: string;
  ends_on: string;
  time_zone: string;
  occurrences: number;
}

const toSeries = (r: SeriesRow): ActivitySeries => ({
  id: r.id,
  categoryId: r.category_id,
  frequency: r.frequency,
  every: r.every_n,
  weekdays: r.weekdays,
  startsOn: r.starts_on,
  until: r.ends_on,
  timeZone: r.time_zone,
  occurrences: r.occurrences,
});

// Dates as text: pg would otherwise turn a DATE into a Date at local midnight of the server.
const SELECT = `
  SELECT s.id, s.category_id, s.frequency, s.every_n, s.weekdays, s.starts_on::text AS starts_on,
         s.ends_on::text AS ends_on, s.time_zone,
         (SELECT count(*) FROM activities a WHERE a.series_id = s.id) AS occurrences
  FROM activity_series s`;

async function findOn(client: Pool | PoolClient, id: number, userId: number): Promise<ActivitySeries | null> {
  const { rows } = await client.query<SeriesRow>(`${SELECT} WHERE s.id = $1 AND s.user_id = $2`, [id, userId]);
  return rows[0] ? toSeries(rows[0]) : null;
}

export class ActivitySeriesRepository {
  constructor(private readonly pool: Pool) {}

  findByIdForUser(id: number, userId: number): Promise<ActivitySeries | null> {
    return findOn(this.pool, id, userId);
  }

  /** Inserts the series and every occurrence in one transaction: all of them or none. */
  async create(s: NewSeries, occurrences: Omit<NewActivity, "seriesId">[]): Promise<ActivitySeries> {
    return withTransaction(this.pool, async (client) => {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO activity_series (user_id, category_id, frequency, every_n, weekdays, starts_on, ends_on, time_zone)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
        [s.userId, s.categoryId, s.frequency, s.every, s.weekdays, s.startsOn, s.until, s.timeZone],
      );
      const seriesId = rows[0]!.id;
      for (const o of occurrences) await insertActivity(client, { ...o, seriesId });
      return (await findOn(client, seriesId, s.userId))!;
    });
  }

  /**
   * Deletes the occurrences planned to start at or after `from` and ends the series the day
   * before (local). Deletes the series itself when nothing is left. Returns the number deleted.
   */
  async deleteFollowing(seriesId: number, userId: number, from: Date): Promise<number> {
    return withTransaction(this.pool, async (client) => {
      const { rowCount } = await client.query(
        "DELETE FROM activities WHERE series_id = $1 AND user_id = $2 AND planned_start >= $3",
        [seriesId, userId, from],
      );
      await client.query(
        `UPDATE activity_series
         SET ends_on = GREATEST(starts_on, LEAST(ends_on, ($3::timestamptz AT TIME ZONE time_zone)::date - 1)),
             updated_at = now()
         WHERE id = $1 AND user_id = $2`,
        [seriesId, userId, from],
      );
      await deleteIfEmptyOn(client, seriesId, userId);
      return rowCount ?? 0;
    });
  }

  /** Removes the series once its last occurrence is gone. */
  async deleteIfEmpty(seriesId: number, userId: number): Promise<void> {
    await deleteIfEmptyOn(this.pool, seriesId, userId);
  }
}

async function deleteIfEmptyOn(client: Pool | PoolClient, seriesId: number, userId: number): Promise<void> {
  await client.query(
    `DELETE FROM activity_series s
     WHERE s.id = $1 AND s.user_id = $2 AND NOT EXISTS (SELECT 1 FROM activities a WHERE a.series_id = s.id)`,
    [seriesId, userId],
  );
}
