import type { ReactNode } from "react";
import { AuthGate } from "@/components/layout/auth-gate";

// Everything in the app area waits for the session check (GET /auth/me) before it renders,
// so navigations into it are allowed to block.
export const instant = false;

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AuthGate>{children}</AuthGate>;
}
