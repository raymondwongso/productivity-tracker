import assert from "node:assert/strict";
import { test } from "node:test";
import type { Activity, Category, CategoryFieldsInput, CategorySlug, Game, GracePeriods, Project, Title } from "@productivitytracker/shared";
import { AppError } from "../errors.js";
import type { ActivityState, NewActivity } from "../repositories/postgres/activity.repository.js";
import { CancelActivityService } from "./cancel-activity.service.js";
import { CreateActivityService } from "./create-activity.service.js";
import { CreateGameService } from "./create-game.service.js";
import { CreateProjectService } from "./create-project.service.js";
import { DeleteActivityService } from "./delete-activity.service.js";
import { GetActivityService } from "./get-activity.service.js";
import { ListActivitiesService } from "./list-activities.service.js";
import { RestoreActivityService } from "./restore-activity.service.js";
import { UpdateActivityService } from "./update-activity.service.js";

const SLUGS: CategorySlug[] = ["sleep", "work", "workout", "meals", "watch", "gaming", "misc"];
const CATEGORIES: Category[] = SLUGS.map((slug, i) => ({ id: i + 1, slug, name: slug, color: "#000000", sortOrder: i }));

/** In-memory stand-ins for the repositories, shaped like their Pick<> types. */
function fakes() {
  const grace: GracePeriods = { lateMinutes: 10, prematureMinutes: 15, overrunMinutes: 15 };
  const projects: (Project & { userId: number })[] = [
    { id: 1, userId: 1, name: "Website", status: "ongoing" },
    { id: 2, userId: 1, name: "Old", status: "completed" },
    { id: 3, userId: 2, name: "Someone else's", status: "ongoing" },
  ];
  const titles: (Title & { userId: number })[] = [{ id: 1, userId: 1, name: "Severance", kind: "series" }];
  const games: (Game & { userId: number })[] = [
    { id: 1, userId: 1, name: "Hades II" },
    { id: 2, userId: 2, name: "Someone else's game" },
  ];
  const rows = new Map<number, { userId: number; categoryId: number; state: ActivityState; updates: number }>();
  let nextId = 1;

  const toActivity = (id: number): Activity => {
    const r = rows.get(id)!;
    const s = r.state;
    const iso = (d: Date | null) => (d ? d.toISOString() : null);
    const base = {
      id, categoryId: r.categoryId, name: s.name, plannedStart: s.plannedStart.toISOString(), plannedEnd: s.plannedEnd.toISOString(),
      actualStart: iso(s.actualStart), actualEnd: iso(s.actualEnd), notes: s.notes, cancelledAt: iso(s.cancelledAt),
      labels: s.labels, createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z",
    };
    const d = s.details;
    switch (d.category) {
      case "workout": return { ...base, category: "workout", focus: d.focus, caloriesBurned: d.caloriesBurned, items: d.items };
      case "meals": return { ...base, category: "meals", totalCalories: d.totalCalories, items: d.items };
      case "work": {
        const p = projects.find((x) => x.id === d.projectId);
        return { ...base, category: "work", project: p ? { id: p.id, name: p.name } : null };
      }
      case "watch": {
        const t = titles.find((x) => x.id === d.titleId);
        return { ...base, category: "watch", title: t ? { id: t.id, name: t.name, kind: t.kind } : null };
      }
      case "gaming": {
        const g = games.find((x) => x.id === d.gameId);
        return { ...base, category: "gaming", game: g ? { id: g.id, name: g.name } : null };
      }
      case "misc": return { ...base, category: "misc" };
      case "sleep": return { ...base, category: "sleep" };
    }
  };

  const activities = {
    rows,
    async create(a: NewActivity) {
      const id = nextId++;
      const { userId, categoryId, ...state } = a;
      rows.set(id, { userId, categoryId, state, updates: 0 });
      return toActivity(id);
    },
    async findByIdForUser(id: number, userId: number) {
      const r = rows.get(id);
      return r && r.userId === userId ? toActivity(id) : null;
    },
    async update(id: number, userId: number, state: ActivityState) {
      const r = rows.get(id);
      if (!r || r.userId !== userId) return null;
      r.state = state;
      r.updates++;
      return toActivity(id);
    },
    async delete(id: number, userId: number) {
      const r = rows.get(id);
      if (!r || r.userId !== userId) return false;
      rows.delete(id);
      return true;
    },
    calls: [] as { from: Date; to: Date; category: CategorySlug | null }[],
    async listInRange(_userId: number, from: Date, to: Date, category: CategorySlug | null = null) {
      this.calls.push({ from, to, category });
      return [...rows.keys()].map(toActivity);
    },
  };
  const refs = {
    projects: { findByIdForUser: async (id: number, userId: number) => projects.find((p) => p.id === id && p.userId === userId) ?? null },
    titles: { findByIdForUser: async (id: number, userId: number) => titles.find((t) => t.id === id && t.userId === userId) ?? null },
    games: { findByIdForUser: async (id: number, userId: number) => games.find((g) => g.id === id && g.userId === userId) ?? null },
  };
  const settings = { getGracePeriods: async () => ({ ...grace }) };
  const categories = { findBySlug: async (slug: string) => CATEGORIES.find((c) => c.slug === slug) ?? null };
  return {
    grace, activities, refs, settings, projects,
    create: new CreateActivityService(categories, settings, refs, activities),
    update: new UpdateActivityService(settings, refs, activities),
  };
}

