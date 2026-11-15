import type { CategorySlug } from "@productivitytracker/shared";

// Chart colors, validated on the card surface #15313a (see the design's Palette section).
// Card colors are too light to sit side by side as marks, so each category hue is stepped into
// the dark-mode band. Only Meals + Workout (diet) and Late + Premature (sleep) appear together.
export const VIZ: Record<CategorySlug, string> = {
  sleep: "#6798c0",
  work: "#c18151",
  workout: "#a69500",
  meals: "#1aa89a",
  watch: "#9a7fdd",
  gaming: "#d36a97",
  // Misc has no tracker; the entry only completes the record.
  misc: "#8ea6ab",
};
export const VIZ_LATE = "#d67600";
export const VIZ_PREMATURE = "#489dc7";

/** Share slices: five categorical slots in a fixed order, then Other. */
export const SHARE = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"] as const;
export const SHARE_OTHER = "#8ea6ab";

/** Category card colors, for the page title swatch. The API's categories carry the same values. */
export const CATEGORY_COLOR: Record<CategorySlug, string> = {
  sleep: "#9dcffa",
  work: "#b67747",
  workout: "#e0d00d",
  meals: "#02a193",
  watch: "#9d82e1",
  gaming: "#f78bb8",
  misc: "#b4c2c6",
};
