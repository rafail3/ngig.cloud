"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { formatBytes } from "@/lib/format";
import { formatUsd, type UserCost } from "@/lib/pricing";

type SortKey = "user" | "storage" | "egress" | "total";
type SortDir = "asc" | "desc";

const NUMERIC: Record<Exclude<SortKey, "user">, (u: UserCost) => number> = {
  storage: (u) => u.storageBytes,
  egress: (u) => u.egressBytes,
  total: (u) => u.totalCost,
};

// Per-user cost breakdown. Sortable columns; the Total column carries an inline
// proportion bar so the heaviest users read at a glance.
export function CostTable({ users }: { users: UserCost[] }) {
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
      <section className="rounded-2xl border border-zinc-800/70 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
        Niciun utilizator.
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-800/70 bg-zinc-900/40">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-zinc-800/80 text-left text-xs text-zinc-500">
              <Th label="Utilizator" col="user" sort={sort} dir={dir} onClick={toggle} />
              <Th label="Stocare" col="storage" sort={sort} dir={dir} onClick={toggle} align="right" />
              <Th label="Egress" col="egress" sort={sort} dir={dir} onClick={toggle} align="right" />
              <Th label="Total / lună" col="total" sort={sort} dir={dir} onClick={toggle} align="right" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((u) => {
              const pct = maxTotal > 0 ? (u.totalCost / maxTotal) * 100 : 0;
              return (
                <tr
                  key={u.id}
                  className="border-b border-zinc-900 transition-colors last:border-0 hover:bg-zinc-800/30"
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
                      <div className="h-1 w-24 overflow-hidden rounded-full bg-zinc-800">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500"
                          initial={reduced ? false : { width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                        />
                      </div>
                    </div>
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
