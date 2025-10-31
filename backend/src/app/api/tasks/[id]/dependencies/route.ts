import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/rbac";

const DepSchema = z.object({ dependsOnTaskId: z.string().uuid() });

async function hasCircularDependency(taskId: string, dependsOnTaskId: string): Promise<boolean> {
  // DFS from dependsOn to see if we reach taskId
  const stack = [dependsOnTaskId];
  const visited = new Set<string>();
  while (stack.length) {
    const current = stack.pop() as string;
    if (current === taskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    const next = await prisma.taskDependency.findMany({ where: { taskId: current } });
    for (const n of next) stack.push(n.dependsOnTaskId);
  }
  return false;
}

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const task = await prisma.task.findUnique({ where: { id }, include: { project: true } });
    if (!task) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    const allowed = await requireWorkspaceRole(user.id, task.project.workspaceId, ["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
    if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const deps = await prisma.taskDependency.findMany({
      where: { taskId: id },
      include: {
        dependsOn: {
          select: {
            id: true,
            number: true,
            title: true,
            status: true,
            priority: true,
            dueDate: true,
            assignee: { select: { id: true, email: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return new Response(JSON.stringify({ dependencies: deps }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const task = await prisma.task.findUnique({ where: { id }, include: { project: true } });
    if (!task) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    const allowed = await requireWorkspaceRole(user.id, task.project.workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
    if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const { dependsOnTaskId } = DepSchema.parse(await req.json());
    if (dependsOnTaskId === id) return new Response(JSON.stringify({ error: "Task cannot depend on itself" }), { status: 400 });

    // Same project check
    const depTask = await prisma.task.findUnique({ where: { id: dependsOnTaskId }, include: { project: true } });
    if (!depTask || depTask.projectId !== task.projectId) return new Response(JSON.stringify({ error: "Dependency must be in same project" }), { status: 400 });

    // Circular dependency check
    if (await hasCircularDependency(id, dependsOnTaskId)) {
      return new Response(JSON.stringify({ error: "Circular dependency detected" }), { status: 400 });
    }

    await prisma.taskDependency.create({ data: { taskId: id, dependsOnTaskId } });
    return new Response(JSON.stringify({ ok: true }), { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const dependsOnTaskId = searchParams.get("dependsOnTaskId");
    if (!dependsOnTaskId) return new Response(JSON.stringify({ error: "dependsOnTaskId required" }), { status: 400 });

    const task = await prisma.task.findUnique({ where: { id }, include: { project: true } });
    if (!task) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    const allowed = await requireWorkspaceRole(user.id, task.project.workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
    if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    await prisma.taskDependency.delete({ where: { taskId_dependsOnTaskId: { taskId: id, dependsOnTaskId } } });
    return new Response(null, { status: 204 });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}



