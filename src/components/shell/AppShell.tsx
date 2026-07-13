"use client";

import { useEffect, useState } from "react";
import { MotionConfig } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Folder, LayoutDashboard, LogOut, Menu, ChevronDown, Mail, ShieldCheck, UserRound, Trash2, Archive, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { signOut } from "@/app/actions";
import { dashboardOrigin } from "@/lib/dashboard";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { UploadProvider } from "@/components/drive/UploadProvider";
import { UploadPanel } from "@/components/drive/UploadPanel";
import { ContextMenuProvider } from "@/components/drive/ContextMenu";
import { prefetchDrive, useDriveRealtime } from "@/components/drive/useDriveData";

type ShellUser = { username: string; role: string; email: string };

// Nav items. `soon` renders a disabled "coming soon" entry; `adminOnly` hides
// it from non-admins. New sections (Foldere, Preview) get added here as we build.
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
  defaultCollapsed = false,
}: {
  user: ShellUser;
  children: React.ReactNode;
  defaultCollapsed?: boolean;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Desktop-only collapse, seeded from a cookie (read in the layout) so it
  // survives reloads with no flash.
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const pathname = usePathname();
  const items = NAV.filter((i) => !i.adminOnly || user.role === "admin");

  // Warm the drive data caches (root folder / archive / trash) in the
  // background once per session, so the first click on any drive section
  // shows its data instantly instead of a skeleton.
  useEffect(() => {
    prefetchDrive();
  }, []);

  // Live sync: reflect drive changes from other tabs/devices instantly.
  useDriveRealtime();

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `sidebar_collapsed=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <MotionConfig reducedMotion="user">
    <ContextMenuProvider>
    <UploadProvider>
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      {/* ===== Top navbar (always visible, full width) ===== */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-950/95 px-3 backdrop-blur sm:px-5">
        {/* left: hamburger (mobile) + logo. shrink-0 so the logo keeps its
            aspect ratio and never gets squished by the flex row on narrow
            screens. */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Meniu"
            className="-ml-1 rounded-md p-2 text-zinc-300 hover:bg-zinc-900 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          {/* White-wordmark logo for dark mode, black-wordmark for light. CSS
              swap (not JS) so it never flashes the wrong one. Click → home. */}
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

        {/* right: theme toggle + user menu + logout. shrink-0 keeps the group
            intact; tighter gaps pull the theme icon closer to the profile. */}
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          <ThemeToggle />
          <div className="relative">
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
              <>
                {/* click-away backdrop */}
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
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
              </>
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

      {/* ===== Body: sidebar + content ===== */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 top-16 z-40 flex w-64 flex-col border-r border-zinc-900 bg-zinc-950 transition-[transform,width] duration-200 md:sticky md:top-16 md:h-[calc(100vh-4rem)] md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          } ${collapsed ? "md:w-16" : "md:w-64"}`}
        >
          <nav className="flex-1 space-y-1 px-3 py-4">
            {items.map((item) => {
              const active = item.href === pathname;
              if (item.soon) {
                return (
                  <span
                    key={item.label}
                    className={`flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-600 ${
                      collapsed ? "md:justify-center" : ""
                    }`}
                    title={item.label}
                  >
                    {item.icon}
                    <span className={collapsed ? "md:hidden" : undefined}>{item.label}</span>
                    <span
                      className={`ml-auto rounded bg-zinc-900 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500 ${
                        collapsed ? "md:hidden" : ""
                      }`}
                    >
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
                  title={item.label}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-zinc-900 text-zinc-50"
                      : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100"
                  } ${collapsed ? "md:justify-center" : ""}`}
                >
                  {item.icon}
                  <span className={collapsed ? "md:hidden" : undefined}>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Desktop-only collapse / expand toggle */}
          <button
            type="button"
            onClick={toggleCollapsed}
            title={collapsed ? "Extinde meniul" : "Restrânge meniul"}
            aria-label={collapsed ? "Extinde meniul" : "Restrânge meniul"}
            className={`hidden border-t border-zinc-900 px-3 py-3 text-sm text-zinc-400 transition-colors hover:bg-zinc-900/60 hover:text-zinc-100 md:flex md:items-center md:gap-3 ${
              collapsed ? "md:justify-center" : ""
            }`}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
            {!collapsed && <span>Restrânge</span>}
          </button>
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 top-16 z-30 bg-black/60 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* Floating upload progress panel (visible across all app pages) */}
      <UploadPanel />
    </div>
    </UploadProvider>
    </ContextMenuProvider>
    </MotionConfig>
  );
}
