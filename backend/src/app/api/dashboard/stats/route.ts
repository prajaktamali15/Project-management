import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(_: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    // All workspace ids the user belongs to
    const memberships = await prisma.workspaceMember.findMany({ where: { userId: user.id }, select: { workspaceId: true } });
    const workspaceIds = memberships.map((m) => m.workspaceId);

    const [workspaces, projects, activeTasks, completedTasks, assignedToMe, overdueTasks] = await Promise.all([
      prisma.workspace.count({ where: { id: { in: workspaceIds } } }),
      prisma.project.count({ where: { workspaceId: { in: workspaceIds } } }),
      prisma.task.count({ where: { project: { workspaceId: { in: workspaceIds } }, NOT: { status: "DONE" } } }),
      prisma.task.count({ where: { project: { workspaceId: { in: workspaceIds } }, status: "DONE" } }),
      prisma.task.count({ where: { assigneeId: user.id, project: { workspaceId: { in: workspaceIds } }, NOT: { status: "DONE" } } }),
      prisma.task.count({ where: { project: { workspaceId: { in: workspaceIds } }, dueDate: { lt: new Date() }, NOT: { status: "DONE" } } }),
    ]);

    return new Response(
      JSON.stringify({ workspaces, projects, activeTasks, completedTasks, assignedToMe, overdueTasks }),
      { status: 200 }
    );
  } catch (err) {
    console.error("dashboard stats error", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}



