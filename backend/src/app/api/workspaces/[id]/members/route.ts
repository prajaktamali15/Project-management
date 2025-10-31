import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/rbac";

const InviteSchema = z.object({ userId: z.string().uuid(), role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER") });

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const hasAccess = await requireWorkspaceRole(user.id, id, ["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
  if (!hasAccess) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  const members = await prisma.workspaceMember.findMany({ where: { workspaceId: id }, include: { user: true } });
  return new Response(JSON.stringify({ members }), { status: 200 });
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const canInvite = await requireWorkspaceRole(user.id, id, ["OWNER", "ADMIN"]);
  if (!canInvite) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  try {
    const { userId, role } = InviteSchema.parse(await req.json());
    await prisma.workspaceMember.create({ data: { userId, workspaceId: id, role } });
    return new Response(JSON.stringify({ ok: true }), { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}
