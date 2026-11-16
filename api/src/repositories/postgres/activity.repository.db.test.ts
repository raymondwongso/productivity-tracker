// DB-backed checks for what unit tests cannot see: the SQL itself, the label CHECK constraints,
// cascades and the range query. Needs a reachable Postgres (DATABASE_URL, default: the dev DB on
// 5433 from `make api-dev`). It creates a throwaway database and drops it afterwards; it never
// touches your data. If Postgres is not reachable the suite FAILS with a clear message (it is not skipped).
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import pg from "pg";
import { loadConfig } from "../../config.js";
import { CATEGORY_SLUGS } from "../../controllers/activities.controller.js";
import { CreateActivitySeriesService } from "../../services/create-activity-series.service.js";
import { CreateActivityService } from "../../services/create-activity.service.js";
import { DeleteActivityService } from "../../services/delete-activity.service.js";
import { UpdateActivityService } from "../../services/update-activity.service.js";
import { ActivitySeriesRepository } from "./activity-series.repository.js";
import { ActivityRepository } from "./activity.repository.js";
import { CategoryRepository } from "./category.repository.js";
import { GameRepository } from "./game.repository.js";
import { createPool } from "./pool.js";
import { ProjectRepository } from "./project.repository.js";
import { SettingsRepository } from "./settings.repository.js";
import { StatsRepository } from "./stats.repository.js";
import { TitleRepository } from "./title.repository.js";

const migrationsDir = join(import.meta.dirname, "..", "..", "..", "db", "migrations");
const dbName = `pt_test_${process.pid}_${Date.now()}`;

let admin: pg.Client;
let pool: pg.Pool;
let activities: ActivityRepository;
let projects: ProjectRepository;
let titles: TitleRepository;
let games: GameRepository;
let settings: SettingsRepository;
let create: CreateActivityService;
let update: UpdateActivityService;
let series: ActivitySeriesRepository;
let createSeries: CreateActivitySeriesService;
let remove: DeleteActivityService;
let userId: number;
let otherUserId: number;

const t = (hhmm: string, day = 14) => `2026-11-${day}T${hhmm}:00.000Z`;

