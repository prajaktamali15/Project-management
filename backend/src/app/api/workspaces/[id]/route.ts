import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

const UpdateWorkspaceSchema = z.object({ name: z.string().min(1).optional(), description: z.string().optional(), settings: z.any().optional() });

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const workspace = await prisma.workspace.findUnique({ 
      where: { id },
      include: { owner: { select: { id: true, email: true, name: true } } }
    });
    
    if (!workspace) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    
    // Only owner/admin can view workspace details
    const isOwner = workspace.ownerId === user.id;
    if (!isOwner) {
      const membership = await prisma.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: user.id, workspaceId: id } }
      });
      if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
      }
    }

    return new Response(JSON.stringify({ workspace }), { status: 200 });
  } catch (err) {
    console.error("Error fetching workspace:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const workspace = await prisma.workspace.findUnique({ where: { id } });
    if (!workspace) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    
    const isOwner = workspace.ownerId === user.id;
    if (!isOwner) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const { name, description, settings } = UpdateWorkspaceSchema.parse(await req.json());
    const ws = await prisma.workspace.update({ where: { id }, data: { name, description, settings } });
    return new Response(JSON.stringify({ workspace: ws }), { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const workspace = await prisma.workspace.findUnique({ where: { id } });
    if (!workspace) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });

    const isOwner = workspace.ownerId === user.id;
    if (!isOwner) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    await prisma.$transaction(async (tx) => {
      // Delete task-related data across all projects in this workspace
      await tx.taskAttachment.deleteMany({ where: { task: { project: { workspaceId: id } } } }).catch(() => {});
      await tx.taskComment.deleteMany({ where: { task: { project: { workspaceId: id } } } }).catch(() => {});
      await tx.taskLabel.deleteMany({ where: { task: { project: { workspaceId: id } } } }).catch(() => {});
      await tx.taskDependency.deleteMany({ where: { OR: [ { task: { project: { workspaceId: id } } }, { dependsOn: { project: { workspaceId: id } } } ] } }).catch(() => {});
      await tx.task.deleteMany({ where: { project: { workspaceId: id } } });

      // Project memberships and activities
      await tx.projectMember.deleteMany({ where: { project: { workspaceId: id } } });
      await tx.activity.deleteMany({ where: { workspaceId: id } });

      // Project-level records
      await tx.project.deleteMany({ where: { workspaceId: id } });

      // Workspace memberships and labels
      await tx.workspaceMember.deleteMany({ where: { workspaceId: id } });
      await tx.label.deleteMany({ where: { workspaceId: id } }).catch(() => {});

      // Finally, workspace
      await tx.workspace.delete({ where: { id } });
    });
    return new Response(null, { status: 204 });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
