import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Backblaze B2 speaks the S3 API, so we use the AWS S3 SDK pointed at B2.
// Endpoint format: https://s3.<region>.backblazeb2.com (region e.g. eu-central-003).
// Credentials are an Application Key: keyID = accessKeyId, appKey = secretAccessKey.
const bucket = process.env.B2_BUCKET!;
const region = process.env.B2_REGION!;

const client = new S3Client({
  region,
  endpoint: `https://s3.${region}.backblazeb2.com`,
  credentials: {
    accessKeyId: process.env.B2_KEY_ID!,
    secretAccessKey: process.env.B2_APP_KEY!,
  },
});

// Presigned PUT URL — the browser uploads bytes straight to B2.
export function presignUpload(key: string, contentType: string, expiresIn = 600) {
  return getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

// Presigned GET that forces a download with the original filename.
export function presignDownload(key: string, filename: string, expiresIn = 600) {
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename.replace(/"/g, "")}"`,
    }),
    { expiresIn },
  );
}

// Presigned GET for inline viewing (previews).
export function presignView(key: string, expiresIn = 600) {
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn },
  );
}

// B2 keeps every version, so a plain S3 delete only adds a "hide" marker and
// the bytes linger (still billed). Delete every version of the key (the upload
// plus any hide markers) so removal is immediate and complete.
// Read an object's true size + content-type straight from B2. Used to verify
// an upload after the fact instead of trusting client-reported values.
// Returns null if the object doesn't exist.
export async function statObject(
  key: string,
): Promise<{ size: number; contentType: string | null } | null> {
  try {
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: key }),
    );
    return {
      size: head.ContentLength ?? 0,
      contentType: head.ContentType ?? null,
    };
  } catch {
    return null; // not found / not accessible
  }
}

// All object keys currently stored under a prefix (e.g. a user's `${userId}/`).
// One paginated ListObjects call — used to reconcile the DB against the bucket
// (a file deleted straight from B2 leaves a dangling DB row).
export async function listKeys(prefix: string): Promise<Set<string>> {
  const keys = new Set<string>();
  let token: string | undefined;
  do {
    const res = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      }),
    );
    for (const o of res.Contents ?? []) if (o.Key) keys.add(o.Key);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return keys;
}

export async function deleteObject(key: string) {
  const listed = await client.send(
    new ListObjectVersionsCommand({ Bucket: bucket, Prefix: key }),
  );
  const versions = [
    ...(listed.Versions ?? []),
    ...(listed.DeleteMarkers ?? []),
  ].filter((v) => v.Key === key && v.VersionId);

  if (versions.length === 0) {
    // Nothing versioned (e.g. versioning off): fall back to a direct delete.
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return;
  }

  await Promise.all(
    versions.map((v) =>
      client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key, VersionId: v.VersionId }),
      ),
    ),
  );
}
