"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useMe } from "@/features/auth/hooks";
import { AppShell } from "./app-shell";

/** Renders the app shell once the session is confirmed; sends visitors without one to /login. */
export function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { data: me, isError } = useMe();

  useEffect(() => {
    if (isError) router.replace("/login");
  }, [isError, router]);

  if (!me) return null;
  return <AppShell>{children}</AppShell>;
}
