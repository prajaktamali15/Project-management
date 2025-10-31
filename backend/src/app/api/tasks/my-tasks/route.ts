import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
	const user = await getAuthenticatedUser();
	if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

	const { searchParams } = new URL(req.url);
	const status = searchParams.getAll("status");
	const sort = searchParams.get("sort") || "dueDate"; // dueDate|priority|createdAt
	const order = (searchParams.get("order") || "asc").toLowerCase() === "asc" ? "asc" : "desc";

	const where: any = { assigneeId: user.id };
	if (status.length) where.status = { in: status as any };

	const tasks = await prisma.task.findMany({
		where,
		include: {
			assignee: { select: { id: true, email: true, name: true } },
			project: { 
				select: { 
					id: true, 
					name: true,
					workspace: {
						select: {
							id: true,
							name: true,
						}
					}
				} 
			},
		},
		orderBy: { [sort === "dueDate" ? "dueDate" : sort === "priority" ? "priority" : "createdAt"]: order as any },
	});

	return new Response(JSON.stringify({ tasks }), { status: 200 });
}


