import { prisma } from "@/lib/prisma";

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export async function requireWorkspaceRole(userId: string, workspaceId: string, allowed: WorkspaceRole[]) {
  // First check if user is the owner of the workspace
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (workspace?.ownerId === userId && allowed.includes("OWNER")) {
    return true;
  }
  
  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (!membership) return false;
  return allowed.includes(membership.role as WorkspaceRole);
}

export async function getUserWorkspaceRole(userId: string, workspaceId: string): Promise<WorkspaceRole | null> {
  // First check if user is the owner of the workspace
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (workspace?.ownerId === userId) {
    return "OWNER";
  }
  
  const membership = await prisma.workspaceMember.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  return membership ? (membership.role as WorkspaceRole) : null;
}

export async function canEditTask(userId: string, workspaceId: string, taskAssigneeId: string | null): Promise<boolean> {
  const role = await getUserWorkspaceRole(userId, workspaceId);
  if (role === "OWNER" || role === "ADMIN") return true;
  if (role === "MEMBER" && taskAssigneeId === userId) return true;
  if (role === "VIEWER") return false;
  return false;
}

export async function canManageMembers(userId: string, workspaceId: string): Promise<boolean> {
  const role = await getUserWorkspaceRole(userId, workspaceId);
  return role === "OWNER" || role === "ADMIN";
}
