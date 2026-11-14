import type { Pool } from "pg";
import type { GracePeriods } from "@productivitytracker/shared";

const KEYS = {
  lateMinutes: "graceful_late_period",
  prematureMinutes: "graceful_premature_period",
  overrunMinutes: "graceful_overrun_period",
} as const satisfies Record<keyof GracePeriods, string>;

export class SettingsRepository {
  constructor(private readonly pool: Pool) {}

  /** The grace periods in force right now (minutes). Throws if a seeded row is missing. */
  async getGracePeriods(): Promise<GracePeriods> {
    const { rows } = await this.pool.query<{ key: string; value: number }>(
      "SELECT key, value FROM settings WHERE key = ANY($1::text[])",
      [Object.values(KEYS)],
    );
    const byKey = new Map(rows.map((r) => [r.key, r.value]));
    const read = (key: string): number => {
      const v = byKey.get(key);
      if (v === undefined) throw new Error(`settings row "${key}" is missing`);
      return v;
    };
    return {
      lateMinutes: read(KEYS.lateMinutes),
      prematureMinutes: read(KEYS.prematureMinutes),
      overrunMinutes: read(KEYS.overrunMinutes),
    };
  }
}
