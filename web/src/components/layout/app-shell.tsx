"use client";

import { Activity, Briefcase, CalendarDays, Film, Gamepad2, LogOut, Menu, Moon, PanelLeftClose, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useLogout, useMe } from "@/features/auth/hooks";
import { CATEGORY_COLOR } from "@/features/trackers/colors";
import { initials } from "@/lib/format";

const STORAGE_KEY = "pt.sidebar.collapsed";
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
const getCollapsed = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
};

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Category swatch beside the label. */
  swatch?: string;
}

const MAIN: NavItem[] = [{ href: "/calendar", label: "Calendar", icon: CalendarDays }];
const TRACKERS: NavItem[] = [
  { href: "/sleep", label: "Sleep Tracker", icon: Moon, swatch: CATEGORY_COLOR.sleep },
  { href: "/fitness", label: "Fitness Tracker", icon: Activity, swatch: `linear-gradient(90deg, ${CATEGORY_COLOR.workout} 50%, ${CATEGORY_COLOR.meals} 50%)` },
  { href: "/work", label: "Work Tracker", icon: Briefcase, swatch: CATEGORY_COLOR.work },
  { href: "/cinema", label: "Cinema", icon: Film, swatch: CATEGORY_COLOR.watch },
  { href: "/gaming", label: "Gaming Tracker", icon: Gamepad2, swatch: CATEGORY_COLOR.gaming },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useMe();
  const logout = useLogout();
  const [drawer, setDrawer] = useState(false);
  const collapsed = useSyncExternalStore(subscribe, getCollapsed, () => false);

  const toggle = () => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? "0" : "1");
    } catch {
      // storage unavailable: the toggle just doesn't persist
    }
    listeners.forEach((l) => l());
  };
  const current = [...MAIN, ...TRACKERS].find((n) => pathname.startsWith(n.href));
  const fullName = me ? `${me.firstName} ${me.lastName}` : "";

  const onLogout = () => logout.mutate(undefined, { onSettled: () => router.replace("/login?loggedout=1") });

  // On desktop the sidebar can be collapsed; in the mobile drawer it is always expanded.
  const slim = collapsed;
  const hideWhenSlim = slim ? "md:hidden" : "";

  const link = ({ href, label, icon: Icon, swatch }: NavItem) => {
    const active = pathname.startsWith(href);
    return (
      <Link
        key={href}
        href={href}
        title={label}
        onClick={() => setDrawer(false)}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 px-6 py-3 font-semibold ${slim ? "md:justify-center md:px-0" : ""} ${active ? "bg-ink text-bg" : "hover:bg-grid"}`}
      >
        <Icon size={18} />
        <span className={hideWhenSlim}>{label}</span>
        {swatch && <i aria-hidden="true" className={`ml-auto h-2 w-2 shrink-0 ${hideWhenSlim}`} style={{ background: swatch }} />}
      </Link>
    );
  };

  return (
    <div className="flex h-dvh flex-col md:flex-row">
      <div className="sticky top-0 z-30 flex shrink-0 items-center gap-3 border-b-2 border-ink bg-bg px-4 py-2 md:hidden">
        <button type="button" aria-label="Open menu" onClick={() => setDrawer(true)} className="flex h-11 w-11 items-center justify-center border-2 border-ink">
          <Menu size={20} />
        </button>
        <span className="text-[17px] font-extrabold">{current?.label ?? "Productivity Tracker"}</span>
      </div>

      {drawer && <div className="fixed inset-0 z-40 bg-black/70 md:hidden" onClick={() => setDrawer(false)} />}

      <aside
        aria-label="Main menu"
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r-2 border-ink bg-surface transition-transform duration-200 ${drawer ? "translate-x-0" : "-translate-x-[105%]"} md:sticky md:top-0 md:h-dvh md:translate-x-0 md:transition-[width] md:duration-[180ms] ${slim ? "md:w-[72px]" : "md:w-[248px]"} md:shrink-0`}
      >
        <div className={`flex min-h-20 items-center gap-3 border-b-2 border-ink px-4 ${slim ? "md:justify-center md:px-0" : ""}`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-ink font-extrabold text-bg">
            {me ? initials(me.firstName, me.lastName) : ""}
          </div>
          <div className={`min-w-0 ${hideWhenSlim}`}>
            <p className="truncate font-semibold">{fullName}</p>
            <p className="truncate text-xs text-muted">{me?.email}</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col overflow-y-auto py-2">
          {MAIN.map(link)}
          <p className={`px-6 pt-4 pb-1.5 text-[11px] font-semibold tracking-[.08em] text-muted uppercase ${hideWhenSlim}`}>Trackers</p>
          {TRACKERS.map(link)}
        </nav>

        <button
          type="button"
          onClick={onLogout}
          title="Log out"
          className={`flex items-center gap-3 border-t-2 border-ink px-6 py-3 font-semibold text-danger-text hover:bg-danger-tint ${slim ? "md:justify-center md:px-0" : ""}`}
        >
          <LogOut size={18} />
          <span className={hideWhenSlim}>Log out</span>
        </button>
        <button
          type="button"
          onClick={() => (drawer ? setDrawer(false) : toggle())}
          title={collapsed ? "Expand" : "Collapse"}
          className={`flex items-center gap-3 border-t-2 border-ink px-6 py-3 font-semibold hover:bg-grid ${slim ? "md:justify-center md:px-0" : ""}`}
        >
          <PanelLeftClose size={18} className={collapsed ? "md:rotate-180" : ""} />
          <span className={hideWhenSlim}>
            <span className="md:hidden">Close menu</span>
            <span className="hidden md:inline">{collapsed ? "Expand" : "Collapse"}</span>
          </span>
        </button>
      </aside>

      <main className="flex min-h-0 w-full min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
