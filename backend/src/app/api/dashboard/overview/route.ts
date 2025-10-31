import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(_: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    // Workspaces where user is a member
    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      select: { role: true, workspace: { select: { id: true, name: true } } },
    });

    const workspaces = await Promise.all(
      memberships.map(async (m) => {
        const projects = await prisma.project.count({ where: { workspaceId: m.workspace.id } });
        const activeTasks = await prisma.task.count({
          where: { project: { workspaceId: m.workspace.id }, NOT: { status: "DONE" } },
        });
        return {
          id: m.workspace.id,
          name: m.workspace.name,
          role: m.role,
          projects,
          activeTasks,
        };
      })
    );

    // Role summary
    const roleCounts = memberships.reduce((acc, m) => {
      acc[m.role] = (acc[m.role] || 0) as any;
      (acc as any)[m.role] = (acc as any)[m.role] + 1;
      return acc;
    }, {} as Record<string, number>);

    return new Response(JSON.stringify({ workspaces, roleCounts }), { status: 200 });
  } catch (err) {
    console.error("dashboard overview error", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}



