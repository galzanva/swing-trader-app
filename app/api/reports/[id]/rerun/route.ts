import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * POST /api/reports/[id]/rerun
 * Rerun analysis with latest data, optimizing by reusing cached data
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    // Get original report
    const originalReport = await prisma.savedReport.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!originalReport) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Extract parameters for rerun
    const parameters = originalReport.parameters as any;
    const cachedData = originalReport.cachedData as any;

    // Determine which endpoint to call based on report type
    let newReportData;
    let newCachedData = cachedData; // Start with existing cache

    if (originalReport.type === "deep-analysis") {
      // Call deep analysis endpoint
      const response = await fetch(
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: request.headers.get("cookie") || "",
          },
          body: JSON.stringify({
            symbol: parameters.symbol,
            timeframe: parameters.timeframe,
            useCachedData: cachedData !== null,
            cachedData: cachedData,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      newReportData = await response.json();
      
      // Update cache with new data if available
      if (newReportData.cacheableData) {
        newCachedData = {
          ...cachedData,
          ...newReportData.cacheableData,
          lastUpdated: new Date().toISOString(),
        };
      }
    } else if (originalReport.type === "strategy-analysis") {
      // Call strategy analysis endpoint
      const response = await fetch(
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/strategy-analyze`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: request.headers.get("cookie") || "",
          },
          body: JSON.stringify({
            symbol: parameters.symbol,
            timeframe: parameters.timeframe,
            strategyId: parameters.strategyId,
            useCachedData: cachedData !== null,
            cachedData: cachedData,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      newReportData = await response.json();
      
      // Update cache
      if (newReportData.cacheableData) {
        newCachedData = {
          ...cachedData,
          ...newReportData.cacheableData,
          lastUpdated: new Date().toISOString(),
        };
      }
    } else {
      return NextResponse.json(
        { error: "Unsupported report type for rerun" },
        { status: 400 }
      );
    }

    // Update the report with new data
    const updatedReport = await prisma.savedReport.update({
      where: { id: originalReport.id },
      data: {
        reportData: newReportData,
        cachedData: newCachedData,
        lastRerunAt: new Date(),
        updatedAt: new Date(),
      },
    });

    console.log(`[RerunReport] Reran report ${originalReport.id} for user ${user.email}`);

    return NextResponse.json({
      success: true,
      report: updatedReport,
      message: "Report rerun successfully",
    });
  } catch (error: any) {
    console.error("[RerunReport] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to rerun report" },
      { status: 500 }
    );
  }
}

