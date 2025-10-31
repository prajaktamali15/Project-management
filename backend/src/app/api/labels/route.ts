import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/rbac";

const CreateLabelSchema = z.object({
  name: z.string().min(1),
  color: z.string().regex(/^#([0-9a-fA-F]{3}){1,2}$/).optional(),
  description: z.string().optional(),
  workspaceId: z.string().uuid(),
});

export async function GET(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const workspaceId = searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  const allowed = await requireWorkspaceRole(user.id, workspaceId, ["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const labels = await prisma.label.findMany({ where: { workspaceId }, orderBy: { name: "asc" } });
  return NextResponse.json({ labels }, { status: 200 });
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const data = CreateLabelSchema.parse(await req.json());
    const allowed = await requireWorkspaceRole(user.id, data.workspaceId, ["OWNER", "ADMIN"]);
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const label = await prisma.label.create({ data });
    return NextResponse.json({ label }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: err.flatten() }, { status: 400 });
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}



