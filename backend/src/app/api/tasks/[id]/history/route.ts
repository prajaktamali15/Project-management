import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/rbac";

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const task = await prisma.task.findUnique({ where: { id }, include: { project: true } });
  if (!task) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });

  const allowed = await requireWorkspaceRole(user.id, task.project.workspaceId, ["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
  if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  const activities = await prisma.activity.findMany({
    where: { targetType: "task", targetId: id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return new Response(JSON.stringify({ activities }), { status: 200 });
}


