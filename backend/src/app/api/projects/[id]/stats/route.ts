import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/rbac";

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  // ✅ Fix: Await params because Next.js now provides them as a Promise
  const { id } = await context.params;

  const user = await getAuthenticatedUser();
  if (!user)
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project)
    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });

  const allowed = await requireWorkspaceRole(user.id, project.workspaceId, [
    "OWNER",
    "ADMIN",
    "MEMBER",
    "VIEWER",
  ]);
  if (!allowed)
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  const [total, done] = await Promise.all([
    prisma.task.count({ where: { projectId: id } }),
    prisma.task.count({ where: { projectId: id, status: "DONE" } }),
  ]);

  const completion =
    total === 0 ? 0 : Math.round((done / total) * 100);

  return new Response(
    JSON.stringify({
      totalTasks: total,
      completedTasks: done,
      completionPercent: completion,
    }),
    { status: 200 }
  );
}

