import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

const CreateWorkspaceSchema = z.object({ name: z.string().min(1), settings: z.any().optional() });

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    const { name, settings } = CreateWorkspaceSchema.parse(await req.json());
    const ws = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name,
          settings,
          ownerId: user.id,
          members: { create: { userId: user.id, role: "OWNER" } },
        },
      });

      await tx.activity.create({
        data: {
          action: "created_workspace",
          targetType: "workspace",
          targetId: workspace.id,
          workspaceId: workspace.id,
          userId: user.id,
          metadata: { workspaceName: name },
        },
      });

      return workspace;
    });
    return new Response(JSON.stringify({ workspace: ws }), { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  try {
    // Get workspaces where user is a member OR owner
    const workspaces = await prisma.workspace.findMany({
      where: {
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id, role: { in: ["OWNER", "ADMIN"] } } } }
        ]
      },
      orderBy: { createdAt: "desc" },
      include: {
        owner: true
      }
    });
    return new Response(JSON.stringify({ workspaces }), { status: 200 });
  } catch (err) {
    console.error("Error fetching workspaces:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500 });
  }
}



