import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import {
  MAX_IMAGE_BYTES,
  blobConfigured,
  dataUrlToBytes,
  deletePrivate,
  putPrivateImage,
  readPrivate,
  sniffImage,
  tradeScreenshotPath,
} from '@/lib/storage/blob';

const HEADERS = {
  // Edits replace the same URL, so the browser must revalidate.
  'Cache-Control': 'private, no-cache',
  'X-Content-Type-Options': 'nosniff',
  'Content-Disposition': 'inline',
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; shotId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id, shotId } = await params;

  const shot = await prisma.tradeScreenshot.findFirst({
    where: { id: shotId, tradeId: id, userId: session.user.id, trade: { userId: session.user.id } },
    select: { blobPath: true, contentType: true, data: true },
  });
  if (!shot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (shot.blobPath) {
    try {
      const blob = await readPrivate(shot.blobPath);
      if (!blob) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      return new Response(blob.stream, {
        headers: { ...HEADERS, 'Content-Type': shot.contentType || blob.blob.contentType },
      });
    } catch (error) {
      console.error('[screenshots] blob read failed', error);
      return NextResponse.json({ error: 'Could not load image' }, { status: 502 });
    }
  }

  const legacy = shot.data ? dataUrlToBytes(shot.data) : null;
  if (!legacy) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new Response(Buffer.from(legacy.bytes), {
    headers: { ...HEADERS, 'Content-Type': legacy.type },
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; shotId: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const { id, shotId } = await params;

  const shot = await prisma.tradeScreenshot.findFirst({
    where: { id: shotId, tradeId: id, userId, trade: { userId } },
    select: { id: true, blobPath: true },
  });
  if (!shot) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Attach a JPEG, PNG, or WebP image' }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image is too large. Try a smaller screenshot.' }, { status: 400 });
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffImage(bytes);
  if (!type) return NextResponse.json({ error: 'Attach a JPEG, PNG, or WebP image' }, { status: 400 });

  if (!blobConfigured()) {
    await prisma.tradeScreenshot.update({
      where: { id: shot.id },
      data: {
        contentType: type,
        size: bytes.length,
        data: `data:${type};base64,${Buffer.from(bytes).toString('base64')}`,
        blobPath: null,
      },
    });
    return NextResponse.json({
      success: true,
      screenshot: { id: shot.id, url: `/api/journal/${id}/screenshots/${shot.id}` },
    });
  }

  const pathname = tradeScreenshotPath(userId, id, type);
  try {
    await putPrivateImage(pathname, bytes, type);
  } catch (error) {
    console.error('[screenshots] blob replace failed', error);
    return NextResponse.json({ error: 'Save failed. Try again.' }, { status: 502 });
  }

  try {
    await prisma.tradeScreenshot.update({
      where: { id: shot.id },
      data: { blobPath: pathname, contentType: type, size: bytes.length, data: null },
    });
  } catch (error) {
    await deletePrivate(pathname);
    throw error;
  }
  if (shot.blobPath && shot.blobPath !== pathname) await deletePrivate(shot.blobPath);

  return NextResponse.json({
    success: true,
    screenshot: { id: shot.id, url: `/api/journal/${id}/screenshots/${shot.id}` },
  });
}
