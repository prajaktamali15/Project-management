import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { ApiResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return ApiResponse.unauthorized();

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length === 0) {
    return ApiResponse.success({ workspaces: [], projects: [] });
  }

  try {
    // Search workspaces where user is owner or member
    const workspaces = await prisma.workspace.findMany({
      where: {
        AND: [
          {
            OR: [
              { ownerId: user.id },
              { members: { some: { userId: user.id } } }
            ]
          },
          {
            name: {
              contains: query,
              mode: "insensitive"
            }
          }
        ]
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        owner: {
          select: { id: true, name: true, email: true }
        },
        _count: {
          select: { members: true, projects: true }
        }
      }
    });

    // Get all workspaces user has access to
    const userWorkspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { members: { some: { userId: user.id } } },
          { ownerId: user.id }
        ]
      },
      select: { id: true }
    });

    // Search projects in those workspaces
    const projects = await prisma.project.findMany({
      where: {
        AND: [
          { workspaceId: { in: userWorkspaces.map(w => w.id) } },
          {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } }
            ]
          }
        ]
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        workspace: {
          select: { id: true, name: true }
        },
        _count: {
          select: { tasks: true, members: true }
        }
      }
    });

    return ApiResponse.success({ workspaces, projects });
  } catch (err) {
    console.error("Error searching:", err);
    return ApiResponse.error("Internal Server Error");
  }
}
