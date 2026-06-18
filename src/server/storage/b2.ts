import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectVersionsCommand,
  ListObjectsV2Command,
  HeadObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  ListMultipartUploadsCommand,
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

// ---- Multipart upload -----------------------------------------------------
// Large files upload as many parts in PARALLEL (much faster + resilient). The
// browser PUTs each part to a presigned URL; we never proxy the bytes. We
// complete server-side via ListParts so the client never needs to read the
// cross-origin ETag header (which would require extra B2 CORS config).

// Start a multipart upload; returns the uploadId that ties the parts together.
export async function createMultipart(
  key: string,
  contentType: string,
): Promise<string> {
  const res = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
  );
  if (!res.UploadId) throw new Error("Nu am putut iniția upload-ul.");
  return res.UploadId;
}

// Presigned PUT URL for one part (parts are numbered from 1).
export function presignUploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
  expiresIn = 3600,
) {
  return getSignedUrl(
    client,
    new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn },
  );
}

// Finish the upload. We read the uploaded parts (and their ETags) from B2 with
// ListParts, so the client doesn't have to report them.
export async function completeMultipart(
  key: string,
  uploadId: string,
): Promise<void> {
  const listed = await client.send(
    new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: uploadId }),
  );
  const parts = (listed.Parts ?? [])
    .filter((p) => p.PartNumber != null && p.ETag)
    .sort((a, b) => (a.PartNumber ?? 0) - (b.PartNumber ?? 0))
    .map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag }));
  if (parts.length === 0) throw new Error("Niciun fragment încărcat.");

  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }),
  );
}

// Which parts of a multipart upload are already on B2 (for resuming after a
// page refresh). Returns the 1-based part numbers and their sizes.
export async function listUploadedParts(
  key: string,
  uploadId: string,
): Promise<{ partNumber: number; size: number }[]> {
  const listed = await client.send(
    new ListPartsCommand({ Bucket: bucket, Key: key, UploadId: uploadId }),
  );
  return (listed.Parts ?? [])
    .filter((p) => p.PartNumber != null)
    .map((p) => ({ partNumber: p.PartNumber as number, size: p.Size ?? 0 }));
}

// Cancel an in-flight multipart upload (on client error) so no orphan parts are
// left being billed.
export async function abortMultipart(
  key: string,
  uploadId: string,
): Promise<void> {
  await client.send(
    new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId }),
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

// Server-side copy of an object to a new key (no bytes through us). Our keys are
// `<owner>/<uuid>` — only URL-safe chars — so CopySource needs no extra encoding.
export async function copyObject(srcKey: string, destKey: string): Promise<void> {
  await client.send(
    new CopyObjectCommand({
      Bucket: bucket,
      Key: destKey,
      CopySource: `${bucket}/${srcKey}`,
    }),
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

// Completely remove a key: every version AND every hide/delete marker, by
// versionId. We deliberately do NOT fall back to a plain DeleteObject — on a
// versioned bucket that just adds another hide marker (a 0-byte orphan), which
// is exactly what we're cleaning up. If nothing is listed, there's nothing to do.
// Raw object stream (Node Readable) — used to pipe a file into a zip archive.
export async function getObjectStream(key: string): Promise<NodeJS.ReadableStream> {
  const res = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  return res.Body as NodeJS.ReadableStream;
}

export async function deleteObject(key: string) {
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;
  do {
    const listed = await client.send(
      new ListObjectVersionsCommand({
        Bucket: bucket,
        Prefix: key,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
      }),
    );
    const versions = [
      ...(listed.Versions ?? []),
      ...(listed.DeleteMarkers ?? []),
    ].filter((v) => v.Key === key && v.VersionId);

    await Promise.all(
      versions.map((v) =>
        client.send(
          new DeleteObjectCommand({ Bucket: bucket, Key: key, VersionId: v.VersionId }),
        ),
      ),
    );

    keyMarker = listed.IsTruncated ? listed.NextKeyMarker : undefined;
    versionIdMarker = listed.IsTruncated ? listed.NextVersionIdMarker : undefined;
  } while (keyMarker);
}

// Sweep a prefix clean of leftovers, regardless of how they appeared (deleting
// from the B2 console, an interrupted upload, etc.):
//  - every hide/delete marker (0-byte orphans that "hide" an object)
//  - incomplete multipart uploads older than `abortOlderThanMs` (abandoned, but
//    still billed). The age cutoff avoids killing an upload that's mid-flight or
//    being resumed.
export async function cleanupPrefix(
  prefix: string,
  abortOlderThanMs = 24 * 60 * 60 * 1000,
): Promise<void> {
  // 1) Delete markers.
  let keyMarker: string | undefined;
  let versionIdMarker: string | undefined;
  do {
    const listed = await client.send(
      new ListObjectVersionsCommand({
        Bucket: bucket,
        Prefix: prefix,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
      }),
    );
    const markers = (listed.DeleteMarkers ?? []).filter((m) => m.Key && m.VersionId);
    await Promise.all(
      markers.map((m) =>
        client.send(
          new DeleteObjectCommand({
            Bucket: bucket,
            Key: m.Key!,
            VersionId: m.VersionId,
          }),
        ),
      ),
    );
    keyMarker = listed.IsTruncated ? listed.NextKeyMarker : undefined;
    versionIdMarker = listed.IsTruncated ? listed.NextVersionIdMarker : undefined;
  } while (keyMarker);

  // 2) Abandoned multipart uploads.
  const cutoff = Date.now() - abortOlderThanMs;
  let uploadIdMarker: string | undefined;
  let mpKeyMarker: string | undefined;
  do {
    const listed = await client.send(
      new ListMultipartUploadsCommand({
        Bucket: bucket,
        Prefix: prefix,
        KeyMarker: mpKeyMarker,
        UploadIdMarker: uploadIdMarker,
      }),
    );
    const stale = (listed.Uploads ?? []).filter(
      (u) =>
        u.Key &&
        u.UploadId &&
        (!u.Initiated || u.Initiated.getTime() < cutoff),
    );
    await Promise.all(
      stale.map((u) =>
        client.send(
          new AbortMultipartUploadCommand({
            Bucket: bucket,
            Key: u.Key!,
            UploadId: u.UploadId!,
          }),
        ),
      ),
    );
    mpKeyMarker = listed.IsTruncated ? listed.NextKeyMarker : undefined;
    uploadIdMarker = listed.IsTruncated ? listed.NextUploadIdMarker : undefined;
  } while (mpKeyMarker);
}
