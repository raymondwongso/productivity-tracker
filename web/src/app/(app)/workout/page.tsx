import { redirect } from "next/navigation";

// Workout and Meals are sections of the Fitness Tracker now; old links keep working.
export const instant = false;

export default function Page() {
  redirect("/fitness#workout");
}
