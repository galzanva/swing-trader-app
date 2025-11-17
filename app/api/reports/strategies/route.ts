import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/reports/strategies
 * Fetch all saved strategy analysis reports for the current user
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Fetch all strategy analysis reports for this user
    const reports = await prisma.savedReport.findMany({
      where: {
        userId: user.id,
        type: "strategy-analysis",
      },
      select: {
        id: true,
        title: true,
        description: true,
        parameters: true,
        tags: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`[GetStrategyReports] Found ${reports.length} strategy reports for user ${user.email}`);

    return NextResponse.json({
      success: true,
      reports: reports.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        symbol: (r.parameters as any)?.symbol || 'N/A',
        timeframe: (r.parameters as any)?.timeframe || '1day',
        tags: r.tags,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (error: any) {
    console.error("[GetStrategyReports] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch strategy reports", details: error.message },
      { status: 500 }
    );
  }
}

