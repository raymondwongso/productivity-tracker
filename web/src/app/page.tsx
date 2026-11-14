import { redirect } from "next/navigation";

// "/" only redirects; there is no UI to show instantly.
export const instant = false;

export default function Home() {
  redirect("/calendar");
}