const t = (hhmm: string, day = 14) => `2026-11-${day}T${hhmm}:00.000Z`;
const base = { name: "Deep work", plannedStart: t("09:00"), plannedEnd: t("10:00") };

async function rejects(p: Promise<unknown>, status: number, msg?: RegExp) {
  await assert.rejects(p, (e: unknown) => e instanceof AppError && e.statusCode === status && (!msg || msg.test(e.message)));
}

test("create stores the labels computed with the current grace periods", async () => {
  const f = fakes();
  const pending = await f.create.execute(1, { category: "sleep", ...base });
  assert.deepEqual(pending.labels, ["pending"]);
  const lateOver = await f.create.execute(1, { category: "sleep", ...base, actualStart: t("09:15"), actualEnd: t("10:30") });
  assert.deepEqual(lateOver.labels, ["late", "overrun"]);
});

test("create validates names, times and the 24-hour limit", async () => {
  const f = fakes();
  await rejects(f.create.execute(1, { category: "sleep", ...base, name: "  " }), 400, /Name/);
  await rejects(f.create.execute(1, { category: "sleep", ...base, plannedEnd: t("08:00") }), 400, /Planned end/);
  await rejects(f.create.execute(1, { category: "sleep", ...base, plannedEnd: t("10:00", 15) }), 400, /24 hours/);
  await rejects(f.create.execute(1, { category: "sleep", ...base, actualEnd: t("10:00") }), 400, /actual start/);
  await rejects(f.create.execute(1, { category: "sleep", ...base, actualStart: t("09:30"), actualEnd: t("09:30") }), 400, /Actual end/);
});

test("create accepts sleep that crosses midnight", async () => {
  const f = fakes();
  const a = await f.create.execute(1, { category: "sleep", name: "Night", plannedStart: t("23:00"), plannedEnd: t("06:30", 15) });
  assert.equal(a.plannedEnd, t("06:30", 15));
});

test("category fields must match the category", async () => {
  const f = fakes();
  // A client that sends a field from another category is refused rather than silently ignored.
  const sleepWithFocus = { category: "sleep" as const, ...base, ...{ focus: "yoga" as const } };
  await rejects(f.create.execute(1, sleepWithFocus), 400, /focus/);
});

test("meals: the total is the sum of the items, or the typed total without items", async () => {
  const f = fakes();
  const withItems = await f.create.execute(1, {
    category: "meals", ...base, totalCalories: 999, items: [{ name: " Rice ", calories: 200 }, { name: "Fish", calories: 300 }],
  });
  assert.equal(withItems.category === "meals" && withItems.totalCalories, 500);
  assert.equal(withItems.category === "meals" && withItems.items[0]!.name, "Rice");
  const typed = await f.create.execute(1, { category: "meals", ...base, totalCalories: 450 });
  assert.equal(typed.category === "meals" && typed.totalCalories, 450);
});

test("workout items are validated", async () => {
  const f = fakes();
  const ok = await f.create.execute(1, { category: "workout", ...base, focus: "strength", caloriesBurned: 300, items: [{ name: "Squat", amount: 5, unit: "x" }] });
  assert.equal(ok.category === "workout" && ok.items.length, 1);
  await rejects(f.create.execute(1, { category: "workout", ...base, items: [{ name: "Squat", amount: 0, unit: "x" }] }), 400, /amount/);
  await rejects(f.create.execute(1, { category: "workout", ...base, items: [{ name: " ", amount: 1, unit: "x" }] }), 400, /name/);
});

test("work needs one of the user's ongoing projects; watch needs one of the user's titles", async () => {
  const f = fakes();
  const ok = await f.create.execute(1, { category: "work", ...base, projectId: 1 });
  assert.deepEqual(ok.category === "work" && ok.project, { id: 1, name: "Website" });
  await rejects(f.create.execute(1, { category: "work", ...base, projectId: 2 }), 400, /ongoing/);
  await rejects(f.create.execute(1, { category: "work", ...base, projectId: 3 }), 400, /not found/);
  await rejects(f.create.execute(1, { category: "watch", ...base, titleId: 99 }), 400, /not found/);
});