describe("activity repository against a real Postgres", () => {
  before(async () => {
    const config = loadConfig();
    const adminUrl = new URL(config.databaseUrl);
    adminUrl.pathname = "/postgres";
    admin = new pg.Client({ connectionString: adminUrl.toString() });
    try {
      await admin.connect();
    } catch (err) {
      throw new Error(
        `Activity DB tests need Postgres at ${adminUrl.host} (set DATABASE_URL or run \`make api-dev\`): ${(err as Error).message}`,
      );
    }
    await admin.query(`CREATE DATABASE ${dbName}`);
    const testUrl = new URL(config.databaseUrl);
    testUrl.pathname = `/${dbName}`;
    pool = createPool({ ...config, databaseUrl: testUrl.toString() });
    for (const f of readdirSync(migrationsDir).filter((n) => n.endsWith(".sql")).sort()) {
      await pool.query(readFileSync(join(migrationsDir, f), "utf8"));
    }
    const users = await pool.query<{ id: number }>(
      "INSERT INTO users (email, first_name, last_name, password_hash) VALUES ('a@b.co','A','B','x'), ('c@d.co','C','D','x') RETURNING id",
    );
    userId = users.rows[0]!.id;
    otherUserId = users.rows[1]!.id;
    activities = new ActivityRepository(pool);
    projects = new ProjectRepository(pool);
    titles = new TitleRepository(pool);
    games = new GameRepository(pool);
    settings = new SettingsRepository(pool);
    const refs = { projects, titles, games };
    series = new ActivitySeriesRepository(pool);
    create = new CreateActivityService(new CategoryRepository(pool), settings, refs, activities);
    update = new UpdateActivityService(settings, refs, activities, series);
    createSeries = new CreateActivitySeriesService(new CategoryRepository(pool), settings, refs, series, activities);
    remove = new DeleteActivityService(activities, series);
  });

  after(async () => {
    await pool?.end();
    await admin?.query(`DROP DATABASE IF EXISTS ${dbName} WITH (FORCE)`);
    await admin?.end();
  });

  test("seeded categories and grace periods", async () => {
    const cats = await new CategoryRepository(pool).list();
    assert.deepEqual(cats.map((c) => [c.slug, c.color]), [
      ["sleep", "#9dcffa"], ["work", "#b67747"], ["workout", "#e0d00d"], ["meals", "#02a193"], ["watch", "#9d82e1"],
      ["gaming", "#f78bb8"], ["misc", "#b4c2c6"],
    ]);
    // Every seeded category is one the activities route accepts.
    assert.deepEqual(cats.map((c) => c.slug), CATEGORY_SLUGS);
    assert.deepEqual(await settings.getGracePeriods(), { lateMinutes: 10, prematureMinutes: 15, overrunMinutes: 15 });
  });

  test("round trip for every category, with details and ordered items", async () => {
    const project = await projects.create(userId, "Website");
    const title = await titles.create(userId, "series", "Severance");
    const base = { plannedStart: t("09:00"), plannedEnd: t("10:00") };

    const sleep = await create.execute(userId, { category: "sleep", name: "Nap", ...base, notes: "<p><b>zz</b></p>" });
    assert.equal(sleep.category, "sleep");
    assert.equal(sleep.notes, "<p><b>zz</b></p>");

    const workout = await create.execute(userId, {
      category: "workout", name: "Gym", ...base, focus: "strength", caloriesBurned: 320,
      items: [{ name: "Squat", amount: 5, unit: "x" }, { name: "Plank", amount: 2.5, unit: "mins" }],
    });
    assert.ok(workout.category === "workout");
    assert.equal(workout.focus, "strength");
    assert.deepEqual(workout.items, [{ name: "Squat", amount: 5, unit: "x" }, { name: "Plank", amount: 2.5, unit: "mins" }]);

    const meal = await create.execute(userId, {
      category: "meals", name: "Lunch", ...base, items: [{ name: "Rice", calories: 200 }, { name: "Fish", calories: 310 }],
    });
    assert.ok(meal.category === "meals");
    assert.equal(meal.totalCalories, 510);
    assert.deepEqual(meal.items.map((i) => i.name), ["Rice", "Fish"]);

    const work = await create.execute(userId, { category: "work", name: "Build", ...base, projectId: project.id });
    assert.deepEqual(work.category === "work" && work.project, { id: project.id, name: "Website" });

    const watch = await create.execute(userId, { category: "watch", name: "Ep 1", ...base, titleId: title.id });
    assert.deepEqual(watch.category === "watch" && watch.title, { id: title.id, name: "Severance", kind: "series" });

    const game = await games.create(userId, "Balatro");
    const gaming = await create.execute(userId, { category: "gaming", name: "Runs", ...base, gameId: game.id });
    assert.deepEqual(gaming.category === "gaming" && gaming.game, { id: game.id, name: "Balatro" });
    const noGame = await update.execute(userId, gaming.id, { gameId: null });
    assert.equal(noGame.category === "gaming" && noGame.game, null);
    // A game an activity uses can't be deleted.
    await update.execute(userId, gaming.id, { gameId: game.id });
    await assert.rejects(pool.query("DELETE FROM games WHERE id = $1", [game.id]), (e: unknown) => (e as { code?: string }).code === "23503");

    const misc = await create.execute(userId, { category: "misc", name: "Groceries", ...base, notes: "<p>milk</p>" });
    assert.equal(misc.category, "misc");
    assert.deepEqual(misc.labels, ["pending"]);
    const miscRead = await activities.findByIdForUser(misc.id, userId);
    assert.equal(miscRead?.category, "misc");
    const miscDone = await update.execute(userId, misc.id, { actualStart: t("09:00"), actualEnd: t("10:00") });
    assert.equal(miscDone.category, "misc");
    assert.deepEqual(miscDone.labels, ["done"]);

    // Replacing items rewrites positions; the meal total follows the items.
    const meal2 = await update.execute(userId, meal.id, { items: [{ name: "Soup", calories: 150 }] });
    assert.ok(meal2.category === "meals");
    assert.deepEqual(meal2.items, [{ name: "Soup", calories: 150 }]);
    assert.equal(meal2.totalCalories, 150);

    // Deleting cascades to detail and item rows.
    assert.equal(await activities.delete(workout.id, userId), true);
    const left = await pool.query("SELECT count(*)::int AS n FROM workout_items WHERE activity_id = $1", [workout.id]);
    assert.equal(left.rows[0].n, 0);
  });

  test("labels are stored on write and stay put when the grace period changes", async () => {
    const a = await create.execute(userId, {
      category: "sleep", name: "Late", plannedStart: t("09:00"), plannedEnd: t("10:00"), actualStart: t("09:12"), actualEnd: t("10:20"),
    });
    assert.deepEqual(a.labels, ["late", "overrun"]);
    await pool.query("UPDATE settings SET value = 30 WHERE key = 'graceful_late_period'");
    try {
      assert.deepEqual((await activities.findByIdForUser(a.id, userId))!.labels, ["late", "overrun"]);
      assert.deepEqual((await update.execute(userId, a.id, { notes: "<p>edited</p>" })).labels, ["late", "overrun"]);
      assert.deepEqual((await update.execute(userId, a.id, { actualEnd: t("10:10") })).labels, ["done"]);
    } finally {
      await pool.query("UPDATE settings SET value = 10 WHERE key = 'graceful_late_period'");
    }
  });

  test("the range query finds activities overlapping the range, including across midnight, per user", async () => {
    const night = await create.execute(userId, { category: "sleep", name: "Night", plannedStart: t("23:00", 20), plannedEnd: t("06:30", 21) });
    await create.execute(otherUserId, { category: "sleep", name: "Theirs", plannedStart: t("23:00", 20), plannedEnd: t("06:30", 21) });
    const next = await activities.listInRange(userId, new Date(t("00:00", 21)), new Date(t("00:00", 22)));
    assert.deepEqual(next.map((a) => a.id), [night.id]);
    const prev = await activities.listInRange(userId, new Date(t("00:00", 20)), new Date(t("00:00", 21)));
    assert.deepEqual(prev.map((a) => a.id), [night.id]);
    assert.deepEqual(await activities.listInRange(userId, new Date(t("07:00", 21)), new Date(t("00:00", 22))), []);
  });

  test("a finished activity that started late but ended on time saves as late, also across midnight", async () => {
    const night = await create.execute(userId, { category: "sleep", name: "Night", plannedStart: t("16:00", 26), plannedEnd: t("00:00", 27) });
    const slept = await update.execute(userId, night.id, { actualStart: t("18:00", 26), actualEnd: t("00:00", 27) });
    assert.deepEqual(slept.labels, ["late"]);
    assert.equal(slept.actualEnd, t("00:00", 27));
    const day = await create.execute(userId, {
      category: "sleep", name: "Nap", plannedStart: t("09:00", 26), plannedEnd: t("10:00", 26), actualStart: t("09:12", 26), actualEnd: t("10:05", 26),
    });
    assert.deepEqual(day.labels, ["late"]);
  });

  test("the label constraints reject rows the label rules can't produce", async () => {
    const a = await create.execute(userId, {
      category: "sleep", name: "C", plannedStart: t("09:00", 25), plannedEnd: t("10:00", 25), actualStart: t("09:00", 25), actualEnd: t("10:00", 25),
    });
    assert.deepEqual(a.labels, ["done"]);
    // Each case breaks exactly one constraint (Postgres reports the first failing one by name).
    const bad: [string, string][] = [
      ["labels = '{done,late}'", "activities_labels_valid"],
      ["labels = '{overrun,overrun}'", "activities_labels_valid"], // a duplicate
      ["labels = '{overrun,late}'", "activities_labels_valid"],
      ["actual_end = NULL, labels = '{pending}'", "activities_labels_pending"], // started, so not pending
      ["labels = '{}'", "activities_labels_finished"], // finished, so not merely started
      ["cancelled_at = now()", "activities_labels_cancelled"],
      ["actual_end = NULL", "activities_labels_end_needs_end"],
      ["planned_end = planned_start + interval '25 hours'", "activities_planned_max_24h"],
    ];
    for (const [set, constraint] of bad) {
      await assert.rejects(pool.query(`UPDATE activities SET ${set} WHERE id = $1`, [a.id]), (e: unknown) => {
        assert.equal((e as { constraint?: string }).constraint, constraint, set);
        return true;
      });
    }
  });

  test("project and title names are unique per user, any case", async () => {
    await assert.rejects(projects.create(userId, "WEBSITE"), (e: unknown) => (e as { code?: string }).code === "23505");
    await projects.create(otherUserId, "Website");
    assert.equal((await projects.findByName(userId, "website"))?.name, "Website");
    assert.deepEqual((await projects.list(userId, "completed")), []);
  });

  test("game names are unique per user, any case", async () => {
    await games.create(userId, "Hades II");
    await assert.rejects(games.create(userId, "hades ii"), (e: unknown) => (e as { code?: string }).code === "23505");
    await games.create(otherUserId, "Hades II");
    assert.equal((await games.findByName(userId, "HADES II"))?.name, "Hades II");
    assert.equal(await games.findByIdForUser((await games.findByName(otherUserId, "Hades II"))!.id, userId), null);
  });

  test("the range query can be narrowed to one category", async () => {
    const from = new Date(t("00:00", 14));
    const to = new Date(t("00:00", 15));
    const all = await activities.listInRange(userId, from, to);
    const gaming = await activities.listInRange(userId, from, to, "gaming");
    assert.ok(all.length > gaming.length);
    assert.ok(gaming.length > 0 && gaming.every((a) => a.category === "gaming"));
    const misc = await activities.listInRange(userId, from, to, "misc");
    assert.ok(misc.length > 0 && misc.every((a) => a.category === "misc"));
  });

  test("stats rows are bucketed by the local date of the planned start in the requested zone", async () => {
    const u = (await pool.query<{ id: number }>(
      "INSERT INTO users (email, first_name, last_name, password_hash) VALUES ('s@t.co','S','T','x') RETURNING id",
    )).rows[0]!.id;
    const stats = new StatsRepository(pool);
    const p = await projects.create(u, "Site");
    // 16:30Z is 23:30 on the 20th in Jakarta (UTC+7); 17:30Z is 00:30 on the 21st there.
    const late = await create.execute(u, {
      category: "work", name: "Late block", plannedStart: "2026-11-20T16:30:00Z", plannedEnd: "2026-11-20T17:00:00Z",
      actualStart: "2026-11-20T16:30:00Z", actualEnd: "2026-11-20T17:00:00Z", projectId: p.id,
    });
    const early = await create.execute(u, {
      category: "work", name: "Early block", plannedStart: "2026-11-20T17:30:00Z", plannedEnd: "2026-11-20T18:00:00Z",
    });
    await create.execute(u, { category: "sleep", name: "Not work", plannedStart: "2026-11-20T17:30:00Z", plannedEnd: "2026-11-20T23:00:00Z" });

    const jkt20 = await stats.listForStats(u, "work", "2026-11-20", "2026-11-20", "Asia/Jakarta");
    assert.deepEqual(jkt20.map((r) => [r.id, r.date, r.refName, r.labels]), [[late.id, "2026-11-20", "Site", ["done"]]]);
    const jkt21 = await stats.listForStats(u, "work", "2026-11-21", "2026-11-21", "Asia/Jakarta");
    assert.deepEqual(jkt21.map((r) => [r.id, r.date, r.refId, r.actualEnd]), [[early.id, "2026-11-21", null, null]]);
    const utc = await stats.listForStats(u, "work", "2026-11-20", "2026-11-20", "UTC");
    assert.deepEqual(utc.map((r) => r.id), [late.id, early.id]);
    assert.equal((await stats.listForStats(otherUserId, "work", "2026-11-20", "2026-11-21", "UTC")).length, 0);
  });
  test("a series and its occurrences are stored together, with details, in one transaction", async () => {
    const u = (await pool.query<{ id: number }>(
      "INSERT INTO users (email, first_name, last_name, password_hash) VALUES ('r@s.co','R','S','x') RETURNING id",
    )).rows[0]!.id;
    const { series: s, activities: occ } = await createSeries.execute(u, {
      category: "workout", name: "Gym", plannedStart: "2026-12-07T07:00:00Z", plannedEnd: "2026-12-07T08:00:00Z",
      focus: "strength", items: [{ name: "Squat", amount: 5, unit: "x" }],
      repeat: { frequency: "weekly", every: 1, weekdays: [3, 1], until: "2026-12-16", timeZone: "UTC" },
    });
    assert.deepEqual(
      { ...s, id: 0, categoryId: 0 },
      { id: 0, categoryId: 0, frequency: "weekly", every: 1, weekdays: [1, 3], startsOn: "2026-12-07", until: "2026-12-16", timeZone: "UTC", occurrences: 4 },
    );
    assert.deepEqual(occ.map((a) => a.plannedStart), [
      "2026-12-07T07:00:00.000Z", "2026-12-09T07:00:00.000Z", "2026-12-14T07:00:00.000Z", "2026-12-16T07:00:00.000Z",
    ]);
    assert.ok(occ.every((a) => a.seriesId === s.id && a.category === "workout" && a.items.length === 1));
    // The calendar's range query returns occurrences like any activity, with their series.
    const week = await activities.listInRange(u, new Date("2026-12-07T00:00:00Z"), new Date("2026-12-14T00:00:00Z"));
    assert.deepEqual(week.map((a) => a.seriesId), [s.id, s.id]);
    assert.equal(await series.findByIdForUser(s.id, otherUserId), null);

    // A failing occurrence rolls back the series and every occurrence before it.
    const before = (await pool.query<{ n: number }>("SELECT count(*) AS n FROM activity_series")).rows[0]!.n;
    const good = { userId: u, categoryId: occ[0]!.categoryId, ...stateOfPending("2026-12-20T07:00:00Z"), details: { category: "misc" as const } };
    await assert.rejects(
      series.create(
        { userId: u, categoryId: good.categoryId, frequency: "daily", every: 1, weekdays: null, startsOn: "2026-12-20", until: "2026-12-21", timeZone: "UTC" },
        [good, { ...good, labels: ["done"] }],
      ),
      (e: unknown) => (e as { code?: string }).code === "23514",
    );
    assert.equal((await pool.query<{ n: number }>("SELECT count(*) AS n FROM activity_series")).rows[0]!.n, before);
    assert.equal((await pool.query("SELECT 1 FROM activities WHERE planned_start = '2026-12-20T07:00:00Z'")).rowCount, 0);
  });

  test("this and following: edits are written together and deletes trim the series", async () => {
    const u = (await pool.query<{ id: number }>(
      "INSERT INTO users (email, first_name, last_name, password_hash) VALUES ('f@g.co','F','G','x') RETURNING id",
    )).rows[0]!.id;
    // Daily 22:00 → 06:00 in Jakarta (UTC+7): 15:00Z → 23:00Z.
    const { series: s, activities: occ } = await createSeries.execute(u, {
      category: "sleep", name: "Sleep", plannedStart: "2026-12-01T15:00:00Z", plannedEnd: "2026-12-01T23:00:00Z",
      repeat: { frequency: "daily", every: 1, weekdays: null, until: "2026-12-05", timeZone: "Asia/Jakarta" },
    });
    assert.equal(occ.length, 5);
    await update.execute(u, occ[2]!.id, { name: "Early night", plannedStart: "2026-12-03T14:30:00Z" }, "following");
    const after = await activities.listFollowing(s.id, u, new Date(0));
    assert.deepEqual(after.map((a) => [a.name, a.plannedStart.slice(0, 16), a.plannedEnd.slice(0, 16)]), [
      ["Sleep", "2026-12-01T15:00", "2026-12-01T23:00"],
      ["Sleep", "2026-12-02T15:00", "2026-12-02T23:00"],
      ["Early night", "2026-12-03T14:30", "2026-12-03T23:00"],
      ["Early night", "2026-12-04T14:30", "2026-12-04T23:00"],
      ["Early night", "2026-12-05T14:30", "2026-12-05T23:00"],
    ]);
    // updateMany writes all or nothing.
    assert.equal(await activities.updateMany(u, [{ id: occ[0]!.id, state: { ...stateOfPending("2026-12-01T15:00:00Z"), details: { category: "sleep" } } }, { id: 999999, state: { ...stateOfPending("2026-12-01T15:00:00Z"), details: { category: "sleep" } } }]), null);
    assert.equal((await activities.findByIdForUser(occ[0]!.id, u))!.name, "Sleep");

    // 22:00 local on the 4th; the series now ends on the 3rd (local), not on a UTC date.
    await remove.execute(u, occ[3]!.id, "following");
    const trimmed = await series.findByIdForUser(s.id, u);
    assert.deepEqual([trimmed!.until, trimmed!.occurrences], ["2026-12-03", 3]);
    for (const a of occ.slice(0, 3)) await remove.execute(u, a.id);
    assert.equal(await series.findByIdForUser(s.id, u), null);
  });

  test("the series constraints reject rules the API can't produce", async () => {
    const insert = (frequency: string, everyN: number, weekdays: number[] | null, startsOn: string, endsOn: string) =>
      pool.query(
        `INSERT INTO activity_series (user_id, category_id, frequency, every_n, weekdays, starts_on, ends_on, time_zone)
         VALUES ($1, 1, $2, $3, $4, $5, $6, 'UTC')`,
        [userId, frequency, everyN, weekdays, startsOn, endsOn],
      );
    const violates = (name: string) => (e: unknown) => (e as { constraint?: string }).constraint === name;
    await assert.rejects(insert("monthly", 1, null, "2026-12-01", "2026-12-02"), violates("activity_series_frequency"));
    await assert.rejects(insert("daily", 0, null, "2026-12-01", "2026-12-02"), violates("activity_series_every_n"));
    await assert.rejects(insert("daily", 1, [1], "2026-12-01", "2026-12-02"), violates("activity_series_weekdays"));
    await assert.rejects(insert("weekly", 1, [], "2026-12-01", "2026-12-02"), violates("activity_series_weekdays"));
    await assert.rejects(insert("weekly", 1, [8], "2026-12-01", "2026-12-02"), violates("activity_series_weekdays"));
    await assert.rejects(insert("daily", 1, null, "2026-12-01", "2026-11-30"), violates("activity_series_range"));
    await assert.rejects(insert("daily", 1, null, "2026-01-31", "2026-03-01"), violates("activity_series_range"));
    await insert("daily", 1, null, "2026-01-31", "2026-02-28");
  });
});

/** A pending one-hour activity's state, for writing through the repositories directly. */
function stateOfPending(start: string) {
  const plannedStart = new Date(start);
  return {
    name: "Block", plannedStart, plannedEnd: new Date(plannedStart.getTime() + 60 * 60_000), actualStart: null, actualEnd: null,
    notes: "", cancelledAt: null, labels: ["pending" as const],
  };
}
