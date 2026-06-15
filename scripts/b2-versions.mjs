// List ALL file versions in the bucket (incl. hidden / delete markers) so we
// can see what B2 is actually retaining. Run: node scripts/b2-versions.mjs
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
let bucketId = auth.apiInfo.storageApi.bucketId;
if (!bucketId) {
  const list = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets`, {
    method: "POST",
    headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: auth.accountId, bucketName: env.B2_BUCKET }),
  }).then((r) => r.json());
  bucketId = list.buckets?.[0]?.bucketId;
}

const res = await fetch(`${apiUrl}/b2api/v3/b2_list_file_versions`, {
  method: "POST",
  headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
  body: JSON.stringify({ bucketId, maxFileCount: 1000 }),
}).then((r) => r.json());

console.log(`Versions in ${env.B2_BUCKET}: ${res.files.length}`);
for (const f of res.files) {
  console.log(`  ${f.action.padEnd(6)} ${f.fileName}  ${f.contentLength}B  ${f.fileId.slice(0, 16)}…`);
}
