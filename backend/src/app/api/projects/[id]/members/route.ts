import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

const InviteSchema = z.object({ userId: z.string().uuid(), role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER") });

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    // Check if user has access to this project
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });

    // Check if user is workspace owner or has project membership
    const workspace = await prisma.workspace.findUnique({ where: { id: project.workspaceId } });
    const isWorkspaceOwner = workspace?.ownerId === user.id;

    if (!isWorkspaceOwner) {
      const membership = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: user.id, projectId: id } }
      });
      if (!membership) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }

    const members = await prisma.projectMember.findMany({ 
      where: { projectId: id }, 
      include: { user: true } 
    });
    return new Response(JSON.stringify({ members }), { status: 200 });
  } catch (err) {
    console.error("Error fetching project members:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const project = await prisma.project.findUnique({ where: { id } });
    if (!project) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });

    // Check if user can invite (workspace owner or project admin)
    const workspace = await prisma.workspace.findUnique({ where: { id: project.workspaceId } });
    const isWorkspaceOwner = workspace?.ownerId === user.id;

    if (!isWorkspaceOwner) {
      const membership = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: user.id, projectId: id } }
      });
      if (!membership || membership.role !== "ADMIN") {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
      }
    }

    const { userId, role } = InviteSchema.parse(await req.json());
    await prisma.projectMember.create({ data: { userId, projectId: id, role } });
    
    // Log activity
    await prisma.activity.create({
      data: {
        action: "invited_member",
        targetType: "project",
        targetId: id,
        workspaceId: project.workspaceId,
        projectId: id,
        userId: user.id,
        metadata: { invitedUserId: userId, role }
      }
    });

    return new Response(JSON.stringify({ ok: true }), { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

