import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db/prisma';
import { dataUrlToBytes, readPrivate } from '@/lib/storage/blob';

const HEADERS = {
  // The path holds a random id and never changes, so the browser may keep it.
  'Cache-Control': 'private, max-age=86400, immutable',
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
