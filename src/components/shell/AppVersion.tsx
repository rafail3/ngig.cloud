// The deployed app version, baked from package.json at build time (NEXT_PUBLIC_
// env is inlined), so it updates on every prod deploy. release-please bumps the
// package version on each release, which is what ships here. Plain text.
export function AppVersion({ className = "" }: { className?: string }) {
  const v = process.env.NEXT_PUBLIC_APP_VERSION;
  if (!v) return null;
  return (
    <span className={`text-xs font-medium tabular-nums text-zinc-400 ${className}`}>v{v}</span>
  );
}
