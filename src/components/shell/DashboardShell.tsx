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
  Bell,
  Settings,
  LogOut,
  Menu,
  ChevronDown,
  Mail,
  ShieldCheck,
} from "lucide-react";
import { dashboardSignOut } from "@/app/dashboard/actions";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useClickOutside } from "@/lib/useClickOutside";

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
  { href: "/", label: "Overview", icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: "/invites", label: "Invite codes", icon: <Ticket className="h-5 w-5" /> },
  { href: "/invite-requests", label: "Cereri invitații", icon: <Inbox className="h-5 w-5" /> },
  { href: "/users", label: "Useri", icon: <Users className="h-5 w-5" /> },
  { href: "/announcements", label: "Anunțuri", icon: <Megaphone className="h-5 w-5" /> },
  { href: "/notifications", label: "Setări notificări", icon: <Bell className="h-5 w-5" /> },
  { href: "/settings", label: "Setări", icon: <Settings className="h-5 w-5" /> },
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
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-950/95 px-3 backdrop-blur sm:px-5">
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Meniu"
            className="-ml-1 rounded-md p-2 text-zinc-300 hover:bg-zinc-900 md:hidden"
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
          <span className="hidden rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300 sm:inline">
            admin
          </span>
        </div>

        {/* right: theme toggle + user menu + logout */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <NotificationBell />
          <ThemeToggle />
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-50"
            >
              <span className="max-w-[80px] truncate font-medium sm:max-w-[120px]">{user.username}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>

            {menuOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-xl">
                  <div className="border-b border-zinc-800 px-4 py-3">
                    <p className="truncate text-sm font-semibold text-zinc-100">{user.username}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{user.email}</span>
                    </p>
                  </div>
                  <div className="px-4 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-zinc-400">
                        <ShieldCheck className="h-4 w-4" /> Rol
                      </span>
                      <span className="font-medium text-zinc-200">admin</span>
                    </div>
                  </div>
                </div>
            )}
          </div>

          <form action={dashboardSignOut}>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-md border border-zinc-800 px-2.5 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:text-zinc-50"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </form>
        </div>
      </header>

      {/* ===== Body: sidebar + content ===== */}
      <div className="flex flex-1">
        <aside
          className={`fixed inset-y-0 left-0 top-16 z-40 flex w-64 flex-col border-r border-zinc-900 bg-zinc-950 transition-transform md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <nav className="flex-1 space-y-1 px-3 py-4">
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
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-zinc-900 text-zinc-50"
                      : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100"
                  }`}
                >
                  {item.icon}
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
