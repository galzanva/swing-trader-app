import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { playbookDiscipline } from '@/lib/playbooks';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const playbookId = request.nextUrl.searchParams.get('playbookId');
  const report = await playbookDiscipline(session.user.id, playbookId);
  return NextResponse.json({ success: true, ...report });
}
