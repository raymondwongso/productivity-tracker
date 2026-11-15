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
import { CreateActivityService } from "../../services/create-activity.service.js";
import { UpdateActivityService } from "../../services/update-activity.service.js";
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
    create = new CreateActivityService(new CategoryRepository(pool), settings, refs, activities);
    update = new UpdateActivityService(settings, refs, activities);
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
      ["labels = '{late}'", "activities_labels_finished"],
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
});
