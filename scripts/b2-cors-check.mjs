// Diagnose browser-side CORS: presign a PUT, then send a CORS preflight
// (OPTIONS) the way a browser would, and print the Access-Control-* response.
import { readFileSync } from "node:fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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

const url = await getSignedUrl(
  client,
  new PutObjectCommand({ Bucket: bucket, Key: `_corscheck/test`, ContentType: "image/jpeg" }),
  { expiresIn: 120 },
);

for (const origin of ["http://localhost:3002", "http://192.168.1.2:3002"]) {
  const res = await fetch(url, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "PUT",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  console.log(`\nOrigin ${origin} -> preflight ${res.status}`);
  console.log("  allow-origin :", res.headers.get("access-control-allow-origin"));
  console.log("  allow-methods:", res.headers.get("access-control-allow-methods"));
  console.log("  allow-headers:", res.headers.get("access-control-allow-headers"));
}
