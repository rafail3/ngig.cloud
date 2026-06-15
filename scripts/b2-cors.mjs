// Apply CORS to the B2 bucket via the NATIVE B2 API (b2_update_bucket).
// The S3-compatible PutBucketCors does not reliably drive preflight on B2, so
// we set corsRules with explicit allowedOperations (s3_* + b2_*).
// Run: node scripts/b2-cors.mjs
import { readFileSync } from "node:fs";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const allowedOrigins = [
  "https://ngig.cloud",
  "https://www.ngig.cloud",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://192.168.1.2:3000",
  "http://192.168.1.2:3002",
];

// 1. authorize
const auth = await fetch("https://api.backblazeb2.com/b2api/v3/b2_authorize_account", {
  headers: { Authorization: "Basic " + Buffer.from(`${env.B2_KEY_ID}:${env.B2_APP_KEY}`).toString("base64") },
}).then((r) => r.json());

const apiUrl = auth.apiInfo.storageApi.apiUrl;
const accountId = auth.accountId;
let bucketId = auth.apiInfo.storageApi.bucketId; // set when the key is bucket-restricted

// 2. resolve bucketId by name if the key is not bucket-restricted
if (!bucketId) {
  const list = await fetch(`${apiUrl}/b2api/v3/b2_list_buckets`, {
    method: "POST",
    headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, bucketName: env.B2_BUCKET }),
  }).then((r) => r.json());
  bucketId = list.buckets?.[0]?.bucketId;
}
if (!bucketId) throw new Error("Could not resolve bucketId");

// 3. update bucket CORS
const res = await fetch(`${apiUrl}/b2api/v3/b2_update_bucket`, {
  method: "POST",
  headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
  body: JSON.stringify({
    accountId,
    bucketId,
    corsRules: [
      {
        corsRuleName: "ngigBrowserUpload",
        allowedOrigins,
        allowedOperations: [
          "s3_put",
          "s3_get",
          "s3_head",
          "s3_post",
          "b2_upload_file",
          "b2_download_file_by_name",
          "b2_download_file_by_id",
        ],
        allowedHeaders: ["*"],
        exposeHeaders: ["etag"],
        maxAgeSeconds: 3600,
      },
    ],
  }),
}).then((r) => r.json());

if (res.corsRules) {
  console.log("CORS applied to", env.B2_BUCKET, "✅");
  console.log(JSON.stringify(res.corsRules, null, 2));
} else {
  console.error("FAILED:", JSON.stringify(res, null, 2));
  process.exit(1);
}
