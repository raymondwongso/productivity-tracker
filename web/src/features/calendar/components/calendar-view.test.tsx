import "@testing-library/jest-dom/vitest";
import type { Activity } from "@productivitytracker/shared";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";

const push = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/calendar",
  useSearchParams: () => search,
}));
const apiGet = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  apiGet: (...a: unknown[]) => apiGet(...a),
}));

import { CalendarView } from "./calendar-view";

const local = (d: number, hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(2026, 10, d, h, m).toISOString();
};
const activity = (id: number, day: number, s: string, e: string, labels: Activity["labels"]): Activity => ({
  id, category: "sleep", categoryId: 1, name: `Act ${id}`, plannedStart: local(day, s), plannedEnd: local(day, e),
  actualStart: null, actualEnd: null, notes: "", cancelledAt: null, labels, createdAt: "", updatedAt: "",
});

beforeEach(() => {
  push.mockReset();
  search = new URLSearchParams("date=2026-11-14");
  apiGet.mockReset().mockImplementation(async (path: string) => {
    if (path === "/categories") return [{ id: 1, slug: "sleep", name: "Sleep", color: "#9dcffa", sortOrder: 1 }];
    if (path.startsWith("/activities")) return [activity(1, 10, "09:00", "10:00", ["late", "overrun"]), activity(2, 12, "13:00", "14:00", ["pending"])];
    return {};
  });
});
afterEach(cleanup);

describe("CalendarView", () => {
  it("defaults to the Monday–Sunday week and asks the API for exactly that range", async () => {
    renderWithProviders(<CalendarView />);
    expect(screen.getByRole("heading", { name: "Nov 9 – 15, 2026" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Week" })).toHaveAttribute("aria-pressed", "true");
    const from = new Date(2026, 10, 9).toISOString();
    const to = new Date(2026, 10, 16).toISOString();
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith(`/activities?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`));
    expect(await screen.findByRole("button", { name: /Sleep: Act 1/ })).toBeInTheDocument();
  });

  it("counts every label of every activity in view", async () => {
    renderWithProviders(<CalendarView />);
    await screen.findByRole("button", { name: /Sleep: Act 1/ });
    const legend = screen.getByLabelText("Labels in this range");
    expect(legend).toHaveTextContent("2 activities in view");
    const countOf = (label: string) => [...legend.querySelectorAll("span.inline-flex")].find((s) => s.textContent?.startsWith(label))?.textContent;
    expect(countOf("late")).toBe("late1");
    expect(countOf("overrun")).toBe("overrun1");
    expect(countOf("pending")).toBe("pending1");
    expect(countOf("done")).toBe("done0");
  });

  it("switches views and steps through weeks via the URL", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CalendarView />);
    await user.click(screen.getByRole("button", { name: "Month" }));
    expect(push).toHaveBeenLastCalledWith("/calendar?view=month&date=2026-11-14", { scroll: false });
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(push).toHaveBeenLastCalledWith("/calendar?view=week&date=2026-11-21", { scroll: false });
  });

  it("opens the category picker for New activity and the editor for a card", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CalendarView />);
    await user.click(screen.getByRole("button", { name: "New activity" }));
    expect(screen.getByRole("dialog", { name: "New activity" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(await screen.findByRole("button", { name: /Sleep: Act 1/ }));
    expect(screen.getByRole("dialog", { name: "Act 1" })).toBeInTheDocument();
  });

  it("shows the month grid with every day of the covering weeks", async () => {
    search = new URLSearchParams("view=month&date=2026-11-14");
    renderWithProviders(<CalendarView />);
    expect(screen.getByRole("heading", { name: "November 2026" })).toBeInTheDocument();
    expect(await screen.findByTitle(/Sleep: Act 1/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(42);
  });
});

describe("CalendarView on a phone", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", (query: string) => ({ media: query, matches: true, addEventListener: () => {}, removeEventListener: () => {} }));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fits the week as seven day columns, and a tap anywhere in one (even on an activity) opens that day", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CalendarView />);
    expect(screen.getByLabelText("Week overview")).toBeInTheDocument();
    expect(screen.queryByLabelText("Time grid")).not.toBeInTheDocument();
    expect(screen.getByText("Week view · tap a day to open it")).toBeInTheDocument();
    expect(screen.queryByText(/click an empty slot/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(7);
    expect(await screen.findByRole("button", { name: "Open Thu Nov 12 2026, 1 activity" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Wed Nov 11 2026, 0 activities" })).toBeInTheDocument();

    await user.click(screen.getByTitle("Act 2 · 13:00–14:00"));
    expect(push).toHaveBeenLastCalledWith("/calendar?view=day&date=2026-11-12", { scroll: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("fits the month as one tap target per day that opens the day", async () => {
    search = new URLSearchParams("view=month&date=2026-11-14");
    const user = userEvent.setup();
    renderWithProviders(<CalendarView />);
    expect(screen.getAllByRole("button", { name: /^Open / })).toHaveLength(42);
    const tue = await screen.findByRole("button", { name: "Open Tue Nov 10 2026, 1 activity" });
    expect(tue.querySelectorAll("i")).toHaveLength(1);
    await user.click(tue);
    expect(push).toHaveBeenLastCalledWith("/calendar?view=day&date=2026-11-10", { scroll: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the day view's time grid", () => {
    search = new URLSearchParams("view=day&date=2026-11-10");
    renderWithProviders(<CalendarView />);
    expect(screen.getByLabelText("Time grid")).toBeInTheDocument();
    expect(screen.queryByLabelText("Week overview")).not.toBeInTheDocument();
  });
});
