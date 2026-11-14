import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SHARE, SHARE_OTHER } from "../colors";
import { foldParts, ShareDonut, slicePaths, type SharePart } from "./share-donut";

afterEach(cleanup);

const parts: SharePart[] = ["Cardio", "Yoga", "Mobility", "Full body", "Lower body", "HIIT", "Strength"].map((name, i) => ({
  key: name, name, value: 10 - i,
}));

describe("ShareDonut", () => {
  it("keeps the five largest parts in slot order and folds the rest into Other", () => {
    const slices = foldParts(parts);
    expect(slices.map((s) => s.name)).toEqual(["Cardio", "Yoga", "Mobility", "Full body", "Lower body", "Other"]);
    expect(slices.map((s) => s.color)).toEqual([...SHARE, SHARE_OTHER]);
    expect(slices[5]!.value).toBe(5 + 4);
    expect(slices[5]!.rest!.map((p) => p.name)).toEqual(["HIIT", "Strength"]);
    expect(foldParts(parts.slice(0, 3)).map((s) => s.name)).toEqual(["Cardio", "Yoga", "Mobility"]);
  });

  it("draws one slice per part, and a full ring for a single part", () => {
    expect(slicePaths([1, 1, 2])).toHaveLength(3);
    // Two half arcs, so the ring isn't a degenerate zero-length arc.
    expect(slicePaths([5])[0]!.match(/M/g)).toHaveLength(2);
  });

  it("lists every part with its value and share, including the ones inside Other", () => {
    const { container } = render(<ShareDonut parts={parts} format={(v) => `${v} x`} center={["49", "sessions"]} label="Focus" />);
    const items = [...container.querySelectorAll("li")].map((li) => li.textContent);
    expect(items).toEqual([
      "Cardio10 x20%", "Yoga9 x18%", "Mobility8 x16%", "Full body7 x14%", "Lower body6 x12%", "Other9 x18%", "HIIT5 x10%", "Strength4 x8%",
    ]);
    expect(container.querySelectorAll("path")).toHaveLength(6);
    expect(screen.getByRole("img", { name: /^Focus: Cardio 10 x \(20%\)/ })).toBeInTheDocument();
    expect(container.querySelector("svg text")).toHaveTextContent("49");
  });
});
