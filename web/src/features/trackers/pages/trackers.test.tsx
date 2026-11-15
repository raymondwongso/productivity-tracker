import "@testing-library/jest-dom/vitest";
import type { FitnessStats, SleepStats, WorkActivity, WorkStats } from "@productivitytracker/shared";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";

const replace = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  usePathname: () => "/tracker",
  useSearchParams: () => search,
}));
const apiGet = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  apiGet: (...a: unknown[]) => apiGet(...a),
}));

import { FitnessTracker } from "./fitness-tracker";
import { SleepTracker } from "./sleep-tracker";
import { TimeTracker } from "./time-tracker";

const DAYS = ["2026-10-01", "2026-10-02", "2026-10-03"];
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const statsPath = (kind: string) => `/stats/${kind}?from=2026-10-01&to=2026-10-03&tz=${encodeURIComponent(tz)}`;

const sleep: SleepStats = {
  summary: {
    trackedDays: 3, onScheduleDays: 1, lateDays: 1, prematureDays: 1, overrunDays: 0,
    sleptMinutes: 1320, lateMinutes: 20, prematureMinutes: 40, unloggedDays: 0, averagedDays: 3,
  },
  days: DAYS.map((date, i) => ({
    date, labels: i === 1 ? ["late", "premature"] : ["done"], sleptMinutes: [450, 390, 480][i]!, lateMinutes: i === 1 ? 20 : 0,
    prematureMinutes: i === 1 ? 40 : 0, onSchedule: i !== 1, unlogged: false,
    main: { activityId: i + 1, plannedStart: `${date}T16:00:00.000Z`, plannedEnd: `${date}T23:30:00.000Z`, actualStart: `${date}T16:00:00.000Z`, actualEnd: `${date}T23:30:00.000Z`, labels: ["done"] },
  })),
};
const fitness: FitnessStats = {
  averagedDays: 2, // the range runs one day past today
  workout: {
    sessions: 2, minutes: 100, caloriesBurned: 600, notCounted: 1,
    focus: [{ focus: "cardio", sessions: 1, minutes: 40 }, { focus: null, sessions: 1, minutes: 60 }],
    days: DAYS.map((date, i) => ({ date, minutes: [60, 40, 0][i]!, caloriesBurned: [400, 200, 0][i]! })),
  },
  meals: { meals: 4, calories: 3000, notCounted: 0, days: DAYS.map((date, i) => ({ date, calories: [1800, 1200, 0][i]! })) },
  diet: { days: DAYS.map((date, i) => ({ date, consumed: [1800, 1200, 0][i]!, burned: [400, 200, 0][i]!, net: [1400, 1000, 0][i]! })) },
};
const work: WorkStats = {
  averagedDays: 3, minutes: 300, sessions: 2, notCounted: 0,
  parts: [{ id: 1, name: "Website", minutes: 180, sessions: 1 }, { id: null, name: "No project", minutes: 120, sessions: 1 }],
  days: DAYS.map((date, i) => ({ date, minutes: [180, 120, 0][i]! })),
};
const task = (id: number, day: string, o: Partial<WorkActivity> = {}): WorkActivity => ({
  id, category: "work", categoryId: 2, name: `Task ${id}`, plannedStart: new Date(`${day}T09:00`).toISOString(), plannedEnd: new Date(`${day}T10:00`).toISOString(),
  actualStart: null, actualEnd: null, notes: "", cancelledAt: null, labels: ["pending"], seriesId: null, createdAt: "", updatedAt: "", project: { id: 1, name: "Website" }, ...o,
});

beforeEach(() => {
  replace.mockReset();
  search = new URLSearchParams("from=2026-10-01&to=2026-10-03");
  apiGet.mockReset().mockImplementation(async (path: string) => {
    if (path.startsWith("/stats/sleep")) return sleep;
    if (path.startsWith("/stats/fitness")) return fitness;
    if (path.startsWith("/stats/")) return work;
    if (path.startsWith("/activities")) return [task(1, "2026-10-02"), task(2, "2026-10-01", { actualStart: new Date("2026-10-01T09:00").toISOString(), actualEnd: new Date("2026-10-01T10:00").toISOString(), labels: ["done"] }), task(3, "2026-10-09")];
    if (path === "/categories") return [{ id: 2, slug: "work", name: "Work", color: "#b67747", sortOrder: 2 }];
    return [];
  });
});
afterEach(cleanup);

