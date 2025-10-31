import { prisma } from "@/lib/prisma";

export type ProjectRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export async function requireProjectRole(userId: string, projectId: string, allowed: ProjectRole[]) {
  // First check if user is the owner of the workspace containing this project
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return false;
  
  const workspace = await prisma.workspace.findUnique({ where: { id: project.workspaceId } });
  if (workspace?.ownerId === userId && allowed.includes("OWNER")) {
    return true;
  }
  
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!membership) return false;
  return allowed.includes(membership.role as ProjectRole);
}

export async function getUserProjectRole(userId: string, projectId: string): Promise<ProjectRole | null> {
  // First check if user is the owner of the workspace containing this project
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  
  const workspace = await prisma.workspace.findUnique({ where: { id: project.workspaceId } });
  if (workspace?.ownerId === userId) {
    return "OWNER";
  }
  
  const membership = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  return membership ? (membership.role as ProjectRole) : null;
}

export async function canEditTask(userId: string, projectId: string, taskAssigneeId: string | null): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  if (role === "OWNER" || role === "ADMIN") return true;
  if (role === "MEMBER" && taskAssigneeId === userId) return true;
  if (role === "VIEWER") return false;
  return false;
}

export async function canManageMembers(userId: string, projectId: string): Promise<boolean> {
  const role = await getUserProjectRole(userId, projectId);
  return role === "OWNER" || role === "ADMIN";
}





