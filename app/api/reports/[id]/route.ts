import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/reports/[id]
 * Get a specific saved report
 */
export async function GET(
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

    // Get report
    const report = await prisma.savedReport.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Update last viewed timestamp
    await prisma.savedReport.update({
      where: { id: report.id },
      data: { lastViewedAt: new Date() },
    });

    return NextResponse.json({ report });
  } catch (error: any) {
    console.error("[GetReport] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch report" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/reports/[id]
 * Delete a saved report
 */
export async function DELETE(
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

    // Check if report exists and belongs to user
    const report = await prisma.savedReport.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Delete report
    await prisma.savedReport.delete({
      where: { id: report.id },
    });

    console.log(`[DeleteReport] Deleted report ${report.id} for user ${user.email}`);

    return NextResponse.json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error: any) {
    console.error("[DeleteReport] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete report" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/reports/[id]
 * Update report metadata (title, description, tags, pinned)
 */
export async function PATCH(
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

    // Check if report exists and belongs to user
    const report = await prisma.savedReport.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const body = await request.json();
    const { title, description, tags, isPinned } = body;

    // Build update data
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (tags !== undefined) updateData.tags = tags;
    if (isPinned !== undefined) updateData.isPinned = isPinned;

    // Update report
    const updatedReport = await prisma.savedReport.update({
      where: { id: report.id },
      data: updateData,
    });

    console.log(`[UpdateReport] Updated report ${report.id} for user ${user.email}`);

    return NextResponse.json({
      success: true,
      report: updatedReport,
      message: "Report updated successfully",
    });
  } catch (error: any) {
    console.error("[UpdateReport] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update report" },
      { status: 500 }
    );
  }
}

