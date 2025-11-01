import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

const UpdateRoleSchema = z.object({ role: z.enum(["ADMIN", "MEMBER", "VIEWER"]) });

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string; userId: string }> }) {
  const params = await context.params;
  const projectId = params.id;
  const userId = params.userId;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });

    const workspace = await prisma.workspace.findUnique({ where: { id: project.workspaceId } });
    const isWorkspaceOwner = workspace?.ownerId === user.id;

    if (!isWorkspaceOwner) {
      const membership = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: user.id, projectId } }
      });
      if (!membership || membership.role !== "ADMIN") {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
      }
    }

    const { role } = UpdateRoleSchema.parse(await req.json());
    await prisma.projectMember.update({
      where: { userId_projectId: { userId, projectId } },
      data: { role },
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string; userId: string }> }) {
  const params = await context.params;
  const projectId = params.id;
  const userId = params.userId;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });

    const workspace = await prisma.workspace.findUnique({ where: { id: project.workspaceId } });
    const isWorkspaceOwner = workspace?.ownerId === user.id;

    if (!isWorkspaceOwner) {
      const membership = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: user.id, projectId } }
      });
      if (!membership || membership.role !== "ADMIN") {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
      }
    }

    await prisma.projectMember.delete({
      where: { userId_projectId: { userId, projectId } }
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("Error removing member:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}


