import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { authService } from "@/lib/authorization-service";
import { ApiResponse } from "@/lib/api-response";
import { ActivityLogger } from "@/lib/activity-logger";

// ✅ Zod validation schema for creating a project
const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "ON_HOLD"]).optional(),
  workspaceId: z.string().uuid(),
});

// ✅ POST /api/projects  → Create a new project
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return ApiResponse.unauthorized();
  }

  try {
    const body = await req.json();
    const { name, description, status, workspaceId } = CreateProjectSchema.parse(body);

    // Check if user is owner of workspace OR has proper role
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      return ApiResponse.notFound("Workspace");
    }
    
    // Check authorization
    const access = await authService.checkWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
    if (!access.allowed) {
      return ApiResponse.forbidden(access.reason);
    }

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name,
          description,
          status,
          workspaceId,
        },
      });

      await tx.projectMember.create({
        data: {
          userId: user.id,
          projectId: created.id,
          role: "OWNER",
        },
      });

      // Log activity
      await ActivityLogger.logProjectActivity(
        "created_project",
        created.id,
        workspaceId,
        user.id,
        { projectName: name }
      );

      return created;
    });

    return ApiResponse.created({ project });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return ApiResponse.validationError(err.flatten());
    }
    console.error("Error creating project:", err);
    return ApiResponse.error("Internal Server Error");
  }
}

// ✅ GET /api/projects?workspaceId=... → List projects for a workspace
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return ApiResponse.unauthorized();
  }

  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");
    const search = searchParams.get("search"); // Add search parameter

    // If workspaceId provided:
    if (workspaceId) {
      // Check authorization
      const access = await authService.checkWorkspaceAccess(user.id, workspaceId, ["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
      if (!access.allowed) {
        return ApiResponse.forbidden(access.reason);
      }

      const role = access.role!;

      // Build where clause with optional search
      const whereClause: any = { workspaceId };
      if (search) {
        whereClause.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } }
        ];
      }

      if (role === "OWNER" || role === "ADMIN") {
        const projects = await prisma.project.findMany({ where: whereClause, orderBy: { createdAt: "desc" } });
        return ApiResponse.success({ projects });
      }

      if (role === "MEMBER") {
        // Members see all projects in the workspace
        const projects = await prisma.project.findMany({ where: whereClause, orderBy: { createdAt: "desc" } });
        return ApiResponse.success({ projects });
      }

      // VIEWER: only show projects where the user is an explicit project member
      const viewerWhereClause: any = {
        workspaceId,
        members: { some: { userId: user.id } },
      };
      if (search) {
        viewerWhereClause.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } }
        ];
      }
      const projects = await prisma.project.findMany({
        where: viewerWhereClause,
        orderBy: { createdAt: "desc" },
      });
      return ApiResponse.success({ projects });
    }

    // Otherwise, list projects across all workspaces user belongs to or owns
    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { members: { some: { userId: user.id } } },
          { ownerId: user.id }
        ]
      },
      select: { id: true }
    });

    // Build where clause for global search
    const globalWhereClause: any = { workspaceId: { in: workspaces.map(w => w.id) } };
    if (search) {
      globalWhereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } }
      ];
    }

    const projects = await prisma.project.findMany({
      where: globalWhereClause,
      orderBy: { createdAt: "desc" },
    });

    return ApiResponse.success({ projects });
  } catch (err) {
    console.error("Error fetching projects:", err);
    return ApiResponse.error("Internal Server Error");
  }
}

