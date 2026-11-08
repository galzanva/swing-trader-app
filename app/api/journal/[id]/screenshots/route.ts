import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import {
  MAX_IMAGE_BYTES,
  blobConfigured,
  deletePrivate,
  deletePrivateOrThrow,
  putPrivateImage,
  sniffImage,
  tradeScreenshotPath,
} from '@/lib/storage/blob';

const MAX_SHOTS = 4;

async function ownedTrade(userId: string, tradeId: string) {
  return prisma.tradeJournal.findFirst({
    where: { id: tradeId, userId },
    select: { id: true },
  });
}

function shotView(tradeId: string, shot: { id: string; createdAt: Date }) {
  return {
    id: shot.id,
    createdAt: shot.createdAt,
    url: `/api/journal/${tradeId}/screenshots/${shot.id}`,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const trade = await ownedTrade(session.user.id, id);
  if (!trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 });

  const screenshots = await prisma.tradeScreenshot.findMany({
    where: { tradeId: id, userId: session.user.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true },
  });
  return NextResponse.json({ success: true, screenshots: screenshots.map((s) => shotView(id, s)) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const userId = session.user.id;
  const { id } = await params;
  const trade = await ownedTrade(userId, id);
  if (!trade) return NextResponse.json({ error: 'Trade not found' }, { status: 404 });

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

  const count = await prisma.tradeScreenshot.count({ where: { tradeId: id } });
  if (count >= MAX_SHOTS) {
    return NextResponse.json({ error: `Up to ${MAX_SHOTS} screenshots per trade` }, { status: 400 });
  }

  if (!blobConfigured()) {
    console.warn('[screenshots] Blob is not configured; storing the image in the database');
    const shot = await prisma.tradeScreenshot.create({
      data: {
        tradeId: id,
        userId,
        contentType: type,
        size: bytes.length,
        data: `data:${type};base64,${Buffer.from(bytes).toString('base64')}`,
      },
      select: { id: true, createdAt: true },
    });
    return NextResponse.json({ success: true, screenshot: shotView(id, shot) });
  }

  const pathname = tradeScreenshotPath(userId, id, type);
  try {
    await putPrivateImage(pathname, bytes, type);
  } catch (error) {
    console.error('[screenshots] blob upload failed', error);
    return NextResponse.json({ error: 'Upload failed. Try again.' }, { status: 502 });
  }
  try {
    const shot = await prisma.tradeScreenshot.create({
      data: { tradeId: id, userId, blobPath: pathname, contentType: type, size: bytes.length },
      select: { id: true, createdAt: true },
    });
    return NextResponse.json({ success: true, screenshot: shotView(id, shot) });
  } catch (error) {
    await deletePrivate(pathname);
    throw error;
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const shotId = new URL(request.url).searchParams.get('shotId');
  if (!shotId) return NextResponse.json({ error: 'Missing screenshot' }, { status: 400 });
  const shot = await prisma.tradeScreenshot.findFirst({
    where: { id: shotId, tradeId: id, userId: session.user.id },
    select: { id: true, blobPath: true },
  });
  if (!shot) return NextResponse.json({ success: true });
  if (shot.blobPath) {
    try {
      await deletePrivateOrThrow(shot.blobPath);
    } catch (error) {
      console.error('[screenshots] blob delete failed', shot.blobPath, error);
      return NextResponse.json({ error: 'Could not delete the screenshot from storage. Try again.' }, { status: 502 });
    }
  }
  await prisma.tradeScreenshot.delete({ where: { id: shot.id } });
  return NextResponse.json({ success: true });
}
