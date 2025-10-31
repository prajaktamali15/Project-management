import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(_: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const memberships = await prisma.workspaceMember.findMany({ where: { userId: user.id }, select: { workspaceId: true } });
    const workspaceIds = memberships.map((m) => m.workspaceId);

    const tasks = await prisma.task.findMany({
      where: {
        assigneeId: user.id,
        project: { workspaceId: { in: workspaceIds } },
        NOT: { status: "DONE" },
      },
      orderBy: { dueDate: "asc" },
      take: 15,
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        project: {
          select: { id: true, name: true, workspace: { select: { id: true, name: true } } },
        },
      },
    });

    return new Response(JSON.stringify({ tasks }), { status: 200 });
  } catch (err) {
    console.error("dashboard my-tasks error", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}



