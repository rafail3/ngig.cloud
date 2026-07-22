#!/usr/bin/env node
// Wrapper for `supabase db push` that silences ONE known noise source: the
// experimental pg-delta "migrations catalog" cache fails on Windows because
// the edge-runtime container can't see the CA cert file the CLI writes
// (upstream bug). The failure is explicitly non-fatal — the push itself
// succeeds — but it dumps two full stack traces into the terminal after
// every applied migration.
//
// Everything else (prompts, migration list, real errors, exit code) passes
// through untouched. `npm run db:push:raw` keeps the unfiltered command.

import { spawn } from "node:child_process";

// A line is dropped only if it matches one of these fragments — all of them
// unique to the pg-delta catalog failure block.
const NOISE = [
  "failed to cache migrations catalog",
  "error exporting pg-delta catalog",
  "edge-runtime script produced no output",
  "runtime has escaped from the event loop",
  "event loop error:",
  "pgdelta-target-ca.crt",
  "getCertValue",
  "parseSslConfig",
  "createManagedPool",
  "sb-compile-edge-runtime",
  "main worker has been destroyed",
];

function filtered(chunk) {
  return chunk
    .toString()
    .split("\n")
    .filter((line) => !NOISE.some((n) => line.includes(n)))
    .join("\n");
}

// Single command string (not an args array) — with shell:true Node deprecates
// the array form (DEP0190). Extra CLI flags pass through verbatim.
const cmd = ["supabase", "db", "push", ...process.argv.slice(2)].join(" ");
const child = spawn(cmd, {
  shell: true,
  // stdin stays attached so the confirmation prompt still works.
  stdio: ["inherit", "pipe", "pipe"],
});

child.stdout.on("data", (c) => process.stdout.write(filtered(c)));
child.stderr.on("data", (c) => process.stderr.write(filtered(c)));
child.on("close", (code) => process.exit(code ?? 0));
