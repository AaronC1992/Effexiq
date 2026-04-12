import { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, or R2_SECRET_ACCESS_KEY');
  }
  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

let _r2;
const r2 = () => (_r2 ??= getR2Client());

const BUCKET = () => process.env.R2_BUCKET_NAME || 'Effexiq-sounds';

/** Get a short-lived presigned download URL for a sound file */
export async function getPresignedUrl(key, expiresIn = 3600) {
  const command = new GetObjectCommand({ Bucket: BUCKET(), Key: key });
  return getSignedUrl(r2(), command, { expiresIn });
}

/** Upload a file buffer to R2 */
export async function uploadFile(key, body, contentType = 'audio/mpeg') {
  const command = new PutObjectCommand({
    Bucket: BUCKET(),
    Key: key,
    Body: body,
    ContentType: contentType,
  });
  return r2().send(command);
}

/** List all objects under an optional prefix */
export async function listFiles(prefix = '') {
  const command = new ListObjectsV2Command({
    Bucket: BUCKET(),
    Prefix: prefix,
  });
  const result = await r2().send(command);
  return (result.Contents ?? []).map(obj => ({ key: obj.Key, size: obj.Size }));
}
