import "@testing-library/jest-dom/vitest";
import type { WorkActivity } from "@productivitytracker/shared";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkBoard } from "./work-board";

afterEach(cleanup);

const at = (d: number, hhmm: string) => new Date(`2026-11-${String(d).padStart(2, "0")}T${hhmm}`).toISOString();
const work = (id: number, d: number, o: Partial<WorkActivity> = {}): WorkActivity => ({
  id, category: "work", categoryId: 2, name: `Task ${id}`, plannedStart: at(d, "09:00"), plannedEnd: at(d, "10:00"),
  actualStart: null, actualEnd: null, notes: "", cancelledAt: null, labels: ["pending"], seriesId: null, createdAt: "", updatedAt: "",
  project: { id: 1, name: "Website" }, ...o,
});
const NOW = new Date(2026, 10, 15, 12);
const list = [
  work(1, 12), // pending, overdue
  work(2, 10, { actualStart: at(10, "09:00"), actualEnd: at(10, "10:00"), labels: ["done"] }),
  work(3, 14, { actualStart: at(14, "09:20"), actualEnd: at(14, "10:00"), labels: ["late"], project: { id: 2, name: "Q4 reporting" } }),
  work(4, 16, { project: null }), // pending, upcoming
  work(5, 13, { actualStart: at(13, "09:00"), cancelledAt: at(13, "08:00"), labels: ["cancelled"] }),
  work(6, 11, { actualStart: at(11, "09:00"), labels: [], project: { id: 2, name: "Q4 reporting" } }), // in progress
];
const titles = (col: string) => within(screen.getByRole("region", { name: col })).queryAllByRole("button").map((b) => b.querySelector(".text-sm")?.textContent);

describe("WorkBoard", () => {
  it("lists pending (oldest first) and done (newest first), without cancelled work", () => {
    render(<WorkBoard activities={list} onOpen={() => {}} now={NOW} />);
    expect(titles("Pending")).toEqual(["Task 6", "Task 1", "Task 4"]);
    expect(titles("Done")).toEqual(["Task 3", "Task 2"]);
    expect(screen.getByText("overdue")).toBeInTheDocument();
    expect(screen.getByText("in progress")).toBeInTheDocument();
  });

  it("is read-only: no drag handles or move buttons, and a click opens the activity", async () => {
    const onOpen = vi.fn();
    const { container } = render(<WorkBoard activities={list} onOpen={onOpen} now={NOW} />);
    expect(container.querySelector("[draggable]")).toBeNull();
    expect(screen.queryByRole("button", { name: /Mark done|Move to pending/ })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: /Task 3/ }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  it("filters the board by project, with counts", async () => {
    const user = userEvent.setup();
    render(<WorkBoard activities={list} onOpen={() => {}} now={NOW} />);
    const select = screen.getByRole("combobox", { name: "Project" });
    expect([...select.querySelectorAll("option")].map((o) => o.textContent)).toEqual([
      "All projects (5)", "Q4 reporting (2)", "Website (2)", "No project (1)",
    ]);
    await user.selectOptions(select, "Q4 reporting (2)");
    expect(titles("Pending")).toEqual(["Task 6"]);
    expect(titles("Done")).toEqual(["Task 3"]);
    await user.selectOptions(select, "No project (1)");
    expect(titles("Pending")).toEqual(["Task 4"]);
    expect(within(screen.getByRole("region", { name: "Done" })).getByText("Nothing finished in this range yet.")).toBeInTheDocument();
  });
});
