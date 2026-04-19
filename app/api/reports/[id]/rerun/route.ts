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
      return NextResponse.json(
        {
          error:
            "Deep analysis reports can no longer be rerun. Open Technical Analysis for a fresh report, or keep this copy as a historical snapshot.",
        },
        { status: 410 }
      );
    } else if (originalReport.type === "strategy-analysis") {
      return NextResponse.json(
        { error: "Strategy analysis reports can no longer be rerun. This feature has been removed." },
        { status: 410 }
      );
    } else if (originalReport.type === "technical-analysis") {
      // Call technical analysis endpoint
      const response = await fetch(
        `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/api/technical-analysis`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: request.headers.get("cookie") || "",
          },
          body: JSON.stringify({
            symbol: parameters.symbol,
            timeframe: parameters.timeframe || "1day",
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.message || `Analysis failed: ${response.statusText}`);
      }

      newReportData = await response.json();
      
      // Technical analysis doesn't use caching the same way, but we can store metadata
      newCachedData = {
        lastUpdated: new Date().toISOString(),
        symbol: parameters.symbol,
        timeframe: parameters.timeframe || "1day",
      };
    } else {
      return NextResponse.json(
        { error: "Unsupported report type for rerun" },
        { status: 400 }
      );
    }

    // Prepare update data
    const updateData: any = {
      reportData: newReportData,
      cachedData: newCachedData,
      lastRerunAt: new Date(),
      updatedAt: new Date(),
    };

    // For technical analysis, update description with latest signal info
    if (originalReport.type === "technical-analysis" && newReportData.signalStrength) {
      updateData.description = `${newReportData.signalStrength.direction?.toUpperCase() || 'N/A'} signal (${newReportData.signalStrength.grade || 'N/A'}) - ${newReportData.recommendation?.strategy || 'N/A'}`;
      
      // Update tags with latest info
      updateData.tags = [
        "technical-analysis",
        parameters.symbol,
        newReportData.signalStrength.direction || "neutral",
        newReportData.recommendation?.direction || "wait",
        parameters.timeframe || "1day",
      ];
    }

    // Update the report with new data
    const updatedReport = await prisma.savedReport.update({
      where: { id: originalReport.id },
      data: updateData,
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

