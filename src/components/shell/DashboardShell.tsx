"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Ticket,
  Inbox,
  Users,
  Wallet,
  Megaphone,
  LifeBuoy,
  Settings,
  LogOut,
  Menu,
  ChevronDown,
  ShieldCheck,
} from "lucide-react";
import { dashboardSignOut } from "@/app/dashboard/actions";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { Avatar } from "./Avatar";
import { AppVersion } from "./AppVersion";
import { RoleBadge } from "@/components/dashboard/RoleBadge";
import { Button } from "@/components/ui/button";
import { useMenuModality } from "@/lib/useMenuModality";
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

type ShellUser = { username: string; email: string; isSuperAdmin: boolean };

// Nav item key → unread count. Today only Suport uses it (tickets waiting on an
// admin reply); the shell stays generic so any section can grow a badge.
type NavBadges = { tickets?: number };

// Nav items use CLEAN paths — on the dashboard host the proxy rewrites them
// into the /dashboard tree, so the browser URL stays prefix-free.
// `soon` marks sections built in later phases; `superOnly` hides the entry from
// managers; `section` ties the entry to a per-manager permission key (the
// pages/actions are guarded server-side too).
type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  soon?: boolean;
  superOnly?: boolean;
  section?: string;
};

const NAV: NavItem[] = [
  { href: "/", label: "Overview", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
  { href: "/invites", label: "Invite codes", icon: <Ticket className="h-[18px] w-[18px]" />, section: "invites" },
  { href: "/invite-requests", label: "Cereri invitații", icon: <Inbox className="h-[18px] w-[18px]" />, section: "invite-requests" },
  { href: "/users", label: "Useri", icon: <Users className="h-[18px] w-[18px]" />, section: "users" },
  { href: "/costs", label: "Costuri", icon: <Wallet className="h-[18px] w-[18px]" />, section: "costs" },
  { href: "/tickets", label: "Suport", icon: <LifeBuoy className="h-[18px] w-[18px]" />, section: "tickets" },
  { href: "/announcements", label: "Anunțuri", icon: <Megaphone className="h-[18px] w-[18px]" />, section: "announcements" },
  { href: "/settings", label: "Setări", icon: <Settings className="h-[18px] w-[18px]" />, superOnly: true },
];

/* The navigation itself, written once and mounted twice: in the sticky column
   on desktop and inside the drawer on mobile. Duplicating the markup instead
   would guarantee the two drift — one gets a new entry, the other does not. */
function SidebarNav({
  user,
  badges,
  sections,
  onNavigate,
}: {
  user: ShellUser;
  badges?: NavBadges;
  sections?: string[] | null;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = NAV.filter(
    (i) =>
      (!i.superOnly || user.isSuperAdmin) &&
      (!i.section || sections == null || sections.includes(i.section)),
  );

  return (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
        Administrare
      </p>
      {items.map((item) => {
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
              <span className="ml-auto rounded bg-zinc-800/70 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                soon
              </span>
            </span>
          );
        }
        // Stays visible on the list too: it counts unread THREADS, so it should
        // agree with the "nou" rows you're looking at. It only drops as you open
        // them.
        const badge = item.href === "/tickets" ? badges?.tickets ?? 0 : 0;
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            // Hover is zinc-800/60, not zinc-900: the nav sits on the chrome
            // surface, which IS zinc-900 in light mode — the old hover would
            // have been invisible there.
            className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-indigo-500/10 font-medium text-indigo-300"
                : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
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
            {badge > 0 && (
              <span
                title={`${badge} ${badge === 1 ? "ticket necitit" : "tickete necitite"}`}
                className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-indigo-500 px-1.5 text-xs font-semibold tabular-nums text-white"
              >
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function DashboardShell({
  user,
  badges,
  sections,
  children,
}: {
  user: ShellUser;
  badges?: NavBadges;
  // Allowed section keys for this manager; null/undefined = full access.
  sections?: string[] | null;
  children: React.ReactNode;
}) {
  // Controlled only so a nav link can close the drawer behind it.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const userMenu = useMenuModality();

  return (
    /* Same frame as the app shell: a full-height navigation column beside a
       content column that owns its header, so the two never cross borders at
       the corner. Chrome behind, content panel lifted one step off it — written
       per theme because the light palette mirrors the zinc scale. */
    <div className="flex min-h-screen bg-zinc-900 text-zinc-50 dark:bg-zinc-950">
      {/* ===== Desktop navigation column ===== */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col md:flex">
        <div className="flex h-16 shrink-0 items-center gap-2 px-5">
          {/* White-wordmark logo for dark mode, black-wordmark for light.
              Click → dashboard overview. select-none: it is chrome, not content,
              so dragging across it must not highlight it. */}
          <Link href="/" aria-label="Overview" className="flex shrink-0 select-none items-center">
            <Image
              src="/ngig-logo.png"
              alt="ngig.cloud"
              width={352}
              height={96}
              priority
              className="hidden h-9 w-auto dark:block"
            />
            <Image
              src="/ngig-logo-light.png"
              alt="ngig.cloud"
              width={352}
              height={96}
              priority
              className="block h-9 w-auto dark:hidden"
            />
          </Link>
        </div>
        <div className="px-5 pb-2">
          <RoleBadge role="admin" superAdmin={user.isSuperAdmin} />
        </div>
        <SidebarNav user={user} badges={badges} sections={sections} />
      </aside>

      {/* ===== Content column ===== */}
      <div className="flex min-w-0 flex-1 flex-col">
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 px-3 sm:px-5">
        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2 md:hidden">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Meniu"
                className="-ml-1 text-zinc-300 hover:bg-zinc-800/60 data-[state=open]:bg-zinc-800/60 data-[state=open]:text-zinc-50"
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-64 border-r border-zinc-800/60 bg-zinc-900 p-0 sm:max-w-64 md:hidden dark:bg-zinc-950"
              overlayClassName="md:hidden"
            >
              <SheetHeader className="sr-only">
                <SheetTitle>Administrare</SheetTitle>
              </SheetHeader>
              <div className="flex h-16 shrink-0 items-center px-5">
                <Image
                  src="/ngig-logo.png"
                  alt="ngig.cloud"
                  width={352}
                  height={96}
                  className="hidden h-9 w-auto dark:block"
                />
                <Image
                  src="/ngig-logo-light.png"
                  alt="ngig.cloud"
                  width={352}
                  height={96}
                  className="block h-9 w-auto dark:hidden"
                />
              </div>
              <div className="px-5 pb-2">
                <RoleBadge role="admin" superAdmin={user.isSuperAdmin} />
              </div>
              <SidebarNav
                user={user}
                badges={badges}
                sections={sections}
                onNavigate={() => setSidebarOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <Link href="/" aria-label="Overview" className="flex shrink-0 select-none items-center">
            <Image
              src="/ngig-logo.png"
              alt="ngig.cloud"
              width={352}
              height={96}
              priority
              className="hidden h-8 w-auto shrink-0 dark:block"
            />
            <Image
              src="/ngig-logo-light.png"
              alt="ngig.cloud"
              width={352}
              height={96}
              priority
              className="block h-8 w-auto shrink-0 dark:hidden"
            />
          </Link>
        </div>

        {/* right: notifications + theme + user menu (logout lives inside). The
            marker lets the notification panel hang off this cluster's right
            edge rather than off the bell, which sits in the middle of it. */}
        <div data-navbar-actions className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
          <NotificationBell />
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild {...userMenu.triggerProps}>
              <Button
                variant="ghost"
                className="group h-auto gap-2 rounded-lg py-1.5 pl-1.5 pr-2 text-zinc-300 hover:bg-zinc-800/60 hover:text-zinc-50 data-[state=open]:bg-zinc-800/60 data-[state=open]:text-zinc-50"
              >
                <Avatar username={user.username} />
                <span className="hidden max-w-[120px] select-none truncate font-medium sm:inline">
                  {user.username}
                </span>
                <ChevronDown className="h-4 w-4 text-zinc-500 transition-transform group-data-[state=open]:rotate-180" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-64 p-0" {...userMenu.contentProps}>
              <div className="flex items-center gap-3 border-b border-zinc-800 px-4 py-3.5">
                <Avatar username={user.username} className="h-9 w-9 text-sm" />
                <div className="min-w-0">
                  {/* Name is a label; the email below stays selectable so it can
                      still be copied. */}
                  <p className="flex select-none items-center gap-1.5 truncate text-sm font-semibold text-zinc-100">
                    {user.username}
                    <RoleBadge role="admin" superAdmin={user.isSuperAdmin} />
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{user.email}</p>
                </div>
              </div>

              {/* A read-only fact, so deliberately not a menu item: it must not
                  take focus or look clickable. */}
              <DropdownMenuLabel className="mx-1.5 flex items-center justify-between px-2.5 py-2 font-normal">
                <span className="flex items-center gap-2.5 text-zinc-400">
                  <ShieldCheck className="h-4 w-4" /> Rol
                </span>
                <span className="font-medium text-zinc-200">
                  {user.isSuperAdmin ? "Super admin" : "Manager"}
                </span>
              </DropdownMenuLabel>

              <DropdownMenuSeparator className="mx-0" />
              <DropdownMenuGroup className="p-1.5">
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => {
                    void dashboardSignOut();
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

      {/* The lifted content panel — the rounded corner meeting the sidebar is
          what makes this read as an application frame. */}
      <main className="min-w-0 flex-1 border-zinc-200/70 bg-zinc-950 dark:border-zinc-800/60 dark:bg-zinc-900/30 md:rounded-tl-2xl md:border-l md:border-t">
        {children}
      </main>
      </div>
    </div>
  );
}
