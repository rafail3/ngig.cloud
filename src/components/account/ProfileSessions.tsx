import { Monitor, Smartphone, Tablet } from "lucide-react";
import { deviceLabel, deviceType } from "@/lib/user-agent";
import type { LoginDevice } from "@/server/account/profile";

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function typeIcon(ua: string | null) {
  const t = deviceType(ua);
  if (t === "Mobil") return <Smartphone className="h-4 w-4 text-zinc-400" />;
  if (t === "Tabletă") return <Tablet className="h-4 w-4 text-zinc-400" />;
  return <Monitor className="h-4 w-4 text-zinc-400" />;
}

export function ProfileSessions({ devices }: { devices: LoginDevice[] }) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 sm:p-5">
      <div className="mb-4 flex items-center gap-2 text-zinc-100">
        <Monitor className="h-5 w-5 text-indigo-400" />
        <h2 className="text-base font-semibold">Sesiuni de logare ({devices.length})</h2>
      </div>

      {devices.length === 0 ? (
        <p className="text-sm text-zinc-500">Nicio logare înregistrată.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {devices.map((d, i) => {
            const location = [d.city, d.country].filter(Boolean).join(", ");
            return (
              <li
                key={i}
                className="flex flex-col gap-1 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-zinc-100">
                    {typeIcon(d.user_agent)}
                    <span className="truncate">{deviceLabel(d.user_agent)}</span>
                    <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-400">
                      {deviceType(d.user_agent)}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">
                    IP: {d.ip ?? "necunoscut"}
                    {location && <span> · {location}</span>}
                  </p>
                </div>
                <div className="shrink-0 text-xs text-zinc-400 sm:text-right">
                  <p>Ultima logare</p>
                  <p className="text-zinc-300">{fmt(d.last_seen)}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
