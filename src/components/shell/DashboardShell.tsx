"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Ticket,
  Inbox,
  Users,
  Megaphone,
  Settings,
  LogOut,
  Menu,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { dashboardSignOut } from "@/app/dashboard/actions";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useClickOutside } from "@/lib/useClickOutside";
import { Avatar } from "./Avatar";

type ShellUser = { username: string; email: string };

// Nav items use CLEAN paths — on the dashboard host the proxy rewrites them
// into the /dashboard tree, so the browser URL stays prefix-free.
// `soon` marks sections built in later phases.
type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  soon?: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
  { href: "/invites", label: "Invite codes", icon: <Ticket className="h-[18px] w-[18px]" /> },
  { href: "/invite-requests", label: "Cereri invitații", icon: <Inbox className="h-[18px] w-[18px]" /> },
  { href: "/users", label: "Useri", icon: <Users className="h-[18px] w-[18px]" /> },
  { href: "/announcements", label: "Anunțuri", icon: <Megaphone className="h-[18px] w-[18px]" /> },
  { href: "/settings", label: "Setări", icon: <Settings className="h-[18px] w-[18px]" /> },
];

export function DashboardShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      {/* ===== Top navbar ===== */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-950/90 px-3 backdrop-blur-md sm:px-5">
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Meniu"
            aria-expanded={sidebarOpen}
            className={`-ml-1 rounded-lg p-2 transition-colors md:hidden ${
              sidebarOpen ? "bg-zinc-900 text-zinc-50" : "text-zinc-300 hover:bg-zinc-900"
            }`}
          >
            <Menu className="h-5 w-5" />
          </button>
          {/* White-wordmark logo for dark mode, black-wordmark for light.
              shrink-0 keeps its aspect ratio on narrow screens.
              Click → dashboard overview. */}
          <Link href="/" aria-label="Overview" className="flex shrink-0 items-center">
            <Image
              src="/ngig-logo.png"
              alt="ngig.cloud"
              width={352}
              height={96}
              priority
              className="hidden h-8 w-auto shrink-0 dark:block sm:h-10"
            />
            <Image
              src="/ngig-logo-light.png"
              alt="ngig.cloud"
              width={352}
              height={96}
              priority
              className="block h-8 w-auto shrink-0 dark:hidden sm:h-10"
            />
          </Link>
          <span className="hidden rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300 sm:inline">
            admin
          </span>
        </div>

        {/* right: notifications + theme + user menu (logout lives inside) */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-1.5">
          <NotificationBell />
          <ThemeToggle />
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              className={`flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 text-sm transition-colors ${
                menuOpen
                  ? "bg-zinc-900 text-zinc-50"
                  : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50"
              }`}
            >
              <Avatar username={user.username} />
              <span className="hidden max-w-[120px] truncate font-medium sm:inline">
                {user.username}
              </span>
              <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl shadow-black/30">
                <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3.5">
                  <Avatar username={user.username} className="h-9 w-9 text-sm" />
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-zinc-100">
                      {user.username}
                      <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300">
                        admin
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{user.email}</p>
                  </div>
                </div>
                <div className="p-1.5">
                  <div className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm">
                    <span className="flex items-center gap-2.5 text-zinc-400">
                      <ShieldCheck className="h-4 w-4" /> Rol
                    </span>
                    <span className="font-medium text-zinc-200">admin</span>
                  </div>
                </div>
                <div className="border-t border-zinc-800 p-1.5">
                  <form action={dashboardSignOut}>
                    <button
                      type="submit"
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-300 transition-colors hover:bg-red-500/10 hover:text-red-300"
                    >
                      <LogOut className="h-4 w-4" /> Deconectează-te
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ===== Body: sidebar + content ===== */}
      <div className="flex flex-1">
        <aside
          className={`fixed inset-y-0 left-0 top-16 z-40 flex w-64 flex-col border-r border-zinc-900 bg-zinc-950 transition-transform md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <nav className="flex-1 space-y-0.5 px-3 py-4">
            <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
              Administrare
            </p>
            {NAV.map((item) => {
              const active = item.href === pathname;
              if (item.soon) {
                return (
                  <span
                    key={item.label}
                    className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600"
                    title="În curând"
                  >
                    {item.icon}
                    <span>{item.label}</span>
                    <span className="ml-auto rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                      soon
                    </span>
                  </span>
                );
              }
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-indigo-500/10 font-medium text-indigo-300"
                      : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                  }`}
                >
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-indigo-400" />
                  )}
                  <span className={active ? "text-indigo-400" : "text-zinc-500 transition-colors group-hover:text-zinc-300"}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        {sidebarOpen && (
          <div
            className="fixed inset-0 top-16 z-30 bg-black/60 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
