import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";
import { authService } from "@/lib/authorization-service";
import { ApiResponse } from "@/lib/api-response";
import { ActivityLogger } from "@/lib/activity-logger";

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
	if (!user) return ApiResponse.unauthorized();

	try {
		const data = CreateTaskSchema.parse(await req.json());
		const project = await prisma.project.findUnique({ where: { id: data.projectId } });
		if (!project) return ApiResponse.notFound("Project");

		// Check authorization using service
		const access = await authService.checkWorkspaceAccess(user.id, project.workspaceId, ["OWNER", "ADMIN"]);
		if (!access.allowed) {
			return ApiResponse.forbidden("Only workspace owners and admins can create tasks");
		}

		if (data.assigneeId) {
			const isMember = await prisma.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: data.assigneeId, workspaceId: project.workspaceId } } });
			if (!isMember) return ApiResponse.badRequest("Assignee must be a workspace member");
		}

		const task = await prisma.$transaction(async (tx) => {
			const created = await tx.task.create({
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

			// touch project updatedAt
			await tx.project.update({ where: { id: data.projectId }, data: { updatedAt: new Date() } });

			// Log activity
			await ActivityLogger.logTaskActivity(
				"created_task",
				created.id,
				data.projectId,
				project.workspaceId,
				user.id,
				{ taskTitle: created.title, status: created.status }
			);

			return created;
		});

		return ApiResponse.created({ task });
	} catch (err) {
		if (err instanceof z.ZodError) return ApiResponse.validationError(err.flatten());
		console.error("Task creation error:", err);
		// Return more detailed error in development
		const errorMessage = err instanceof Error ? err.message : "Internal Server Error";
		return ApiResponse.error(errorMessage);
	}
}

export async function GET(req: NextRequest) {
	const user = await getAuthenticatedUser();
	if (!user) return ApiResponse.unauthorized();

	const { searchParams } = new URL(req.url);
	const projectId = searchParams.get("projectId");
	const status = searchParams.getAll("status");
	const assigneeId = searchParams.get("assigneeId") || undefined;
	const sort = searchParams.get("sort") || "createdAt"; // createdAt|dueDate|priority
	const order = (searchParams.get("order") || "desc").toLowerCase() === "asc" ? "asc" : "desc";
	const limit = Math.min(Number(searchParams.get("limit") || 20), 100);
	const offset = Number(searchParams.get("offset") || 0);

	if (!projectId) return ApiResponse.badRequest("projectId required");

	const project = await prisma.project.findUnique({ where: { id: projectId } });
	if (!project) return ApiResponse.notFound("Project");

	// Check authorization
	const access = await authService.checkWorkspaceAccess(user.id, project.workspaceId, ["OWNER", "ADMIN", "MEMBER", "VIEWER"]);
	if (!access.allowed) {
		return ApiResponse.forbidden(access.reason);
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
	return ApiResponse.success({ items, total, limit, offset });
}



