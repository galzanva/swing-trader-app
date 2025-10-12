
import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { message: 'Analyze endpoint stub. Cursor: implement analysis logic per docs/PRODUCT_OVERVIEW.md.' },
    { status: 501 }
  );
}
