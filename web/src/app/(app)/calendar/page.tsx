import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarView } from "@/features/calendar/components/calendar-view";

// Rendered only after AuthGate confirms the session, so it is allowed to block (see (app)/layout.tsx).
export const instant = false;

export const metadata: Metadata = { title: "Calendar" };

export default function CalendarPage() {
  // The calendar reads ?view= and ?date= from the URL.
  return (
    <Suspense>
      <CalendarView />
    </Suspense>
  );
}
