import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/reports
 * List saved reports with pagination and search
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

    const { searchParams } = new URL(request.url);
    
    // Pagination
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const skip = (page - 1) * limit;

    // Filters
    const type = searchParams.get("type");
    const search = searchParams.get("search");
    const tag = searchParams.get("tag");
    const pinned = searchParams.get("pinned") === "true";

    // Build where clause
    const where: any = {
      userId: user.id,
    };

    if (type) {
      where.type = type;
    }

    if (pinned) {
      where.isPinned = true;
    }

    if (tag) {
      where.tags = {
        has: tag,
      };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    // Get total count and reports
    const [total, reports] = await Promise.all([
      prisma.savedReport.count({ where }),
      prisma.savedReport.findMany({
        where,
        select: {
          id: true,
          type: true,
          title: true,
          description: true,
          parameters: true,
          tags: true,
          isPinned: true,
          createdAt: true,
          updatedAt: true,
          lastViewedAt: true,
          lastRerunAt: true,
        },
        orderBy: [
          { isPinned: "desc" },
          { createdAt: "desc" },
        ],
        skip,
        take: limit,
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      reports,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasMore: page < totalPages,
      },
    });
  } catch (error: any) {
    console.error("[ListReports] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch reports" },
      { status: 500 }
    );
  }
}

