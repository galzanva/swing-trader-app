import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

/**
 * POST /api/reports/[id]/duplicate
 * Duplicate a saved report
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

    // Get optional new title from body
    const body = await request.json().catch(() => ({}));
    const newTitle = body.title || `${originalReport.title} (Copy)`;

    // Create duplicate (cast Json to InputJsonValue for Prisma compatibility)
    const duplicatedReport = await prisma.savedReport.create({
      data: {
        userId: user.id,
        type: originalReport.type,
        title: newTitle,
        description: originalReport.description,
        parameters: originalReport.parameters as Prisma.InputJsonValue,
        reportData: originalReport.reportData as Prisma.InputJsonValue,
        cachedData: originalReport.cachedData != null ? (originalReport.cachedData as Prisma.InputJsonValue) : undefined,
        tags: originalReport.tags,
        version: originalReport.version,
        isPinned: false, // Don't duplicate pinned status
      },
    });

    console.log(`[DuplicateReport] Duplicated report ${originalReport.id} to ${duplicatedReport.id} for user ${user.email}`);

    return NextResponse.json({
      success: true,
      reportId: duplicatedReport.id,
      report: duplicatedReport,
      message: "Report duplicated successfully",
    });
  } catch (error: any) {
    console.error("[DuplicateReport] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to duplicate report" },
      { status: 500 }
    );
  }
}

