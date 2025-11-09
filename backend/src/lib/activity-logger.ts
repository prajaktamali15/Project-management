import { prisma } from "@/lib/prisma";

/**
 * Centralized activity logging service
 * Single responsibility: Track all user actions across the system
 */

export interface ActivityLogParams {
  action: string;
  targetType: string;
  targetId: string;
  workspaceId: string;
  projectId?: string;
  userId: string;
  metadata?: Record<string, any>;
}

export class ActivityLogger {
  /**
   * Log an activity to the database
   */
  static async log(params: ActivityLogParams): Promise<void> {
    try {
      await prisma.activity.create({
        data: {
          action: params.action,
          targetType: params.targetType,
          targetId: params.targetId,
          workspaceId: params.workspaceId,
          projectId: params.projectId,
          userId: params.userId,
          metadata: params.metadata,
        },
      });
    } catch (error) {
      // Log error but don't fail the main operation
      console.error("Failed to log activity:", error);
    }
  }

  /**
   * Log workspace-related activity
   */
  static async logWorkspaceActivity(
    action: string,
    workspaceId: string,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    return this.log({
      action,
      targetType: "workspace",
      targetId: workspaceId,
      workspaceId,
      userId,
      metadata,
    });
  }

  /**
   * Log project-related activity
   */
  static async logProjectActivity(
    action: string,
    projectId: string,
    workspaceId: string,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    return this.log({
      action,
      targetType: "project",
      targetId: projectId,
      workspaceId,
      projectId,
      userId,
      metadata,
    });
  }

  /**
   * Log task-related activity
   */
  static async logTaskActivity(
    action: string,
    taskId: string,
    projectId: string,
    workspaceId: string,
    userId: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    return this.log({
      action,
      targetType: "task",
      targetId: taskId,
      workspaceId,
      projectId,
      userId,
      metadata,
    });
  }
}
