import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/reports/search?ticker=AAPL
 * Search for saved reports by ticker symbol
 * Supports all report types (strategy-analysis, technical-analysis, deep-analysis)
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

    // Get ticker from query params
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get('ticker');

    if (!ticker) {
      return NextResponse.json({ 
        success: true, 
        reports: [] 
      });
    }

    // Fetch all reports for this user
    const allReports = await prisma.savedReport.findMany({
      where: {
        userId: user.id,
      },
      select: {
        id: true,
        type: true,
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

    // Filter reports by ticker (case-insensitive)
    // The symbol is stored in parameters.symbol
    const tickerUpper = ticker.toUpperCase();
    const filteredReports = allReports.filter(report => {
      const params = report.parameters as any;
      const reportSymbol = params?.symbol?.toUpperCase();
      return reportSymbol === tickerUpper;
    });

    console.log(`[SearchReports] Found ${filteredReports.length} reports for ticker ${ticker} (user: ${user.email})`);

    return NextResponse.json({
      success: true,
      reports: filteredReports.map(r => ({
        id: r.id,
        type: r.type,
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
    console.error("[SearchReports] Error:", error);
    return NextResponse.json(
      { error: "Failed to search reports", details: error.message },
      { status: 500 }
    );
  }
}
