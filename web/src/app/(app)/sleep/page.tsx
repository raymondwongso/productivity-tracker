import type { Metadata } from "next";
import { Suspense } from "react";
import { SleepTracker } from "@/features/trackers/pages/sleep-tracker";

// Rendered only after AuthGate confirms the session, so it is allowed to block (see (app)/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Sleep Tracker" };

export default function Page() {
  // The tracker reads its date range from the URL.
  return (
    <Suspense>
      <SleepTracker />
    </Suspense>
  );
}
