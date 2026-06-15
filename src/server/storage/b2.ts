import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectVersionsCommand,
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
