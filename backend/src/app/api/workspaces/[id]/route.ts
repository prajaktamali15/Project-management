import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { ApiResponse } from "@/lib/api-response";
import { authService } from "@/lib/authorization-service";

const UpdateWorkspaceSchema = z.object({ name: z.string().min(1).optional(), description: z.string().optional(), settings: z.any().optional() });

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return ApiResponse.unauthorized();

  try {
    const workspace = await prisma.workspace.findUnique({ 
      where: { id },
      include: { owner: { select: { id: true, email: true, name: true } } }
    });
    
    if (!workspace) return ApiResponse.notFound("Workspace");
    
    // Check access using authorization service
    const access = await authService.checkWorkspaceAccess(user.id, id, ["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
    if (!access.allowed) {
      return ApiResponse.forbidden(access.reason);
    }

    return ApiResponse.success({ workspace });
  } catch (err) {
    console.error("Error fetching workspace:", err);
    return ApiResponse.error("Internal Server Error");
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return ApiResponse.unauthorized();

  try {
    const workspace = await prisma.workspace.findUnique({ where: { id } });
    if (!workspace) return ApiResponse.notFound("Workspace");
    
    // Check if user is owner
    const isOwner = await authService.isWorkspaceOwner(user.id, id);
    if (!isOwner) return ApiResponse.forbidden("Only workspace owner can update settings");

    const { name, description, settings } = UpdateWorkspaceSchema.parse(await req.json());
    const ws = await prisma.workspace.update({ where: { id }, data: { name, description, settings } });
    return ApiResponse.success({ workspace: ws });
  } catch (err) {
    if (err instanceof z.ZodError) return ApiResponse.validationError(err.flatten());
    return ApiResponse.error("Internal Server Error");
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return ApiResponse.unauthorized();

  try {
    const workspace = await prisma.workspace.findUnique({ where: { id } });
    if (!workspace) return ApiResponse.notFound("Workspace");

    const isOwner = await authService.isWorkspaceOwner(user.id, id);
    if (!isOwner) return ApiResponse.forbidden("Only workspace owner can delete");

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
    return ApiResponse.noContent();
  } catch (err) {
    return ApiResponse.error("Internal Server Error");
  }
}
