import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { requireWorkspaceRole } from "@/lib/rbac";

const CreateTaskSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	projectId: z.string().uuid(),
	assigneeId: z.string().uuid().optional(),
	status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
	priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
	dueDate: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
	const user = await getAuthenticatedUser();
	if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

	try {
		const data = CreateTaskSchema.parse(await req.json());
		const project = await prisma.project.findUnique({ where: { id: data.projectId } });
		if (!project) return new Response(JSON.stringify({ error: "Project not found" }), { status: 404 });

		// Only OWNER/ADMIN can create tasks
		const workspace = await prisma.workspace.findUnique({ where: { id: project.workspaceId } });
		const isOwner = workspace?.ownerId === user.id;
		
		if (!isOwner) {
			const allowed = await requireWorkspaceRole(user.id, project.workspaceId, ["OWNER", "ADMIN"]);
			if (!allowed) return new Response(JSON.stringify({ error: "Only workspace owners and admins can create tasks" }), { status: 403 });
		}

		if (data.assigneeId) {
			const isMember = await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: data.assigneeId, workspaceId: project.workspaceId } } });
			if (!isMember) return new Response(JSON.stringify({ error: "Assignee must be a workspace member" }), { status: 400 });
		}

    // Create task
    const task = await prisma.task.create({
      data: {
        title: data.title,
        description: data.description || undefined,
        status: data.status || "TODO",
        priority: data.priority || "MEDIUM",
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        projectId: data.projectId,
        assigneeId: data.assigneeId || undefined,
      },
    });

		// Log activity (non-blocking)
		try {
			await prisma.activity.create({
				data: {
					action: "created_task",
					targetType: "task",
					targetId: task.id,
					workspaceId: project.workspaceId,
					projectId: data.projectId,
					userId: user.id,
					metadata: { taskTitle: task.title, status: task.status }
				}
			});
		} catch (activityErr) {
			// Log but don't fail task creation
			console.error("Failed to log activity:", activityErr);
		}

		return new Response(JSON.stringify({ task }), { status: 201 });
	} catch (err) {
		if (err instanceof z.ZodError) return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
		console.error("Task creation error:", err);
		// Return more detailed error in development
		const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
		return new Response(JSON.stringify({ error: errorMessage, details: err instanceof Error ? err.stack : undefined }), { status: 500 });
	}
}

export async function GET(req: NextRequest) {
	const user = await getAuthenticatedUser();
	if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

	const { searchParams } = new URL(req.url);
	const projectId = searchParams.get("projectId");
	const status = searchParams.getAll("status");
	const assigneeId = searchParams.get("assigneeId") || undefined;
	const sort = searchParams.get("sort") || "createdAt"; // createdAt|dueDate|priority
	const order = (searchParams.get("order") || "desc").toLowerCase() === "asc" ? "asc" : "desc";
	const limit = Math.min(Number(searchParams.get("limit") || 20), 100);
	const offset = Number(searchParams.get("offset") || 0);

	if (!projectId) return new Response(JSON.stringify({ error: "projectId required" }), { status: 400 });

	const project = await prisma.project.findUnique({ where: { id: projectId } });
	if (!project) return new Response(JSON.stringify({ error: "Project not found" }), { status: 404 });

	// Check if user is owner or has proper role
	const workspace = await prisma.workspace.findUnique({ where: { id: project.workspaceId } });
	const isOwner = workspace?.ownerId === user.id;
	
	if (!isOwner) {
		const allowed = await requireWorkspaceRole(user.id, project.workspaceId, ["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
		if (!allowed) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403 });
	}

	const where: any = { projectId };
	if (status.length) where.status = { in: status as any };
	if (assigneeId) where.assigneeId = assigneeId;

	const [items, total] = await Promise.all([
		prisma.task.findMany({
			where,
			include: {
				assignee: { select: { id: true, email: true, name: true } },
				project: { select: { id: true, name: true } },
			},
			orderBy: { [sort]: order as any },
			take: limit,
			skip: offset,
		}),
		prisma.task.count({ where }),
	]);
	return new Response(JSON.stringify({ items, total, limit, offset }), { status: 200 });
}



