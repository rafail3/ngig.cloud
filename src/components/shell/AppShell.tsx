"use client";

import { useEffect, useRef, useState } from "react";
import { MotionConfig } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Folder, LayoutDashboard, LogOut, Menu, ChevronDown, ShieldCheck, UserRound, Trash2, Archive } from "lucide-react";
import { signOut } from "@/app/actions";
import { dashboardOrigin } from "@/lib/dashboard";
import { formatBytes } from "@/lib/format";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UploadProvider } from "@/components/drive/UploadProvider";
import { UploadPanel } from "@/components/drive/UploadPanel";
import { ContextMenuProvider } from "@/components/drive/ContextMenu";
import { prefetchDrive, useDriveRealtime, useFolder } from "@/components/drive/useDriveData";
import { useClickOutside } from "@/lib/useClickOutside";
import { Avatar } from "./Avatar";

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
  { href: "/", label: "Fișierele mele", icon: <Folder className="h-[18px] w-[18px]" /> },
  { href: "/archive", label: "Arhivă", icon: <Archive className="h-[18px] w-[18px]" /> },
  { href: "/trash", label: "Coș", icon: <Trash2 className="h-[18px] w-[18px]" /> },
  { href: "/profil", label: "Profil", icon: <UserRound className="h-[18px] w-[18px]" /> },
  {
    href: dashboardOrigin(),
    label: "Dashboard",
    icon: <LayoutDashboard className="h-[18px] w-[18px]" />,
    adminOnly: true,
  },
];

// Storage summary pinned to the drawer's footer. Reads the same SWR cache as
// the drive, so it's free (no extra request) and live-updates with uploads.
function DrawerStorage() {
  const { data } = useFolder(null);
  if (!data) return null;
  const { used, quota } = data;
  const pct = quota ? Math.min(100, Math.round((used / quota) * 100)) : 0;
  return (
    <div className="border-t border-zinc-900 px-4 py-4">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-zinc-400">Spațiu folosit</span>
        {quota ? <span className="tabular-nums text-zinc-500">{pct}%</span> : null}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all"
          style={{ width: `${quota ? pct : 100}%`, opacity: quota ? 1 : 0.3 }}
        />
      </div>
      <p className="mt-1.5 text-xs text-zinc-500">
        {quota
          ? `${formatBytes(used)} din ${formatBytes(quota)}`
          : `${formatBytes(used)} folosiți`}
      </p>
    </div>
  );
}

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
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-950/90 px-3 backdrop-blur-md sm:px-5">
        {/* left: menu button (all sizes) + logo */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Meniu"
            aria-expanded={sidebarOpen}
            className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition-colors ${
              sidebarOpen
                ? "border-zinc-700 bg-zinc-900 text-zinc-50"
                : "border-zinc-800/80 bg-zinc-900/50 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-50"
            }`}
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

        {/* right: notifications + theme + user menu (profile & logout live inside) */}
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
              <span className="hidden max-w-[140px] truncate font-medium sm:inline">
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
                      {user.role === "admin" && (
                        <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300">
                          admin
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{user.email}</p>
                  </div>
                </div>
                <div className="p-1.5">
                  <Link
                    href="/profil"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-zinc-200 transition-colors hover:bg-zinc-800/70"
                  >
                    <UserRound className="h-4 w-4 text-zinc-400" /> Profilul meu
                  </Link>
                  <div className="flex items-center justify-between rounded-lg px-2.5 py-2 text-sm">
                    <span className="flex items-center gap-2.5 text-zinc-400">
                      <ShieldCheck className="h-4 w-4" /> Rol
                    </span>
                    <span className="font-medium capitalize text-zinc-200">{user.role || "user"}</span>
                  </div>
                </div>
                <div className="border-t border-zinc-800 p-1.5">
                  <form action={signOut}>
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

      {/* ===== Sidebar drawer (overlay on every screen size) ===== */}
      <aside
        aria-hidden={!sidebarOpen}
        className={`fixed inset-y-0 left-0 top-16 z-50 flex w-72 flex-col border-r border-zinc-900 bg-zinc-950/95 shadow-2xl backdrop-blur transition-transform duration-200 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="flex-1 space-y-0.5 px-3 py-4">
          <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
            Navigare
          </p>
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
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
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
        <DrawerStorage />
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
