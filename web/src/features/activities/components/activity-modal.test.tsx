import "@testing-library/jest-dom/vitest";
import type { Activity, Category } from "@productivitytracker/shared";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import { renderWithProviders } from "@/test/render";

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPatch = vi.fn();
const apiDelete = vi.fn();
vi.mock("@/lib/api-client", async (orig) => ({
  ...(await orig<typeof import("@/lib/api-client")>()),
  apiGet: (...a: unknown[]) => apiGet(...a),
  apiPost: (...a: unknown[]) => apiPost(...a),
  apiPatch: (...a: unknown[]) => apiPatch(...a),
  apiDelete: (...a: unknown[]) => apiDelete(...a),
}));
// The Tiptap editor needs real layout APIs; a textarea stands in for it here.
vi.mock("./rich-text", () => ({
  RichText: ({ value, onChange, labelledBy }: { value: string; onChange: (v: string) => void; labelledBy: string }) => (
    <textarea aria-labelledby={labelledBy} value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

import { ActivityModal } from "./activity-modal";

const GRACE = { lateMinutes: 10, prematureMinutes: 15, overrunMinutes: 15 };
beforeEach(() => {
  apiGet.mockReset().mockImplementation(async (path: string) => {
    if (path.startsWith("/settings")) return GRACE;
    if (path.startsWith("/projects")) return [{ id: 1, name: "Website", status: "ongoing" }];
    if (path.startsWith("/titles")) return [{ id: 1, name: "Severance", kind: "series" }];
    return [];
  });
  apiPost.mockReset();
  apiPatch.mockReset();
  apiDelete.mockReset();
});
afterEach(cleanup);

const cat = (slug: Category["slug"], name: string): Category => ({ id: 1, slug, name, color: "#e0d00d", sortOrder: 1 });
const start = new Date(2026, 10, 14, 9, 0);
const at = (hhmm: string) => new Date(`2026-11-14T${hhmm}`).toISOString();

describe("ActivityModal, new activity", () => {
  it("renders the workout fields with the right controls", async () => {
    renderWithProviders(<ActivityModal target={{ kind: "new", category: cat("workout", "Workout"), start }} category={cat("workout", "Workout")} onClose={() => {}} />);
    expect(screen.getByRole("dialog", { name: "New activity" })).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveAttribute("id", "f-name");
    expect(screen.getByRole("button", { name: "Focus Choose a focus" })).toHaveAttribute("aria-haspopup", "listbox");
    expect(screen.getByLabelText("Calorie burn (kcal)")).toHaveAttribute("type", "number");
    expect(screen.getByLabelText("Planned start")).toHaveAttribute("type", "datetime-local");
    expect(screen.getByLabelText("Actual end")).toHaveAttribute("type", "datetime-local");
    expect(screen.getByRole("button", { name: "Add workout item" })).toBeInTheDocument();
    // No cancel or delete for something that doesn't exist yet.
    expect(screen.queryByRole("button", { name: /Delete|Cancel activity/ })).not.toBeInTheDocument();
  });

  it("previews several labels as the actual times change", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ActivityModal target={{ kind: "new", category: cat("work", "Work"), start }} category={cat("work", "Work")} onClose={() => {}} />);
    expect(await screen.findAllByText("pending")).not.toHaveLength(0);
    const as = screen.getByLabelText("Actual start");
    await user.clear(as);
    await user.type(as, "2026-11-14T09:15");
    const ae = screen.getByLabelText("Actual end");
    await user.type(ae, "2026-11-14T10:30");
    await waitFor(() => expect(screen.getAllByText("late").length).toBeGreaterThan(0));
    expect(screen.getAllByText("overrun").length).toBeGreaterThan(0);
  });

  it("fills both actual times from the planned times in one click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ActivityModal target={{ kind: "new", category: cat("work", "Work"), start }} category={cat("work", "Work")} onClose={() => {}} />);
    expect(screen.queryByRole("button", { name: "Now" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use planned times" }));
    expect(screen.getByLabelText("Actual start")).toHaveValue("2026-11-14T09:00");
    expect(screen.getByLabelText("Actual end")).toHaveValue("2026-11-14T10:00");
    await waitFor(() => expect(screen.getAllByText("done").length).toBeGreaterThan(0));

    // Follows the planned times as they are now, and can be cleared again.
    await user.clear(screen.getByLabelText("Planned end"));
    expect(screen.getByRole("button", { name: "Use planned times" })).toBeDisabled();
    await user.type(screen.getByLabelText("Planned end"), "2026-11-14T11:30");
    await user.click(screen.getByRole("button", { name: "Use planned times" }));
    expect(screen.getByLabelText("Actual end")).toHaveValue("2026-11-14T11:30");
    await user.click(screen.getByRole("button", { name: "Clear actual times" }));
    expect(screen.getByLabelText("Actual start")).toHaveValue("");
  });

  it("validates before sending, then posts the category's fields", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    apiPost.mockResolvedValue({});
    renderWithProviders(<ActivityModal target={{ kind: "new", category: cat("meals", "Meals"), start }} category={cat("meals", "Meals")} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: /Create activity/ }));
    expect(screen.getByText("Give the activity a name.")).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Name"), "Lunch");
    await user.click(screen.getByRole("button", { name: "Add meal item" }));
    await user.type(screen.getByLabelText("Item 1 name"), "Rice");
    const cals = screen.getByLabelText("Item 1 calories (kcal)");
    await user.clear(cals);
    await user.type(cals, "250");
    expect(screen.getByLabelText("Total calories (kcal)")).toHaveValue(250);
    expect(screen.getByLabelText("Total calories (kcal)")).toHaveAttribute("readonly");

    await user.click(screen.getByRole("button", { name: /Create activity/ }));
    await waitFor(() => expect(apiPost).toHaveBeenCalled());
    expect(apiPost).toHaveBeenCalledWith("/activities", expect.objectContaining({
      category: "meals", name: "Lunch", items: [{ name: "Rice", calories: 250 }], totalCalories: null,
      plannedStart: new Date(2026, 10, 14, 9, 0).toISOString(), plannedEnd: new Date(2026, 10, 14, 9, 45).toISOString(),
    }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("shows the API's error message and stays open", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    apiPost.mockRejectedValue(new ApiError(400, "Choose an ongoing project"));
    renderWithProviders(<ActivityModal target={{ kind: "new", category: cat("work", "Work"), start }} category={cat("work", "Work")} onClose={onClose} />);
    await user.type(screen.getByLabelText("Name"), "Build");
    await user.click(screen.getByRole("button", { name: /Create activity/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Choose an ongoing project");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("lists only ongoing projects and can create one from the dropdown", async () => {
    const user = userEvent.setup();
    // A stateful stand-in for the API: a created project shows up in later lists.
    const projects = [{ id: 1, name: "Website", status: "ongoing" }];
    apiGet.mockImplementation(async (p: string) => (p.startsWith("/projects") ? [...projects] : GRACE));
    apiPost.mockImplementation(async (path: string, body: { name: string }) => {
      const created = { id: 9, name: body.name, status: "ongoing" };
      if (path === "/projects") projects.push(created);
      return created;
    });
    renderWithProviders(<ActivityModal target={{ kind: "new", category: cat("work", "Work"), start }} category={cat("work", "Work")} onClose={() => {}} />);
    expect(apiGet).toHaveBeenCalledWith("/projects?status=ongoing");
    await user.click(screen.getByRole("button", { name: "Project Choose an ongoing project" }));
    await user.click(await screen.findByRole("button", { name: "Create new" }));
    await user.type(screen.getByLabelText("Project name"), "Garden{Enter}");
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/projects", { name: "Garden" }));
    expect(await screen.findByRole("button", { name: "Project Garden" })).toBeInTheDocument();
  });
});

describe("ActivityModal, gaming", () => {
  it("picks a game, can create one, and sends gameId", async () => {
    const user = userEvent.setup();
    const games = [{ id: 1, name: "Hades II" }];
    apiGet.mockImplementation(async (p: string) => (p.startsWith("/games") ? [...games] : GRACE));
    apiPost.mockImplementation(async (path: string, body: { name: string }) => {
      if (path === "/games") {
        const g = { id: 4, name: body.name };
        games.push(g);
        return g;
      }
      return { id: 50 };
    });
    renderWithProviders(<ActivityModal target={{ kind: "new", category: cat("gaming", "Gaming"), start }} category={cat("gaming", "Gaming")} onClose={() => {}} />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith("/games"));
    expect(screen.getByLabelText("Name")).toHaveAttribute("placeholder", "e.g. Evening session");
    await user.click(screen.getByRole("button", { name: "Game Choose a game" }));
    await user.click(await screen.findByRole("button", { name: "Create new" }));
    await user.type(screen.getByLabelText("Game name"), "Balatro{Enter}");
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/games", { name: "Balatro" }));
    expect(await screen.findByRole("button", { name: "Game Balatro" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "Runs");
    await user.click(screen.getByRole("button", { name: /Create activity/ }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/activities", expect.objectContaining({ category: "gaming", name: "Runs", gameId: 4 })));
  });
});

describe("ActivityModal, misc", () => {
  it("has no category fields and sends only the shared ones", async () => {
    const user = userEvent.setup();
    apiPost.mockResolvedValue({ id: 51 });
    renderWithProviders(<ActivityModal target={{ kind: "new", category: cat("misc", "Misc"), start }} category={cat("misc", "Misc")} onClose={() => {}} />);
    expect(screen.getByLabelText("Name")).toHaveAttribute("placeholder", "e.g. Groceries");
    expect(screen.getByLabelText("Planned end")).toHaveValue("2026-11-14T09:30");
    expect(screen.queryByRole("button", { name: /^(Game|Project|Focus)/ })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Name"), "Supermarket");
    await user.click(screen.getByRole("button", { name: /Create activity/ }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/activities", expect.objectContaining({ category: "misc", name: "Supermarket" })));
    const body = apiPost.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["actualEnd", "actualStart", "category", "name", "notes", "plannedEnd", "plannedStart"]);
  });
});

describe("ActivityModal, existing activity", () => {
  const stored: Activity = {
    id: 5, category: "sleep", categoryId: 1, name: "Night sleep", plannedStart: at("09:00"), plannedEnd: at("10:00"),
    actualStart: at("09:12"), actualEnd: at("10:00"), notes: "", cancelledAt: null, labels: ["late"], createdAt: "", updatedAt: "",
  };

  it("patches changes and keeps the stored labels when no time changed", async () => {
    const user = userEvent.setup();
    apiPatch.mockResolvedValue(stored);
    // The grace period was widened since: a fresh computation would say "done".
    apiGet.mockImplementation(async (p: string) => (p.startsWith("/settings") ? { ...GRACE, lateMinutes: 30 } : []));
    renderWithProviders(<ActivityModal target={{ kind: "edit", activity: stored }} category={cat("sleep", "Sleep")} onClose={() => {}} />);
    expect(screen.getAllByText("late").length).toBeGreaterThan(0);
    await user.type(screen.getByLabelText("Name"), " (short)");
    expect(screen.getAllByText("late").length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: /Save changes/ }));
    await waitFor(() => expect(apiPatch).toHaveBeenCalledWith("/activities/5", expect.objectContaining({ name: "Night sleep (short)" })));
    expect(apiPatch.mock.calls[0]![1]).not.toHaveProperty("category");
  });

  it("cancels through the API and asks twice before deleting", async () => {
    const user = userEvent.setup();
    apiPost.mockResolvedValue({ ...stored, cancelledAt: at("11:00"), labels: ["cancelled"] });
    apiDelete.mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderWithProviders(<ActivityModal target={{ kind: "edit", activity: stored }} category={cat("sleep", "Sleep")} onClose={onClose} />);
    await user.click(screen.getByRole("button", { name: "Cancel activity" }));
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith("/activities/5/cancel"));
    expect(await screen.findByRole("button", { name: "Restore activity" })).toBeInTheDocument();
    expect(screen.getAllByText("cancelled").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(apiDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Click again to delete" }));
    await waitFor(() => expect(apiDelete).toHaveBeenCalledWith("/activities/5"));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
