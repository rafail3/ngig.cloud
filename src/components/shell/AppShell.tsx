"use client";

import { useEffect, useState } from "react";
import { MotionConfig } from "motion/react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Folder, LayoutDashboard, LogOut, Menu, ChevronDown, ShieldCheck, UserRound, Trash2, Archive, LifeBuoy, Link2, Send, UsersRound, UploadCloud } from "lucide-react";
import { signOut } from "@/app/actions";
import { dashboardOrigin } from "@/lib/dashboard";
import { formatBytes } from "@/lib/format";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { UploadProvider } from "@/components/drive/UploadProvider";
import { UploadPanel } from "@/components/drive/UploadPanel";
import { ContextMenuProvider } from "@/components/drive/ContextMenu";
import { prefetchDrive, useDriveRealtime, useFolder } from "@/components/drive/useDriveData";
import { OfficeStatusProvider } from "@/components/drive/OfficeStatusProvider";
import { Avatar } from "./Avatar";
import { AppVersion } from "./AppVersion";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type ShellUser = { username: string; role: string; email: string; isSuperAdmin: boolean };

// Nav items. `soon` renders a disabled "coming soon" entry; `adminOnly` hides
// it from non-admins.
type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
  soon?: boolean;
  badge?: number;
};

const NAV: NavItem[] = [
  { href: "/", label: "Fișierele mele", icon: <Folder className="h-[18px] w-[18px]" /> },
  { href: "/uploads", label: "Încărcări", icon: <UploadCloud className="h-[18px] w-[18px]" /> },
  { href: "/archive", label: "Arhivă", icon: <Archive className="h-[18px] w-[18px]" /> },
  { href: "/trash", label: "Coș", icon: <Trash2 className="h-[18px] w-[18px]" /> },
  { href: "/links", label: "Linkuri", icon: <Link2 className="h-[18px] w-[18px]" /> },
  { href: "/transfers", label: "Transferuri", icon: <Send className="h-[18px] w-[18px]" /> },
  { href: "/users", label: "Utilizatori", icon: <UsersRound className="h-[18px] w-[18px]" /> },
  { href: "/profil", label: "Profil", icon: <UserRound className="h-[18px] w-[18px]" /> },
  { href: "/support", label: "Suport", icon: <LifeBuoy className="h-[18px] w-[18px]" /> },
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
      {/* A real progress element: it carries role="progressbar" and the value,
          so the meter is announced rather than being a decorative div. Unlimited
          quota keeps the old treatment — a full, dimmed bar. */}
      <Progress
        value={quota ? pct : 100}
        aria-label="Spațiu folosit"
        className={`h-1.5 bg-zinc-900 ${quota ? "" : "opacity-30"}`}
        indicatorClassName="bg-indigo-500"
      />
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
  pendingTransfers = 0,
  children,
}: {
  user: ShellUser;
  pendingTransfers?: number;
  children: React.ReactNode;
}) {
  // The sidebar is an overlay drawer on every screen size, opened by the burger
  // — so the page content is full-width and centers on the whole viewport.
  // Controlled (rather than left to the Sheet) only because a nav link has to
  // close it on click.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const items = NAV.filter((i) => !i.adminOnly || user.role === "admin").map((i) =>
    i.href === "/transfers" ? { ...i, badge: pendingTransfers } : i,
  );

  // Warm the drive data caches in the background once per session. (The Office
  // editor's api.js is warmed by OfficeStatusProvider, which is what learns the
  // Document Server's address.)
  useEffect(() => {
    prefetchDrive();
  }, []);

  // Live sync: reflect drive changes from other tabs/devices instantly.
  useDriveRealtime();

  return (
    <MotionConfig reducedMotion="user">
    <ContextMenuProvider>
    <OfficeStatusProvider>
    <UploadProvider>
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      {/* ===== Top navbar ===== */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-zinc-900 bg-zinc-950/90 px-3 backdrop-blur-md sm:px-5">
        {/* left: menu button (all sizes) + logo */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger
              aria-label="Meniu"
              className="flex items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/50 px-2.5 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-50 data-[state=open]:border-zinc-700 data-[state=open]:bg-zinc-900 data-[state=open]:text-zinc-50"
            >
              <Menu className="h-5 w-5" />
              <span className="hidden font-medium sm:inline">Meniu</span>
            </SheetTrigger>

            {/* The drawer sits under the navbar, as it always has. What is new
                is everything the hand-rolled version lacked: the page behind it
                stops scrolling, focus is trapped inside and handed back to the
                burger on close, and Escape works. */}
            <SheetContent
              side="left"
              // Height is explicit: the primitive ships `h-full`, which with a
              // top of 4rem would hang 4rem past the bottom of the screen and
              // push the storage footer out of view.
              className="top-16 h-[calc(100%-4rem)] w-72 border-r border-zinc-900 bg-zinc-950/95 p-0 backdrop-blur sm:max-w-72"
              overlayClassName="top-16 backdrop-blur-sm"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Navigare</SheetTitle>
              </SheetHeader>
              <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
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
                      aria-current={active ? "page" : undefined}
                      className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        active
                          ? "bg-indigo-500/10 font-medium text-indigo-300"
                          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                      }`}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-indigo-400" />
                      )}
                      <span
                        className={
                          active
                            ? "text-indigo-400"
                            : "text-zinc-500 transition-colors group-hover:text-zinc-300"
                        }
                      >
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                      {!!item.badge && (
                        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-indigo-500 px-1.5 text-[11px] font-semibold tabular-nums text-white">
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </nav>
              <DrawerStorage />
            </SheetContent>
          </Sheet>
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
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-2 text-sm text-zinc-300 transition-colors hover:bg-zinc-900 hover:text-zinc-50 data-[state=open]:bg-zinc-900 data-[state=open]:text-zinc-50">
              <Avatar username={user.username} />
              <span className="hidden max-w-[140px] truncate font-medium sm:inline">
                {user.username}
              </span>
              {/* Rotates from the menu's own state rather than from a boolean we
                  keep in parallel — one source of truth for "open". */}
              <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-data-[state=open]:rotate-180" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64 p-0">
              <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3.5">
                <Avatar username={user.username} className="h-9 w-9 text-sm" />
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-zinc-100">
                    {user.username}
                    {user.role === "admin" && (
                      <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-indigo-300">
                        {user.isSuperAdmin ? "Super admin" : "Manager"}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{user.email}</p>
                </div>
              </div>

              {/* Group, not a plain div. Radix collects the navigable items
                  through these components — arrow keys walk what is inside a
                  Group, and a Label is explicitly skipped. Wrapping items in an
                  anonymous div is what left the menu tabbable but not
                  arrow-navigable. */}
              <DropdownMenuGroup className="p-1.5">
                <DropdownMenuItem asChild>
                  <Link href="/profil">
                    <UserRound className="h-4 w-4 text-zinc-400" /> Profilul meu
                  </Link>
                </DropdownMenuItem>
                {/* A read-only fact: a Label rather than an item, so it is
                    announced but never focused or made to look clickable. */}
                <DropdownMenuLabel className="flex items-center justify-between px-2.5 py-2 font-normal">
                  <span className="flex items-center gap-2.5 text-zinc-400">
                    <ShieldCheck className="h-4 w-4" /> Rol
                  </span>
                  <span className="font-medium capitalize text-zinc-200">
                    {user.role || "user"}
                  </span>
                </DropdownMenuLabel>
              </DropdownMenuGroup>

              <DropdownMenuSeparator className="mx-0" />
              <DropdownMenuGroup className="p-1.5">
                {/* The server action is called directly instead of through a
                    form: a menu item that submits a form has to survive the menu
                    closing around it, and the action redirects anyway. */}
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    void signOut();
                  }}
                >
                  <LogOut className="h-4 w-4" /> Deconectează-te
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <div className="border-t border-zinc-800 px-4 py-2 text-center">
                <AppVersion />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ===== Main content: full width, centered on the viewport ===== */}
      <main className="min-w-0 flex-1">{children}</main>

      {/* Floating upload progress panel (visible across all app pages) */}
      <UploadPanel />
    </div>
    </UploadProvider>
    </OfficeStatusProvider>
    </ContextMenuProvider>
    </MotionConfig>
  );
}
