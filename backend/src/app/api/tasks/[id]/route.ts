import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/rbac";

const UpdateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  assigneeId: z.string().uuid().nullable().optional(),
});

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const existing = await prisma.task.findUnique({ where: { id }, include: { project: true, assignee: true } });
  if (!existing) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });

  // Check access
  const workspace = await prisma.workspace.findUnique({ where: { id: existing.project.workspaceId } });
  const isOwner = workspace?.ownerId === user.id;
  
  // Get request body early to check what fields are being updated
  const requestBody = await req.json();
  const isStatusOnlyUpdate = requestBody.status && !requestBody.title && !requestBody.description && !requestBody.priority && !requestBody.assigneeId && !requestBody.dueDate;
  
  // Check if user is assignee
  const isAssignee = existing.assigneeId === user.id;
  
  if (!isOwner) {
    const allowed = await requireWorkspaceRole(user.id, existing.project.workspaceId, ["OWNER", "ADMIN"]);
    
    // If not owner/admin, check if user is assignee and only updating status
    if (!allowed) {
      if (!isAssignee) {
        return new Response(JSON.stringify({ error: "Only task assignee, owners, and admins can update this task" }), { status: 403 });
      }
      // Assignee can only change status
      if (!isStatusOnlyUpdate) {
        return new Response(JSON.stringify({ error: "You can only change the status of tasks assigned to you" }), { status: 403 });
      }
    } else {
      // Is ADMIN - can edit anything
    }
  }

  try {
    const data = UpdateTaskSchema.parse(requestBody);
    
    // Track old status for activity logging
    const oldStatus = existing.status;
    
    if (data.assigneeId) {
      const isMember = await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: data.assigneeId, workspaceId: existing.project.workspaceId } } });
      if (!isMember) return new Response(JSON.stringify({ error: "Assignee must be a workspace member" }), { status: 400 });
    }
    
    // Restrict assignee status transitions for clarity of workflow
    if (!isOwner) {
      const isAdmin = await requireWorkspaceRole(user.id, existing.project.workspaceId, ["OWNER", "ADMIN"]);
      if (!isAdmin && data.status) {
        // Assignee-only transitions: IN_PROGRESS -> REVIEW, REVIEW -> DONE
        if (data.status === "REVIEW" && existing.status !== "IN_PROGRESS") {
          return new Response(JSON.stringify({ error: "Can request review only from In Progress" }), { status: 400 });
        }
        if (data.status === "DONE") {
          if (existing.status !== "REVIEW") {
            return new Response(JSON.stringify({ error: "Can complete only after review" }), { status: 400 });
          }
          // Require explicit approval comment from OWNER/ADMIN before assignee can complete
          const lastComment = await prisma.taskComment.findFirst({
            where: { taskId: id, content: { contains: "Approved", mode: "insensitive" } },
            orderBy: { createdAt: "desc" },
            include: { author: { select: { id: true } } },
          });
          let approved = false;
          if (lastComment) {
            const ws = await prisma.workspace.findUnique({ where: { id: existing.project.workspaceId } });
            if (ws?.ownerId === lastComment.author.id) {
              approved = true;
            } else {
              const adminMember = await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: lastComment.author.id, workspaceId: existing.project.workspaceId } } });
              approved = adminMember?.role === ("ADMIN" as any) || adminMember?.role === ("OWNER" as any);
            }
          }
          if (!approved) {
            return new Response(JSON.stringify({ error: "Completion requires approval by owner/admin" }), { status: 403 });
          }
        }
      }
    }

    // Dependency enforcement: cannot move to IN_PROGRESS/REVIEW/DONE unless all dependencies are DONE
    if (data.status && (data.status === "IN_PROGRESS" || data.status === "REVIEW" || data.status === "DONE")) {
      const deps = await prisma.taskDependency.findMany({ where: { taskId: id }, include: { dependsOn: true } });
      const openDeps = deps.filter((d) => d.dependsOn.status !== "DONE");
      if (openDeps.length > 0) {
        const titles = openDeps.map((d) => d.dependsOn.title).slice(0, 3).join(", ");
        const more = openDeps.length > 3 ? ` and ${openDeps.length - 3} more` : "";
        return new Response(
          JSON.stringify({ error: `Blocked by dependencies: complete ${titles}${more} first` }),
          { status: 400 }
        );
      }
    }

    const updated = await prisma.task.update({
      where: { id },
      data: {
        ...data,
        dueDate: data.dueDate === undefined ? undefined : data.dueDate ? new Date(data.dueDate) : null,
      },
    });
    
    // Log activity if status changed
    if (data.status && data.status !== oldStatus) {
      const assigneeName = existing.assignee?.name || existing.assignee?.email?.split("@")[0] || "Unassigned";
      await prisma.activity.create({
        data: {
          action: "status_changed",
          targetType: "task",
          targetId: id,
          workspaceId: existing.project.workspaceId,
          projectId: existing.project.id,
          userId: user.id,
          metadata: {
            taskTitle: updated.title,
            oldStatus,
            newStatus: data.status,
            assigneeName,
            changedBy: user.name || user.email
          }
        }
      });
    }
    
    return new Response(JSON.stringify({ task: updated }), { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const existing = await prisma.task.findUnique({ where: { id }, include: { project: true } });
  if (!existing) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });

  // Only OWNER/ADMIN can delete tasks
  const workspace = await prisma.workspace.findUnique({ where: { id: existing.project.workspaceId } });
  const isOwner = workspace?.ownerId === user.id;
  
  if (!isOwner) {
    const allowed = await requireWorkspaceRole(user.id, existing.project.workspaceId, ["OWNER", "ADMIN"]);
    if (!allowed) return new Response(JSON.stringify({ error: "Only workspace owners and admins can delete tasks" }), { status: 403 });
  }

  await prisma.task.delete({ where: { id } });
  return new Response(null, { status: 204 });
}
