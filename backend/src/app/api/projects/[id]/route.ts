import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/rbac";

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "ON_HOLD"]).optional(),
});

// ✅ Fix: Await params since Next.js now provides it as a Promise
export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const project = await prisma.project.findUnique({
      where: { id },
      include: { workspace: true }
    });
    
    if (!project) return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });
    
    // Check access
    const workspace = await prisma.workspace.findUnique({ where: { id: project.workspaceId } });
    const isOwner = workspace?.ownerId === user.id;
    
    if (!isOwner) {
      const hasAccess = await requireWorkspaceRole(user.id, project.workspaceId, ["OWNER", "ADMIN", "MEMBER"]);
      if (!hasAccess) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
    }
    
    return new Response(JSON.stringify({ project }), { status: 200 });
  } catch (err) {
    console.error("Error fetching project:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

export async function PUT(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const user = await getAuthenticatedUser();
  if (!user)
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing)
    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });

  // Check if user is owner or has proper role
  const workspace = await prisma.workspace.findUnique({ where: { id: existing.workspaceId } });
  const isOwner = workspace?.ownerId === user.id;
  
  if (!isOwner) {
    const canEdit = await requireWorkspaceRole(user.id, existing.workspaceId, [
      "OWNER",
      "ADMIN",
    ]);
    if (!canEdit)
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  try {
    const data = UpdateSchema.parse(await req.json());
    const project = await prisma.project.update({
      where: { id },
      data,
    });
    return new Response(JSON.stringify({ project }), { status: 200 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
    }
    console.error("Update error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

// ✅ Fix: Same context handling for DELETE
export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  const user = await getAuthenticatedUser();
  if (!user)
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const existing = await prisma.project.findUnique({ where: { id } });
  if (!existing)
    return new Response(JSON.stringify({ error: "Not Found" }), { status: 404 });

  // Check if user is owner or has proper role
  const workspace = await prisma.workspace.findUnique({ where: { id: existing.workspaceId } });
  const isOwner = workspace?.ownerId === user.id;
  
  if (!isOwner) {
    const canDelete = await requireWorkspaceRole(user.id, existing.workspaceId, [
      "OWNER",
      "ADMIN",
    ]);
    if (!canDelete)
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
  }

  await prisma.project.delete({ where: { id } });
  return new Response(null, { status: 204 });
}

