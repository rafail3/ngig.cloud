"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { formatUsd, type UserCost } from "@/lib/pricing";
import { COST_CARD } from "./styles";

type SortKey = "user" | "storage" | "egress" | "total";
type SortDir = "asc" | "desc";

const NUMERIC: Record<Exclude<SortKey, "user">, (u: UserCost) => number> = {
  storage: (u) => u.storageBytes,
  egress: (u) => u.egressBytes,
  total: (u) => u.totalCost,
};

// Per-user cost breakdown. Sortable columns; the Total column carries an inline
// proportion bar so the heaviest users read at a glance.
export function CostTable({ users, month }: { users: UserCost[]; month: string }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [sort, setSort] = useState<SortKey>("total");
  const [dir, setDir] = useState<SortDir>("desc");

  const sorted = [...users].sort((a, b) => {
    const mult = dir === "asc" ? 1 : -1;
    if (sort === "user") {
      return mult * (a.username ?? "").localeCompare(b.username ?? "", "ro");
    }
    return mult * (NUMERIC[sort](a) - NUMERIC[sort](b));
  });

  const maxTotal = Math.max(...users.map((u) => u.totalCost), 0);

  function toggle(key: SortKey) {
    if (key === sort) {
      setDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setDir(key === "user" ? "asc" : "desc");
    }
  }

  if (users.length === 0) {
    return (
      <section className={`${COST_CARD} p-8 text-center text-sm text-zinc-500`}>
        Niciun utilizator.
      </section>
    );
  }

  const open = (id: string) => router.push(`/costs/${id}?m=${month}`);

  return (
    <section className={`overflow-hidden ${COST_CARD}`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800/80 text-left text-xs text-zinc-500">
              <Th label="Utilizator" col="user" sort={sort} dir={dir} onClick={toggle} />
              <Th label="Stocare" col="storage" sort={sort} dir={dir} onClick={toggle} align="right" />
              <Th label="Egress" col="egress" sort={sort} dir={dir} onClick={toggle} align="right" />
              <Th label="Total / lună" col="total" sort={sort} dir={dir} onClick={toggle} align="right" />
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => {
              const pct = maxTotal > 0 ? (u.totalCost / maxTotal) * 100 : 0;
              return (
                <tr
                  key={u.id}
                  onClick={() => open(u.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      open(u.id);
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label={`Detalii cost ${u.username ?? "utilizator"}`}
                  className="group cursor-pointer border-b border-zinc-900 outline-none transition-colors last:border-0 hover:bg-zinc-500/10 focus-visible:bg-zinc-500/10"
                >
                  <td className="px-4 py-3 font-medium text-zinc-200">
                    {u.username ?? <span className="text-zinc-500">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="tabular-nums text-zinc-200">{formatUsd(u.storageCost)}</span>
                    <span className="block text-[11px] tabular-nums text-zinc-500">
                      {formatBytes(u.storageBytes)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="tabular-nums text-zinc-200">{formatUsd(u.egressCost)}</span>
                    <span className="block text-[11px] tabular-nums text-zinc-500">
                      {formatBytes(u.egressBytes)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="font-semibold tabular-nums text-zinc-50">
                        {formatUsd(u.totalCost)}
                      </span>
                      <div className="h-1 w-24 overflow-hidden rounded-full bg-zinc-500/20">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500"
                          initial={reduced ? false : { width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="pr-3 text-right">
                    <ChevronRight className="ml-auto h-4 w-4 text-zinc-600 transition-colors group-hover:text-zinc-400" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Th({
  label,
  col,
  sort,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  col: SortKey;
  sort: SortKey;
  dir: SortDir;
  onClick: (c: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sort === col;
  const Icon = active ? (dir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <th
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
      className={`px-4 py-3 font-medium ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onClick(col)}
        className={`inline-flex items-center gap-1.5 transition-colors hover:text-zinc-200 ${
          active ? "text-zinc-200" : ""
        } ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {label}
        <Icon className={`h-3.5 w-3.5 ${active ? "text-indigo-400" : "text-zinc-600"}`} />
      </button>
    </th>
  );
}
