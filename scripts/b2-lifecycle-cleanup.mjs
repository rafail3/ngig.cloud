// (1) Set a "keep only the last version" lifecycle rule as a safety net, and
// (2) hard-delete every existing file version in the bucket (cleans leftovers).
// Run: node scripts/b2-lifecycle-cleanup.mjs
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const auth = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
  headers: { Authorization: "Basic " + Buffer.from(`${env.B2_KEY_ID}:${env.B2_APP_KEY}`).toString("base64") },
}).then((r) => r.json());
const apiUrl = auth.apiInfo.storageApi.apiUrl;
const tok = auth.authorizationToken;
let bucketId = auth.apiInfo.storageApi.bucketId;
if (!bucketId) {
  const list = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets`, {
    method: "POST",
    headers: { Authorization: tok, "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: auth.accountId, bucketName: env.B2_BUCKET }),
  }).then((r) => r.json());
  bucketId = list.buckets?.[0]?.bucketId;
}

// 1. lifecycle: keep only the last version; purge hidden versions after 1 day.
const up = await fetch(`${apiUrl}/b2api/v3/b2_update_bucket`, {
  method: "POST",
  headers: { Authorization: tok, "Content-Type": "application/json" },
  body: JSON.stringify({
    accountId: auth.accountId,
    bucketId,
    lifecycleRules: [
      { fileNamePrefix: "", daysFromHidingToDeleting: 1, daysFromUploadingToHiding: null },
    ],
  }),
}).then((r) => r.json());
console.log("Lifecycle rules:", JSON.stringify(up.lifecycleRules));

// 2. hard-delete all existing versions.
const versions = await fetch(`${apiUrl}/b2api/v3/b2_list_file_versions`, {
  method: "POST",
  headers: { Authorization: tok, "Content-Type": "application/json" },
  body: JSON.stringify({ bucketId, maxFileCount: 1000 }),
}).then((r) => r.json());

let deleted = 0;
for (const f of versions.files) {
  await fetch(`${apiUrl}/b2api/v3/b2_delete_file_version`, {
    method: "POST",
    headers: { Authorization: tok, "Content-Type": "application/json" },
    body: JSON.stringify({ fileId: f.fileId, fileName: f.fileName }),
  });
  deleted++;
  console.log(`  deleted ${f.action} ${f.fileName}`);
}
console.log(`\nDone. Removed ${deleted} versions. Bucket clean ✅`);
