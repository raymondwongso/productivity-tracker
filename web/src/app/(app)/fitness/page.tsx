import type { Metadata } from "next";
import { Suspense } from "react";
import { FitnessTracker } from "@/features/trackers/pages/fitness-tracker";

// Rendered only after AuthGate confirms the session, so it is allowed to block (see (app)/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Fitness Tracker" };

export default function Page() {
  // The tracker reads its date range from the URL.
  return (
    <Suspense>
      <FitnessTracker />
    </Suspense>
  );
}
