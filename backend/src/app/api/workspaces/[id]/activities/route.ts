import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/rbac";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const hasAccess = await requireWorkspaceRole(user.id, id, ["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
  if (!hasAccess) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  const activities = await prisma.activity.findMany({
    where: { workspaceId: id },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return new Response(JSON.stringify({ activities }), { status: 200 });
}

