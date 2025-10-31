import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(_: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const memberships = await prisma.workspaceMember.findMany({ where: { userId: user.id }, select: { workspaceId: true } });
    const workspaceIds = memberships.map((m) => m.workspaceId);

    const activities = await prisma.activity.findMany({
      where: { workspaceId: { in: workspaceIds } },
      orderBy: { createdAt: "desc" },
      take: 15,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
        workspace: { select: { id: true, name: true } },
        user: { select: { name: true, email: true } },
      },
    });

    return new Response(JSON.stringify({ activities }), { status: 200 });
  } catch (err) {
    console.error("dashboard activities error", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}



