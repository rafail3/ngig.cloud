// One-off smoke test: presign PUT -> upload -> presign GET -> download ->
// verify bytes -> delete. Proves the full B2 storage path + credentials work.
// Run: node scripts/b2-smoke.mjs
import { readFileSync } from "node:fs";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const env = {};
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const region = env.B2_REGION;
const bucket = env.B2_BUCKET;
const client = new S3Client({
  region,
  endpoint: `https://s3.${region}.backblazeb2.com`,
  credentials: { accessKeyId: env.B2_KEY_ID, secretAccessKey: env.B2_APP_KEY },
});

const key = `_smoketest/${Date.now()}.txt`;
const body = `hello b2 ${new Date().toISOString()}`;

// 1. presigned PUT + upload
const putUrl = await getSignedUrl(
  client,
  new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: "text/plain" }),
  { expiresIn: 300 },
);
const putRes = await fetch(putUrl, { method: "PUT", body, headers: { "Content-Type": "text/plain" } });
console.log("PUT  ->", putRes.status, putRes.ok ? "OK" : "FAIL");
if (!putRes.ok) process.exit(1);

// 2. presigned GET + download
const getUrl = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 300 });
const getRes = await fetch(getUrl);
const got = await getRes.text();
console.log("GET  ->", getRes.status, got === body ? "bytes match" : "MISMATCH");

// 3. delete
await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
console.log("DEL  -> cleaned up", key);
console.log("\nB2 storage path OK ✅");
