import "@testing-library/jest-dom/vitest";
import type { Activity, ActivityBase, Category } from "@productivitytracker/shared";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ActivityCard } from "./activity-card";

afterEach(cleanup);

const at = (hhmm: string) => new Date(`2026-11-14T${hhmm}`).toISOString();
const base: ActivityBase = {
  id: 1, categoryId: 1, name: "Thing", plannedStart: at("09:00"), plannedEnd: at("10:00"), actualStart: at("09:15"), actualEnd: at("10:30"),
  notes: "<p>Keep <strong>focus</strong></p>", cancelledAt: null, labels: ["late", "overrun"], createdAt: "", updatedAt: "",
};
const cat = (name: string): Category => ({ id: 1, slug: "sleep", name, color: "#9dcffa", sortOrder: 1 });

/** Row keys in render order: the design fixes this order per category. */
const rowKeys = (el: HTMLElement) =>
  [...el.querySelectorAll("span.uppercase.w-\\[46px\\]")].map((k) => k.textContent);

describe("ActivityCard", () => {
  it("sleep: planned, actual, notes", () => {
    const { container } = render(<ActivityCard activity={{ ...base, category: "sleep" }} category={cat("Sleep")} onOpen={() => {}} />);
    expect(rowKeys(container)).toEqual(["Planned", "Actual"]);
    expect(screen.getByText("09:00 → 10:00")).toBeInTheDocument();
    expect(screen.getByText("09:15 → 10:30")).toBeInTheDocument();
    expect(screen.getByText("focus").tagName).toBe("STRONG");
  });

  it("shows every stored label", () => {
    render(<ActivityCard activity={{ ...base, category: "sleep" }} category={cat("Sleep")} onOpen={() => {}} />);
    expect(screen.getByText("late")).toBeInTheDocument();
    expect(screen.getByText("overrun")).toBeInTheDocument();
  });

  it("workout: focus and calorie burn come before the times", () => {
    const a: Activity = { ...base, category: "workout", focus: "strength", caloriesBurned: 320, items: [] };
    const { container } = render(<ActivityCard activity={a} category={cat("Workout")} onOpen={() => {}} />);
    expect(rowKeys(container)).toEqual(["Focus", "Burn", "Planned", "Actual"]);
    expect(screen.getByText("Strength")).toBeInTheDocument();
    expect(screen.getByText("320 kcal burned")).toBeInTheDocument();
  });

  it("meals: calories under the header, items after the notes", () => {
    const a: Activity = { ...base, category: "meals", totalCalories: 510, items: [{ name: "Rice", calories: 200 }, { name: "Fish", calories: 310 }] };
    const { container } = render(<ActivityCard activity={a} category={cat("Meals")} onOpen={() => {}} />);
    expect(rowKeys(container)).toEqual(["Intake", "Planned", "Actual"]);
    expect(screen.getByText("510 kcal")).toBeInTheDocument();
    const notes = screen.getByText("focus").closest("div.rich-notes")!;
    const items = screen.getByText("Rice").closest("ul")!;
    expect(notes.compareDocumentPosition(items) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("work and watch: the project or title under the header", () => {
    const work: Activity = { ...base, category: "work", project: { id: 1, name: "Website" } };
    const { container, unmount } = render(<ActivityCard activity={work} category={cat("Work")} onOpen={() => {}} />);
    expect(rowKeys(container)[0]).toBe("Project");
    expect(screen.getByText("Website")).toBeInTheDocument();
    unmount();
    const watch: Activity = { ...base, category: "watch", title: { id: 1, name: "Past Lives", kind: "movie" } };
    const r = render(<ActivityCard activity={watch} category={cat("Watch")} onOpen={() => {}} />);
    expect(rowKeys(r.container)[0]).toBe("Movie");
  });

  it("gaming: the game under the header", () => {
    const gaming: Activity = { ...base, category: "gaming", game: { id: 1, name: "Balatro" } };
    const { container, unmount } = render(<ActivityCard activity={gaming} category={cat("Gaming")} onOpen={() => {}} />);
    expect(rowKeys(container)).toEqual(["Game", "Planned", "Actual"]);
    expect(screen.getByText("Balatro")).toBeInTheDocument();
    unmount();
    render(<ActivityCard activity={{ ...gaming, game: null }} category={cat("Gaming")} onOpen={() => {}} />);
    expect(screen.getByText("No game")).toBeInTheDocument();
  });

  it("misc: planned, actual, notes", () => {
    const { container } = render(<ActivityCard activity={{ ...base, category: "misc" }} category={cat("Misc")} onOpen={() => {}} />);
    expect(rowKeys(container)).toEqual(["Planned", "Actual"]);
    expect(screen.getByText("focus").tagName).toBe("STRONG");
  });

  it("cancelled cards strike the name; compact cards keep only the header", () => {
    const a: Activity = { ...base, category: "sleep", cancelledAt: at("08:00"), labels: ["cancelled"] };
    const { container } = render(<ActivityCard activity={a} category={cat("Sleep")} compact onOpen={() => {}} />);
    expect(screen.getByText("Thing")).toHaveClass("line-through");
    expect(rowKeys(container)).toEqual([]);
    expect(screen.getByText("09:00")).toBeInTheDocument();
  });

  it("opens on click and with the keyboard", async () => {
    const onOpen = vi.fn();
    render(<ActivityCard activity={{ ...base, category: "sleep" }} category={cat("Sleep")} onOpen={onOpen} />);
    const card = screen.getByRole("button", { name: /Sleep: Thing/ });
    await userEvent.click(card);
    card.focus();
    await userEvent.keyboard("{Enter}");
    expect(onOpen).toHaveBeenCalledTimes(2);
  });
});
