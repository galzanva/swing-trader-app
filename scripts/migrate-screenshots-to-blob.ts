/**
 * Moves trade screenshots stored as base64 in Postgres into the private Blob store.
 * Safe to rerun: rows that already have a blobPath are skipped, and the base64
 * copy is cleared only after the upload succeeds.
 *
 *   npm run migrate:screenshots           # dry run
 *   npm run migrate:screenshots -- --run  # upload and update rows
 */
import { PrismaClient } from '@prisma/client';
import { blobConfigured, dataUrlToBytes, putPrivateImage, tradeScreenshotPath } from '../lib/storage/blob';

try {
  (process as unknown as { loadEnvFile?: (path: string) => void }).loadEnvFile?.('.env');
} catch {
  // .env is optional when the variables are already exported.
}

const prisma = new PrismaClient();
const run = process.argv.includes('--run');

async function main() {
  if (!blobConfigured()) {
    throw new Error('Blob is not configured. Set BLOB_READ_WRITE_TOKEN, or BLOB_STORE_ID with VERCEL_OIDC_TOKEN.');
  }
  const rows = await prisma.tradeScreenshot.findMany({
    where: { blobPath: null, data: { not: null } },
    select: { id: true, tradeId: true, userId: true, data: true },
  });
  console.log(`${rows.length} screenshot(s) still in the database${run ? '' : ' (dry run, pass --run to move them)'}`);

  let moved = 0;
  for (const row of rows) {
    const parsed = row.data ? dataUrlToBytes(row.data) : null;
    if (!parsed) {
      console.warn(`skip ${row.id}: not a JPEG, PNG, or WebP data URL`);
      continue;
    }
    const pathname = tradeScreenshotPath(row.userId, row.tradeId, parsed.type);
    console.log(`${row.id} -> ${pathname} (${parsed.bytes.length} bytes)`);
    if (!run) continue;
    await putPrivateImage(pathname, parsed.bytes, parsed.type);
    await prisma.tradeScreenshot.update({
      where: { id: row.id },
      data: { blobPath: pathname, contentType: parsed.type, size: parsed.bytes.length, data: null },
    });
    moved += 1;
  }
  if (run) console.log(`moved ${moved}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
