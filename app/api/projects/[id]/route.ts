import { NextRequest } from 'next/server';
import { z } from 'zod';

import { ApiErrorHandler } from '@/lib/api/errors';
import { ApiResponseHandler } from '@/lib/api/responses';
import { withProjectAccess, RouteContext } from '@/lib/auth/middleware';
import { updateProject, archiveProject } from '@/lib/db/projects';
import { getRunner } from '@/lib/preview';

// Schema for updating a project
const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
});

/**
 * GET /api/projects/[id]
 * Get a specific project
 */
export const GET = withProjectAccess(
  async (req: NextRequest, context: RouteContext) => {
    if (!context.project) {
      return ApiErrorHandler.notFound('Project not found');
    }
    return ApiResponseHandler.success(context.project);
  }
);

/**
 * PATCH /api/projects/[id]
 * Update a project
 */
export const PATCH = withProjectAccess(
  async (req: NextRequest, context: RouteContext) => {
    try {
      if (!context.project) {
        return ApiErrorHandler.notFound('Project not found');
      }

      // Parse the request body
      const body = await req.json();
      
      // Validate the request body
      const result = updateProjectSchema.safeParse(body);
      if (!result.success) {
        return ApiErrorHandler.validationError(result.error);
      }

      // Update the project
      const updatedProject = await updateProject(context.project.id, result.data);

      return ApiResponseHandler.success(updatedProject);
    } catch (error) {
      return ApiErrorHandler.handle(error);
    }
  }
);

/**
 * DELETE /api/projects/[id]
 * Archive a project (soft delete)
 */
export const DELETE = withProjectAccess(
  async (req: NextRequest, context: RouteContext) => {
    try {
      if (!context.project) {
        return ApiErrorHandler.notFound('Project not found');
      }

      // First, try to stop the project preview if it's running
      try {
        const runner = await getRunner();
        if (runner) {
          console.log(`Stopping preview for project ${context.project.id} before archiving`);
          await runner.stopApp(context.project.id);
          console.log(`Preview for project ${context.project.id} stopped successfully`);
        }
      } catch (previewError) {
        // Log but continue - we still want to archive the project even if stopping the preview fails
        console.error(`Error stopping preview for project ${context.project.id}:`, previewError);
      }

      // Archive the project
      const archivedProject = await archiveProject(context.project.id);

      return ApiResponseHandler.success(archivedProject);
    } catch (error) {
      return ApiErrorHandler.handle(error);
    }
  }
); 