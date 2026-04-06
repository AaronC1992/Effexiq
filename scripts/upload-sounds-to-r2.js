/**
 * Upload all sound files from the local "Saved sounds" folder to Cloudflare R2.
 * Files are uploaded under the "Saved sounds/" prefix to match the Supabase `file` column.
 *
 * Usage: node scripts/upload-sounds-to-r2.js
 *
 * Requires .env.local to be loaded (uses dotenv).
 */

import 'dotenv/config';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { readdir, readFile, stat } from 'fs/promises';
import { join, extname } from 'path';

const SOUNDS_DIR = 'c:\\Users\\jenna\\Desktop\\Portfolio projects\\CueAI\\Saved sounds';
const BUCKET = process.env.R2_BUCKET_NAME || 'cueai-media';
const PREFIX = 'Saved sounds/';

const MIME_TYPES = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.webm': 'audio/webm',
};

const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function alreadyExists(key) {
  try {
    await r2.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function uploadAll() {
  const files = await readdir(SOUNDS_DIR);
  const audioFiles = files.filter(f => Object.keys(MIME_TYPES).includes(extname(f).toLowerCase()));

  console.log(`Found ${audioFiles.length} audio files to upload to R2 bucket "${BUCKET}"`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of audioFiles) {
    const key = `${PREFIX}${file}`;
    const ext = extname(file).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Skip if already uploaded
    if (await alreadyExists(key)) {
      skipped++;
      process.stdout.write(`  [skip] ${file}\r\n`);
      continue;
    }

    try {
      const filePath = join(SOUNDS_DIR, file);
      const body = await readFile(filePath);
      const fileStats = await stat(filePath);

      await r2.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000, immutable',
      }));

      uploaded++;
      const sizeMB = (fileStats.size / 1024 / 1024).toFixed(1);
      process.stdout.write(`  [${uploaded}/${audioFiles.length}] ${file} (${sizeMB} MB)\r\n`);
    } catch (err) {
      failed++;
      console.error(`  [FAIL] ${file}: ${err.message}`);
    }
  }

  console.log(`\nDone! Uploaded: ${uploaded}, Skipped: ${skipped}, Failed: ${failed}`);
}

uploadAll().catch(err => { console.error(err); process.exit(1); });
