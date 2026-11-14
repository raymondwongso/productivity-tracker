import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { daysOf } from "../range";
import { ColumnChart, niceScale } from "./column-chart";

afterEach(cleanup);
const days = daysOf(new Date(2026, 10, 9), new Date(2026, 10, 15));

describe("ColumnChart", () => {
  it("picks round axis steps", () => {
    expect(niceScale(470)).toEqual({ step: 200, top: 600 });
    expect(niceScale(1900)).toEqual({ step: 500, top: 2000 });
    expect(niceScale(0)).toEqual({ step: 1, top: 4 });
  });

  it("draws a bar per day with a value, and none for zero", () => {
    const { container } = render(
      <ColumnChart days={days} series={[{ name: "Burned", color: "#a69500", values: [300, 0, 250, 0, 400, 0, 180] }]} tick={String} format={(v) => `${v} kcal`} label="Calories burned per day" />,
    );
    expect(screen.getByRole("img", { name: "Calories burned per day" })).toBeInTheDocument();
    expect([...container.querySelectorAll("[data-mark]")].filter((p) => p.getAttribute("d"))).toHaveLength(4);
    expect(screen.getByText("Mon 9")).toBeInTheDocument();
  });

  it("stacks segments with a gap and groups side by side", () => {
    const series = [
      { name: "Late", color: "#d67600", values: [20, 0, 0, 0, 0, 0, 0] },
      { name: "Premature", color: "#489dc7", values: [40, 0, 0, 0, 0, 0, 0] },
    ];
    const stacked = render(<ColumnChart mode="stack" days={days} series={series} tick={String} format={String} label="stack" />);
    // The lower segment is a square rect, the top one a rounded path.
    expect(stacked.container.querySelectorAll("rect[data-mark]")).toHaveLength(1);
    expect(stacked.container.querySelectorAll("path[data-mark]")).toHaveLength(1);
    stacked.unmount();
    const grouped = render(<ColumnChart mode="group" days={days} series={series} tick={String} format={String} label="group" />);
    expect(grouped.container.querySelectorAll("path[data-mark]")).toHaveLength(14);
  });

  it("shows every series for a day in the tooltip", () => {
    const { container } = render(
      <ColumnChart
        mode="group"
        days={days}
        series={[{ name: "Consumed", color: "#1aa89a", values: [2000, 0, 0, 0, 0, 0, 0] }, { name: "Burned", color: "#a69500", values: [300, 0, 0, 0, 0, 0, 0] }]}
        tick={String}
        format={(v) => `${v} kcal`}
        extraTip={() => <span>Net +1,700</span>}
        label="diet"
      />,
    );
    fireEvent.pointerMove(container.querySelector('[data-day="0"]')!, { clientX: 10, clientY: 10 });
    const tip = screen.getByRole("tooltip");
    expect(tip).toHaveTextContent("Mon, Nov 9");
    expect(tip).toHaveTextContent("2000 kcalConsumed");
    expect(tip).toHaveTextContent("300 kcalBurned");
    expect(tip).toHaveTextContent("Net +1,700");
  });
});