describe("Sleep Tracker", () => {
  it("asks for the URL's range in the browser's zone and shows the sleep answers", async () => {
    renderWithProviders(<SleepTracker />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(statsPath("sleep")));
    expect(await screen.findByText("Time lost to late and premature sleep")).toBeInTheDocument();
    expect(screen.getByText("1 h")).toBeInTheDocument(); // 20 + 40 minutes lost
    // 1320 minutes over 3 days
    expect(screen.getByText("Sleep per day").nextSibling).toHaveTextContent("7 h 20 min");
    expect(screen.getByText("average over 3 days, Oct 1 – Oct 3")).toBeInTheDocument();
    for (const name of ["Bedtime and wake-up", "Hours slept per day", "Time lost per day"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("img", { name: /^Hours slept per day, Oct 1 to Oct 3/ })).toBeInTheDocument();
  });

  it("switches presets through the URL", async () => {
    renderWithProviders(<SleepTracker />);
    await userEvent.click(screen.getByRole("button", { name: "30 days" }));
    expect(replace).toHaveBeenCalledWith("/tracker?range=30d", { scroll: false });
    // This month is the default, so choosing it clears the query.
    await userEvent.click(screen.getByRole("button", { name: "This month" }));
    expect(replace).toHaveBeenLastCalledWith("/tracker", { scroll: false });
    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("From")).toHaveValue("2026-10-01");
  });
});

describe("Fitness Tracker", () => {
  it("shows Workout, Meals and Diet in that order, every chart full width", async () => {
    renderWithProviders(<FitnessTracker />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(statsPath("fitness")));
    await screen.findByRole("region", { name: "Focus" });
    const sections = screen.getAllByRole("region").filter((r) => ["Workout", "Meals", "Diet"].includes(r.getAttribute("aria-label") ?? ""));
    expect(sections.map((r) => r.getAttribute("aria-label"))).toEqual(["Workout", "Meals", "Diet"]);
    const charts = ["Focus", "Calories burned per day", "Minutes working out per day", "Calories consumed per day", "Consumed and burned per day"];
    for (const name of charts) expect(screen.getByRole("region", { name })).toHaveAttribute("data-span", "true");
  });

  it("averages per day over the days up to today only", async () => {
    renderWithProviders(<FitnessTracker />);
    const meals = await screen.findByRole("region", { name: "Meals" });
    // 3000 kcal over the 2 days so far, not the 3 in the range.
    expect(within(meals).getByText("Per day").nextSibling).toHaveTextContent("1,500 kcal");
    expect(within(meals).getAllByText("average over 2 days, Oct 1 – Oct 2")).not.toHaveLength(0);
    const diet = screen.getByRole("region", { name: "Diet" });
    expect(within(diet).getByText("Net per day").nextSibling).toHaveTextContent("+1,200 kcal");
    const workout = screen.getByRole("region", { name: "Workout" });
    expect(within(workout).getByText("1 workout in this range has no actual end, so it isn't counted.")).toBeInTheDocument();
    expect(within(workout).getByText("No focus")).toBeInTheDocument();
  });
});

describe("Work Tracker", () => {
  it("shows hours by project and a read-only board of the range's work", async () => {
    renderWithProviders(<TimeTracker kind="work" />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(statsPath("work")));
    expect(await screen.findByRole("region", { name: "Time by project" })).toHaveTextContent("Website");
    const from = new Date(2026, 9, 1).toISOString();
    const to = new Date(2026, 9, 4).toISOString();
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(`/activities?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&category=work`));
    const pending = await screen.findByRole("region", { name: "Pending" });
    // Task 3 is outside the range.
    expect(await within(pending).findByText("Task 1")).toBeInTheDocument();
    expect(within(pending).queryByText("Task 3")).toBeNull();
    expect(within(screen.getByRole("region", { name: "Done" })).getByText("Task 2")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Project" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark done/ })).toBeNull();
  });
});

describe("Gaming Tracker", () => {
  it("shows hours by game and per day, without a board", async () => {
    renderWithProviders(<TimeTracker kind="gaming" />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(statsPath("gaming")));
    expect(await screen.findByRole("heading", { name: "Gaming Tracker" })).toBeInTheDocument();
    expect(await screen.findByRole("region", { name: "Time by game" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Hours playing per day" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Board" })).toBeNull();
  });
});

describe("default range", () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    ["Sleep", "sleep", () => <SleepTracker />],
    ["Fitness", "fitness", () => <FitnessTracker />],
    ["Work", "work", () => <TimeTracker kind="work" />],
    ["Cinema", "cinema", () => <TimeTracker kind="cinema" />],
    ["Gaming", "gaming", () => <TimeTracker kind="gaming" />],
  ])("%s opens on this month when the URL has no range", async (_name, kind, page) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 15, 12));
    search = new URLSearchParams();
    renderWithProviders(page());
    expect(screen.getByRole("button", { name: "This month" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "false");
    // The subtitle names the preset, so "30 days" in November isn't mistaken for the 30-day preset.
    expect(screen.getByText("This month", { selector: "b" }).parentElement).toHaveTextContent(/^This month · Nov 1 – Nov 30, 2026 · finished/);
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(`/stats/${kind}?from=2026-11-01&to=2026-11-30&tz=${encodeURIComponent(tz)}`));
  });
});
