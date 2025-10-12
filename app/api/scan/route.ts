
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { message: 'Scan endpoint stub. Cursor: implement scanning logic per docs/PRODUCT_OVERVIEW.md.' },
    { status: 501 }
  );
}
