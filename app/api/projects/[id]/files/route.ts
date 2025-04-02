import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth/session';
import { getProjectById } from '@/lib/db/projects';
import { getProjectFiles } from '@/lib/fs/operations';

/**
 * GET /api/projects/[id]/files
 * Get files for a specific project
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const projectId = Number(id);
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

    // Get the project files using the shared file operations
    const files = await getProjectFiles(projectId);

    return NextResponse.json({ files });
  } catch (error) {
    console.error('Error getting project files:', error);
    return NextResponse.json(
      { error: 'Failed to get project files' },
      { status: 500 }
    );
  }
} 