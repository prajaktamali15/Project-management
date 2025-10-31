import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/rbac";

// ✅ Zod validation schema for creating a project
const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().optional(),
  status: z.string().optional(),
  workspaceId: z.string().uuid(),
});

// ✅ POST /api/projects  → Create a new project
export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, description, status, workspaceId } = CreateProjectSchema.parse(body);

    // Check if user is owner of workspace OR has proper role
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    
    const isOwner = workspace.ownerId === user.id;
    const hasRole = await requireWorkspaceRole(user.id, workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
    
    if (!isOwner && !hasRole) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const project = await prisma.project.create({
      data: {
        name,
        description,
        status,
        workspaceId,
      },
    });

    // Automatically add the creator as project owner
    await prisma.projectMember.create({
      data: {
        userId: user.id,
        projectId: project.id,
        role: "OWNER"
      }
    });

    // Log activity
    await prisma.activity.create({
      data: {
        action: "created_project",
        targetType: "project",
        targetId: project.id,
        workspaceId,
        projectId: project.id,
        userId: user.id,
        metadata: { projectName: name }
      }
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.flatten() }, { status: 400 });
    }
    console.error("Error creating project:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ✅ GET /api/projects?workspaceId=... → List projects for a workspace
export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    // If workspaceId provided:
    if (workspaceId) {
      // Determine role
      const isOwner = await prisma.workspace.findFirst({ where: { id: workspaceId, ownerId: user.id }, select: { id: true } });
      let role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" | null = null;
      if (isOwner) role = "OWNER";
      if (!role) {
        const membership = await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: user.id, workspaceId } } });
        role = membership?.role ?? null;
        if (!role) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (role === "OWNER" || role === "ADMIN") {
        const projects = await prisma.project.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
        return NextResponse.json({ projects }, { status: 200 });
      }

      if (role === "MEMBER") {
        // Members see all projects in the workspace
        const projects = await prisma.project.findMany({ where: { workspaceId }, orderBy: { createdAt: "desc" } });
        return NextResponse.json({ projects }, { status: 200 });
      }

      // VIEWER: only show projects where the user is an explicit project member
      const projects = await prisma.project.findMany({
        where: {
          workspaceId,
          members: { some: { userId: user.id } },
        },
        orderBy: { createdAt: "desc" },
      });
      return NextResponse.json({ projects }, { status: 200 });
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

    const projects = await prisma.project.findMany({
      where: { workspaceId: { in: workspaces.map(w => w.id) } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ projects }, { status: 200 });
  } catch (err) {
    console.error("Error fetching projects:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

