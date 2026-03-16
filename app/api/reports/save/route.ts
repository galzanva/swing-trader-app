import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * POST /api/reports/save
 * Save a new analysis report
 */
export async function POST(request: Request) {
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

    const body = await request.json();
    const {
      type,
      title,
      description,
      parameters,
      reportData,
      cachedData,
      tags,
    } = body;

    // Validate required fields
    if (!type || !title || !parameters || !reportData) {
      return NextResponse.json(
        { error: "Missing required fields: type, title, parameters, reportData" },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ["deep-analysis", "backtest", "technical-analysis"];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(", ")}` },
        { status: 400 }
      );
    }

    // Create saved report
    const savedReport = await prisma.savedReport.create({
      data: {
        userId: user.id,
        type,
        title,
        description: description || null,
        parameters,
        reportData,
        cachedData: cachedData || null,
        tags: tags || [],
        version: "1.0",
      },
    });

    console.log(`[SaveReport] Created report ${savedReport.id} for user ${user.email}`);

    return NextResponse.json({
      success: true,
      reportId: savedReport.id,
      message: "Report saved successfully",
    });
  } catch (error: any) {
    console.error("[SaveReport] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to save report" },
      { status: 500 }
    );
  }
}

