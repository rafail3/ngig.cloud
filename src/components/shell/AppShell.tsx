"use client";

import { useEffect, useRef, useState } from "react";
import { MotionConfig } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Folder, LayoutDashboard, LogOut, Menu, ChevronDown, Mail, ShieldCheck, UserRound, Trash2, Archive } from "lucide-react";
import { signOut } from "@/app/actions";
import { dashboardOrigin } from "@/lib/dashboard";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UploadProvider } from "@/components/drive/UploadProvider";
import { UploadPanel } from "@/components/drive/UploadPanel";
import { ContextMenuProvider } from "@/components/drive/ContextMenu";
import { prefetchDrive, useDriveRealtime } from "@/components/drive/useDriveData";
import { useClickOutside } from "@/lib/useClickOutside";

type ShellUser = { username: string; role: string; email: string };

// Nav items. `soon` renders a disabled "coming soon" entry; `adminOnly` hides
// it from non-admins.
type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  soon?: boolean;
};

const NAV: NavItem[] = [
  { href: "/", label: "Fișierele mele", icon: <Folder className="h-5 w-5" /> },
  { href: "/archive", label: "Arhivă", icon: <Archive className="h-5 w-5" /> },
  { href: "/trash", label: "Coș", icon: <Trash2 className="h-5 w-5" /> },
  { href: "/profil", label: "Profil", icon: <UserRound className="h-5 w-5" /> },
  {
    href: dashboardOrigin(),
    label: "Dashboard",
    icon: <LayoutDashboard className="h-5 w-5" />,
    adminOnly: true,
  },
];

export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  // The sidebar is an overlay drawer on every screen size, opened by the burger
  // — so the page content is full-width and centers on the whole viewport.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useClickOutside(menuRef, () => setMenuOpen(false), menuOpen);
  const pathname = usePathname();
  const items = NAV.filter((i) => !i.adminOnly || user.role === "admin");

  // Warm the drive data caches in the background once per session.
  useEffect(() => {
    prefetchDrive();
  }, []);

  // Live sync: reflect drive changes from other tabs/devices instantly.
  useDriveRealtime();

  return (
    <MotionConfig reducedMotion="user">
    <ContextMenuProvider>
    <UploadProvider>
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      {/* ===== Top navbar ===== */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-950/95 px-3 backdrop-blur sm:px-5">
        {/* left: menu button (all sizes) + logo */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Meniu"
            aria-expanded={sidebarOpen}
            className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2.5 py-2 text-sm text-zinc-200 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-50"
          >
            <Menu className="h-5 w-5" />
            <span className="hidden font-medium sm:inline">Meniu</span>
          </button>
          <Link href="/" aria-label="Acasă" className="flex shrink-0 items-center">
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
              <span className="max-w-[72px] truncate font-medium sm:max-w-[140px]">{user.username}</span>
              {user.role === "admin" && (
                <span className="hidden rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] uppercase text-indigo-300 sm:inline">
                  admin
                </span>
              )}
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
                  <Link
                    href="/profil"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3 text-sm text-zinc-200 transition-colors hover:bg-zinc-800/60"
                  >
                    <UserRound className="h-4 w-4 text-zinc-400" /> Profil
                  </Link>
                  <div className="px-4 py-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-zinc-400">
                        <ShieldCheck className="h-4 w-4" /> Rol
                      </span>
                      <span className="font-medium capitalize text-zinc-200">{user.role || "user"}</span>
                    </div>
                  </div>
                </div>
            )}
          </div>

          <form action={signOut}>
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

      {/* ===== Sidebar drawer (overlay on every screen size) ===== */}
      <aside
        aria-hidden={!sidebarOpen}
        className={`fixed inset-y-0 left-0 top-16 z-50 flex w-72 flex-col border-r border-zinc-800 bg-zinc-950/95 shadow-2xl backdrop-blur transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="flex-1 space-y-1 px-3 py-4">
          {items.map((item) => {
            const active = item.href === pathname;
            if (item.soon) {
              return (
                <span
                  key={item.label}
                  className="flex cursor-default items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-600"
                  title={item.label}
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
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-indigo-500/15 text-indigo-200"
                    : "text-zinc-300 hover:bg-zinc-900 hover:text-zinc-50"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Backdrop scrim while the drawer is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 top-16 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ===== Main content: full width, centered on the viewport ===== */}
      <main className="min-w-0 flex-1">{children}</main>

      {/* Floating upload progress panel (visible across all app pages) */}
      <UploadPanel />
    </div>
    </UploadProvider>
    </ContextMenuProvider>
    </MotionConfig>
  );
}