test("a project completed later can stay on the activity when other fields change", async () => {
  const f = fakes();
  const a = await f.create.execute(1, { category: "work", ...base, projectId: 1 });
  f.projects[0]!.status = "completed";
  const renamed = await f.update.execute(1, a.id, { name: "Renamed" });
  assert.equal(renamed.category === "work" && renamed.project?.id, 1);
});

test("update recomputes labels when a time changes", async () => {
  const f = fakes();
  const a = await f.create.execute(1, { category: "sleep", ...base });
  const started = await f.update.execute(1, a.id, { actualStart: t("09:12") });
  assert.deepEqual(started.labels, ["late"]);
  const ended = await f.update.execute(1, a.id, { actualEnd: t("10:20") });
  assert.deepEqual(ended.labels, ["late", "overrun"]);
});

test("a grace change never relabels: edits that don't touch times keep the stored labels", async () => {
  const f = fakes();
  const a = await f.create.execute(1, { category: "sleep", ...base, actualStart: t("09:12"), actualEnd: t("10:00") });
  assert.deepEqual(a.labels, ["late"]);
  f.grace.lateMinutes = 20; // an admin widens the grace period in the settings table
  const edited = await f.update.execute(1, a.id, { name: "Renamed", notes: "<p>hi</p>" });
  assert.deepEqual(edited.labels, ["late"]);
  // Sending the same times again is not a change either.
  const same = await f.update.execute(1, a.id, { actualStart: t("09:12") });
  assert.deepEqual(same.labels, ["late"]);
  // A real time change relabels with the grace in force now.
  const moved = await f.update.execute(1, a.id, { actualEnd: t("10:05") });
  assert.deepEqual(moved.labels, ["done"]);
});

test("update refuses a category change and fields from another category", async () => {
  const f = fakes();
  const a = await f.create.execute(1, { category: "sleep", ...base });
  await rejects(f.update.execute(1, a.id, { category: "work" }), 400, /category/);
  await rejects(f.update.execute(1, a.id, { projectId: 1 }), 400, /projectId/);
  // Repeating the same category is harmless.
  assert.equal((await f.update.execute(1, a.id, { category: "sleep", name: "Nap" })).name, "Nap");
});

test("update validates the merged times", async () => {
  const f = fakes();
  const a = await f.create.execute(1, { category: "sleep", ...base });
  await rejects(f.update.execute(1, a.id, { plannedEnd: t("08:00") }), 400, /Planned end/);
  await rejects(f.update.execute(1, a.id, { actualEnd: t("10:00") }), 400, /actual start/);
});

test("update replaces items and keeps untouched details", async () => {
  const f = fakes();
  const a = await f.create.execute(1, { category: "workout", ...base, focus: "yoga", caloriesBurned: 100, items: [{ name: "Flow", amount: 30, unit: "mins" }] });
  const u = await f.update.execute(1, a.id, { items: [] });
  assert.ok(u.category === "workout");
  assert.equal(u.focus, "yoga");
  assert.equal(u.caloriesBurned, 100);
  assert.deepEqual(u.items, []);
});

test("cancel stores {cancelled}; restore relabels from the times", async () => {
  const f = fakes();
  const a = await f.create.execute(1, { category: "sleep", ...base, actualStart: t("09:00"), actualEnd: t("10:00") });
  const cancel = new CancelActivityService(f.activities, () => new Date(t("11:00")));
  const c = await cancel.execute(1, a.id);
  assert.deepEqual(c.labels, ["cancelled"]);
  assert.equal(c.cancelledAt, t("11:00"));
  assert.deepEqual((await cancel.execute(1, a.id)).labels, ["cancelled"]); // idempotent
  // Editing a cancelled activity's times keeps it cancelled.
  assert.deepEqual((await f.update.execute(1, a.id, { actualEnd: t("10:30") })).labels, ["cancelled"]);
  const r = await new RestoreActivityService(f.settings, f.activities).execute(1, a.id);
  assert.equal(r.cancelledAt, null);
  assert.deepEqual(r.labels, ["overrun"]);
});

test("other users' activities are not found", async () => {
  const f = fakes();
  const a = await f.create.execute(1, { category: "sleep", ...base });
  await rejects(new GetActivityService(f.activities).execute(2, a.id), 404);
  await rejects(f.update.execute(2, a.id, { name: "x" }), 404);
  await rejects(new CancelActivityService(f.activities).execute(2, a.id), 404);
  await rejects(new DeleteActivityService(f.activities).execute(2, a.id), 404);
  await new DeleteActivityService(f.activities).execute(1, a.id);
  assert.equal(f.activities.rows.size, 0);
});

