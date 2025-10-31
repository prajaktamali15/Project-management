import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { z } from "zod";

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string; userId: string }> }) {
  const params = await context.params;
  const workspaceId = params.id;
  const userId = params.userId;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    // Check if user can remove members (workspace owner or admin)
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });

    const isOwner = workspace.ownerId === user.id;
    if (!isOwner) {
      const membership = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: user.id, workspaceId } }
      });
      if (!membership || membership.role !== "ADMIN") {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
      }
    }

    // Don't allow removing the workspace owner
    if (workspace.ownerId === userId) {
      return new Response(JSON.stringify({ error: "Cannot remove workspace owner" }), { status: 400 });
    }

    // Check if member exists
    const memberToRemove = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } }
    });
    if (!memberToRemove) {
      return new Response(JSON.stringify({ error: "Member not found in this workspace" }), { status: 404 });
    }

    // Remove the member
    await prisma.workspaceMember.delete({
      where: { userId_workspaceId: { userId, workspaceId } }
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error("Error removing member:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

const UpdateRoleSchema = z.object({ role: z.enum(["ADMIN", "MEMBER", "VIEWER"]) });

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string; userId: string }> }) {
  const params = await context.params;
  const workspaceId = params.id;
  const targetUserId = params.userId;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });

    const isOwner = workspace.ownerId === user.id;
    let actorRole: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER" = isOwner ? "OWNER" : "VIEWER";
    if (!isOwner) {
      const membership = await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: user.id, workspaceId } } });
      if (!membership || membership.role !== "ADMIN") {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
      }
      actorRole = membership.role as any;
    }

    // Cannot change owner role and cannot demote owner
    if (workspace.ownerId === targetUserId) {
      return new Response(JSON.stringify({ error: "Cannot change owner role" }), { status: 400 });
    }

    const { role } = UpdateRoleSchema.parse(await req.json());

    await prisma.workspaceMember.update({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
      data: { role },
    });

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
