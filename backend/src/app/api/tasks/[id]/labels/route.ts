import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/rbac";

const AttachSchema = z.object({ labelId: z.string().uuid() });

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const task = await prisma.task.findUnique({ where: { id }, include: { project: true } });
  if (!task) return NextResponse.json({ error: "Not Found" }, { status: 404 });

  const workspaceId = task.project.workspaceId;
  const allowed = await requireWorkspaceRole(user.id, workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { labelId } = AttachSchema.parse(await req.json());
  const label = await prisma.label.findUnique({ where: { id: labelId } });
  if (!label || label.workspaceId !== workspaceId) return NextResponse.json({ error: "Invalid label" }, { status: 400 });

  await prisma.taskLabel.upsert({
    where: { taskId_labelId: { taskId: id, labelId } },
    update: {},
    create: { taskId: id, labelId },
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const labelId = searchParams.get("labelId");
  if (!labelId) return NextResponse.json({ error: "labelId required" }, { status: 400 });

  const task = await prisma.task.findUnique({ where: { id }, include: { project: true } });
  if (!task) return NextResponse.json({ error: "Not Found" }, { status: 404 });
  const workspaceId = task.project.workspaceId;
  const allowed = await requireWorkspaceRole(user.id, workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await prisma.taskLabel.delete({ where: { taskId_labelId: { taskId: id, labelId } } });
  return NextResponse.json(null, { status: 204 });
}



