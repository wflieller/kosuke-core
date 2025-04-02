import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getProjectById } from '@/lib/db/projects';
import { getRunner } from '@/lib/preview';

/**
 * GET /api/projects/[id]/preview/status
 * Check the status of a project preview
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the session
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const projectId = Number(params.id);
    if (isNaN(projectId)) {
      return NextResponse.json(
        { error: 'Invalid project ID' },
        { status: 400 }
      );
    }

    // Get the project
    const project = await getProjectById(projectId);
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if the user has access to the project
    if (project.createdBy !== session.user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get the preview manager
    const runner = await getRunner();
    if (!runner) {
      return NextResponse.json(
        { error: 'Preview system not available' },
        { status: 500 }
      );
    }
    
    // Get the project status
    const status = await runner.getProjectStatus(projectId);

    return NextResponse.json(status);
  } catch (error: unknown) {
    console.error('Error getting preview status:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 