import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/rbac";
import path from "path";
import { promises as fs } from "fs";

export const runtime = "nodejs";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: taskId } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) return new Response(JSON.stringify({ error: "Task not found" }), { status: 404 });

  const workspaceId = task.project.workspaceId;

  const isAllowed = await requireWorkspaceRole(user.id, workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
  if (!isAllowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  const form = await req.formData();
  const files = form.getAll("files");
  const paths = form.getAll("paths"); // optional parallel array for webkitRelativePath values

  if (!files.length) return new Response(JSON.stringify({ error: "No files provided" }), { status: 400 });

  const uploadsRoot = path.join(process.cwd(), "public", "uploads", "tasks", taskId);
  await fs.mkdir(uploadsRoot, { recursive: true });

  const saved: { url: string; fileName: string }[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!(file instanceof File)) continue;

    const providedPath = (paths[i] as unknown as string) || file.name;
    const safeRel = providedPath.replace(/\\/g, "/").replace(/^\/+/, "");
    // Nest under uploader user id to distinguish who uploaded
    const destAbs = path.join(uploadsRoot, user.id, safeRel);
    const destDir = path.dirname(destAbs);
    await fs.mkdir(destDir, { recursive: true });

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(destAbs, Buffer.from(arrayBuffer));

    const publicUrl = `/uploads/tasks/${taskId}/${user.id}/${safeRel}`;
    const fileName = path.basename(safeRel);
    saved.push({ url: publicUrl, fileName });
  }

  // Persist attachments
  const created = await prisma.$transaction(
    saved.map((s) =>
      prisma.taskAttachment.create({ data: { taskId, url: s.url, fileName: s.fileName } })
    )
  );

  return new Response(JSON.stringify({ attachments: created }), { status: 201 });
}


export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id: taskId } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
  if (!task) return new Response(JSON.stringify({ error: "Task not found" }), { status: 404 });

  // Allow any workspace role (including VIEWER) to read attachments
  const workspaceId = task.project.workspaceId;
  const allowed = await requireWorkspaceRole(user.id, workspaceId, ["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
  if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });

  const rows = await prisma.taskAttachment.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
    select: { id: true, url: true, fileName: true, createdAt: true },
  });

  // Derive uploaderId from URL path segment if present: /uploads/tasks/{taskId}/{uploaderId}/...
  const attachments = rows.map((r) => {
    const parts = r.url.split("/");
    const idx = parts.findIndex((p) => p === taskId);
    const uploaderId = idx >= 0 && parts[idx + 1] && parts[idx + 1].length > 0 ? parts[idx + 1] : null;
    return { ...r, uploaderId } as any;
  });

  return new Response(JSON.stringify({ attachments }), { status: 200 });
}



