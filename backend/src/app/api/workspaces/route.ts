import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { ApiResponse } from "@/lib/api-response";
import { ActivityLogger } from "@/lib/activity-logger";

const CreateWorkspaceSchema = z.object({ name: z.string().min(1), settings: z.any().optional() });

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return ApiResponse.unauthorized();

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

      await ActivityLogger.logWorkspaceActivity(
        "created_workspace",
        workspace.id,
        user.id,
        { workspaceName: name }
      );

      return workspace;
    });
    return ApiResponse.created({ workspace: ws });
  } catch (err) {
    if (err instanceof z.ZodError) return ApiResponse.validationError(err.flatten());
    return ApiResponse.error("Internal Server Error");
  }
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) return ApiResponse.unauthorized();

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
    return ApiResponse.success({ workspaces });
  } catch (err) {
    console.error("Error fetching workspaces:", err);
    return ApiResponse.error("Internal Server Error");
  }
}



