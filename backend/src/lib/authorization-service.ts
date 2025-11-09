import { prisma } from "@/lib/prisma";

export type Role = "OWNER" | "ADMIN" | "MEMBER" | "VIEWER";

export interface AuthorizationResult {
  allowed: boolean;
  role?: Role;
  reason?: string;
}

/**
 * Unified authorization service for both workspaces and projects
 * Eliminates code duplication between rbac.ts and project-rbac.ts
 */
export class AuthorizationService {
  /**
   * Check if user has required role in a workspace
   */
  async checkWorkspaceAccess(
    userId: string,
    workspaceId: string,
    allowedRoles: Role[]
  ): Promise<AuthorizationResult> {
    // Check if user is workspace owner
    const workspace = await prisma.workspace.findUnique({ 
      where: { id: workspaceId } 
    });
    
    if (!workspace) {
      return { allowed: false, reason: "Workspace not found" };
    }

    if (workspace.ownerId === userId && allowedRoles.includes("OWNER")) {
      return { allowed: true, role: "OWNER" };
    }

    // Check workspace membership
    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });

    if (!membership) {
      return { allowed: false, reason: "Not a workspace member" };
    }

    const userRole = membership.role as Role;
    if (!allowedRoles.includes(userRole)) {
      return { allowed: false, reason: "Insufficient permissions" };
    }

    return { allowed: true, role: userRole };
  }

  /**
   * Check if user has required role in a project
   */
  async checkProjectAccess(
    userId: string,
    projectId: string,
    allowedRoles: Role[]
  ): Promise<AuthorizationResult> {
    // Get project and its workspace
    const project = await prisma.project.findUnique({ 
      where: { id: projectId },
      include: { workspace: true }
    });

    if (!project) {
      return { allowed: false, reason: "Project not found" };
    }

    // Check if user is workspace owner (has implicit access)
    if (project.workspace.ownerId === userId && allowedRoles.includes("OWNER")) {
      return { allowed: true, role: "OWNER" };
    }

    // Check project membership
    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });

    if (!membership) {
      return { allowed: false, reason: "Not a project member" };
    }

    const userRole = membership.role as Role;
    if (!allowedRoles.includes(userRole)) {
      return { allowed: false, reason: "Insufficient permissions" };
    }

    return { allowed: true, role: userRole };
  }

  /**
   * Get user's role in a workspace
   */
  async getWorkspaceRole(userId: string, workspaceId: string): Promise<Role | null> {
    const workspace = await prisma.workspace.findUnique({ 
      where: { id: workspaceId } 
    });

    if (workspace?.ownerId === userId) {
      return "OWNER";
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });

    return membership ? (membership.role as Role) : null;
  }

  /**
   * Get user's role in a project
   */
  async getProjectRole(userId: string, projectId: string): Promise<Role | null> {
    const project = await prisma.project.findUnique({ 
      where: { id: projectId },
      include: { workspace: true }
    });

    if (!project) return null;

    if (project.workspace.ownerId === userId) {
      return "OWNER";
    }

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });

    return membership ? (membership.role as Role) : null;
  }

  /**
   * Check if user can edit a task
   */
  async canEditTask(
    userId: string,
    workspaceId: string,
    taskAssigneeId: string | null
  ): Promise<boolean> {
    const role = await this.getWorkspaceRole(userId, workspaceId);
    
    if (role === "OWNER" || role === "ADMIN") return true;
    if (role === "MEMBER" && taskAssigneeId === userId) return true;
    
    return false;
  }

  /**
   * Check if user can manage members
   */
  async canManageMembers(userId: string, workspaceId: string): Promise<boolean> {
    const role = await this.getWorkspaceRole(userId, workspaceId);
    return role === "OWNER" || role === "ADMIN";
  }

  /**
   * Check if user is workspace owner
   */
  async isWorkspaceOwner(userId: string, workspaceId: string): Promise<boolean> {
    const workspace = await prisma.workspace.findUnique({ 
      where: { id: workspaceId } 
    });
    return workspace?.ownerId === userId || false;
  }

  /**
   * Require workspace access or throw error
   */
  async requireWorkspaceAccess(
    userId: string,
    workspaceId: string,
    allowedRoles: Role[]
  ): Promise<Role> {
    const result = await this.checkWorkspaceAccess(userId, workspaceId, allowedRoles);
    
    if (!result.allowed) {
      throw new Error(result.reason || "Access denied");
    }
    
    return result.role!;
  }

  /**
   * Require project access or throw error
   */
  async requireProjectAccess(
    userId: string,
    projectId: string,
    allowedRoles: Role[]
  ): Promise<Role> {
    const result = await this.checkProjectAccess(userId, projectId, allowedRoles);
    
    if (!result.allowed) {
      throw new Error(result.reason || "Access denied");
    }
    
    return result.role!;
  }
}

// Export singleton instance
export const authService = new AuthorizationService();