test("list validates the range", async () => {
  const f = fakes();
  const list = new ListActivitiesService(f.activities);
  await rejects(list.execute(1, "nope", t("10:00")), 400);
  await rejects(list.execute(1, t("10:00"), t("09:00")), 400, /after/);
  await rejects(list.execute(1, "2026-01-01T00:00:00Z", "2026-04-15T00:00:00Z"), 400, /92 days/);
  assert.deepEqual(await list.execute(1, "2026-11-09T00:00:00Z", "2026-11-16T00:00:00Z"), []);
});

test("list allows 92 days and passes the category filter on", async () => {
  const f = fakes();
  const list = new ListActivitiesService(f.activities);
  await list.execute(1, "2026-08-15T00:00:00Z", "2026-11-15T00:00:00Z", "work");
  await list.execute(1, "2026-11-09T00:00:00Z", "2026-11-16T00:00:00Z");
  assert.deepEqual(f.activities.calls.map((c) => c.category), ["work", null]);
});

test("gaming needs one of the user's games, and only gaming takes gameId", async () => {
  const f = fakes();
  const g = await f.create.execute(1, { category: "gaming", ...base, name: "Runs", gameId: 1 });
  assert.deepEqual(g.category === "gaming" && g.game, { id: 1, name: "Hades II" });
  assert.deepEqual(g.labels, ["pending"]);
  await rejects(f.create.execute(1, { category: "gaming", ...base, gameId: 2 }), 400, /Game not found/);
  await rejects(f.create.execute(1, { category: "gaming", ...base, gameId: 99 }), 400, /Game not found/);
  const watchWithGame = { category: "watch" as const, ...base, ...{ gameId: 1 } };
  await rejects(f.create.execute(1, watchWithGame), 400, /gameId/);
  const none = await f.create.execute(1, { category: "gaming", ...base });
  assert.equal(none.category === "gaming" && none.game, null);
  // Clearing the game, and keeping it while other fields change.
  const kept = await f.update.execute(1, g.id, { name: "More runs" });
  assert.deepEqual(kept.category === "gaming" && kept.game, { id: 1, name: "Hades II" });
  const cleared = await f.update.execute(1, g.id, { gameId: null });
  assert.equal(cleared.category === "gaming" && cleared.game, null);
});

test("misc has no category fields and keeps its category through updates", async () => {
  const f = fakes();
  const m = await f.create.execute(1, { category: "misc", ...base, name: "Groceries" });
  assert.equal(m.category, "misc");
  assert.deepEqual(m.labels, ["pending"]);
  const others: CategoryFieldsInput[] = [{ gameId: 1 }, { projectId: 1 }, { titleId: 1 }, { focus: "cardio" }, { totalCalories: 10 }, { items: [] }];
  for (const field of others) {
    await rejects(f.create.execute(1, { category: "misc", ...base, ...field }), 400, /does not apply to misc/);
    await rejects(f.update.execute(1, m.id, field), 400, /does not apply to misc/);
  }
  const done = await f.update.execute(1, m.id, { name: "Drive home", actualStart: t("09:00"), actualEnd: t("10:00") });
  assert.equal(done.category, "misc");
  assert.equal(done.name, "Drive home");
  assert.deepEqual(done.labels, ["done"]);
  await rejects(f.update.execute(1, m.id, { category: "sleep" }), 400, /can't be changed/);
});

test("create game is get-or-create, case-insensitive, and validates the name", async () => {
  const rows: Game[] = [{ id: 1, name: "Balatro" }];
  const repo = {
    findByName: async (_u: number, name: string) => rows.find((r) => r.name.toLowerCase() === name.toLowerCase()) ?? null,
    create: async (_u: number, name: string) => {
      const g = { id: rows.length + 1, name };
      rows.push(g);
      return g;
    },
  };
  const svc = new CreateGameService(repo);
  assert.deepEqual(await svc.execute(1, { name: "  balatro " }), { id: 1, name: "Balatro" });
  assert.deepEqual(await svc.execute(1, { name: "Elden Ring" }), { id: 2, name: "Elden Ring" });
  await rejects(svc.execute(1, { name: "   " }), 400, /required/);
  await rejects(svc.execute(1, { name: "x".repeat(121) }), 400, /at most/);
});

test("create project is get-or-create, case-insensitive", async () => {
  const rows: Project[] = [{ id: 1, name: "Website", status: "ongoing" }];
  const repo = {
    findByName: async (_u: number, name: string) => rows.find((p) => p.name.toLowerCase() === name.toLowerCase()) ?? null,
    create: async (_u: number, name: string) => {
      const p: Project = { id: rows.length + 1, name, status: "ongoing" };
      rows.push(p);
      return p;
    },
  };
  const svc = new CreateProjectService(repo);
  assert.equal((await svc.execute(1, { name: " website " })).id, 1);
  assert.equal((await svc.execute(1, { name: "Garden" })).id, 2);
  await rejects(svc.execute(1, { name: " " }), 400);
});
