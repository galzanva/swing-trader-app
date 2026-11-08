import { randomUUID } from 'crypto';
import { del, get, put } from '@vercel/blob';

// Private store: blob URLs are never sent to the browser. Every read goes
// through an authenticated route that checks the trade belongs to the user.

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
} as const;

export type ImageType = keyof typeof IMAGE_TYPES;

/** BLOB_READ_WRITE_TOKEN works anywhere. BLOB_STORE_ID needs Vercel's OIDC token, which deployments get automatically. */
export function blobConfigured(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN) return true;
  return Boolean(process.env.BLOB_STORE_ID && (process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL === '1'));
}

/** Trusts the bytes, not the browser's MIME type. */
export function sniffImage(bytes: Uint8Array): ImageType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (
    bytes.length >= 8
    && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return 'image/png';
  if (
    bytes.length >= 12
    && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
    && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) return 'image/webp';
  return null;
}

export function tradeScreenshotPath(userId: string, tradeId: string, type: ImageType): string {
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, '');
  return `users/${safe(userId)}/trades/${safe(tradeId)}/${randomUUID()}.${IMAGE_TYPES[type]}`;
}

export async function putPrivateImage(pathname: string, bytes: Uint8Array, type: ImageType) {
  return put(pathname, Buffer.from(bytes), {
    access: 'private',
    contentType: type,
    addRandomSuffix: false,
    allowOverwrite: false,
  });
}

export async function readPrivate(pathname: string) {
  const result = await get(pathname, { access: 'private' });
  if (!result || result.statusCode !== 200) return null;
  return result;
}

/** Throws if the store refuses, so the caller can keep the row and let the user retry. */
export async function deletePrivateOrThrow(pathname: string) {
  await del(pathname);
}

/** Best effort: a missing blob must not block deleting the row that pointed at it. */
export async function deletePrivate(pathnames: string | string[]) {
  const list = (Array.isArray(pathnames) ? pathnames : [pathnames]).filter(Boolean);
  if (!list.length || !blobConfigured()) return;
  try {
    await del(list);
  } catch (error) {
    console.error('[blob] delete failed', list, error);
  }
}

export function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; type: ImageType } | null {
  const match = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
  if (!match) return null;
  const bytes = new Uint8Array(Buffer.from(match[2], 'base64'));
  const type = sniffImage(bytes);
  return type ? { bytes, type } : null;
}
