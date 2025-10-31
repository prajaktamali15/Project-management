import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/rbac";

const CommentSchema = z.object({ content: z.string().min(1) });

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const task = await prisma.task.findUnique({ where: { id }, include: { project: true } });
    if (!task) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    const allowed = await requireWorkspaceRole(user.id, task.project.workspaceId, ["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
    if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

    const comments = await prisma.taskComment.findMany({
      where: { taskId: id },
      include: { author: { select: { id: true, email: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return new Response(JSON.stringify({ comments }), { status: 200 });
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

    const { content } = CommentSchema.parse(await req.json());
    const comment = await prisma.taskComment.create({
      data: { taskId: id, authorId: user.id, content },
      include: { author: { select: { id: true, email: true, name: true } } },
    });
    return new Response(JSON.stringify({ comment }), { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}



