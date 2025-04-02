import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import { getRunner } from '@/lib/preview';

import { getSession } from '@/lib/auth/session';
import { getProjectById } from '@/lib/db/projects';

/**
 * GET /api/projects/[id]/preview
 * Get the preview URL for a project
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

    console.log(`[Preview API] GET request for project ${projectId}`);

    // Get the project
    const project = await getProjectById(projectId);
    if (!project) {
      console.log(`[Preview API] Project ${projectId} not found`);
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if the user has access to the project
    if (project.createdBy !== session.user.id) {
      console.log(`[Preview API] User ${session.user.id} does not have access to project ${projectId}`);
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Get the preview manager
    const runner = await getRunner();
    if (!runner) {
      console.log(`[Preview API] Preview system not available for project ${projectId}`);
      return NextResponse.json(
        { error: 'Preview system not available' },
        { status: 500 }
      );
    }

    console.log(`[Preview API] Checking for existing preview URL for project ${projectId}`);
    
    // Get the preview URL
    let previewUrl = runner.getAppUrl(projectId);
    
    // If no preview URL is in our tracking map, check if we can find it via Docker API
    if (!previewUrl) {
      try {
        console.log(`[Preview API] No tracked preview URL found, checking Docker API for existing container`);
        const containerName = `project-preview-${projectId}`;
        
        // IMPORTANT: For simplicity in this hotfix, we'll use curl to query Docker API directly
        // In a proper fix, this would be integrated into the DockerRunner class
        try {
          // Try to get port mapping for the container if it exists
          const portCheckCmd = `docker inspect --format='{{range $p, $conf := .NetworkSettings.Ports}}{{if eq $p "3000/tcp"}}{{(index $conf 0).HostPort}}{{end}}{{end}}' ${containerName}`;
          const hostPort = execSync(portCheckCmd).toString().trim();
          
          if (hostPort) {
            console.log(`[Preview API] Found existing container with port mapping: ${hostPort}`);
            previewUrl = `http://localhost:${hostPort}`;
            
            // Update our tracking for this URL (simplified version for hotfix)
            // In a proper fix, this would use DockerRunner.containers.set()
            if (runner.updateTrackingForExistingContainer) {
              await runner.updateTrackingForExistingContainer(projectId, containerName, parseInt(hostPort));
            } else {
              console.log(`[Preview API] Warning: DockerRunner doesn't support updateTrackingForExistingContainer`);
              // This is a workaround that directly sets the URL in the runner's map
              // @ts-expect-error - Direct property access for emergency fix only
              runner.urls.set(projectId, previewUrl);
            }
          }
        } catch (inspectError) {
          // Container doesn't exist or inspect failed
          console.log(`[Preview API] No existing container found: ${inspectError}`);
        }
      } catch (dockerCheckError) {
        console.error(`[Preview API] Error checking Docker API: ${dockerCheckError}`);
        // Continue with normal flow, we'll try to create a new container
      }
    }
    
    // If still no preview is available, start a new one
    if (!previewUrl) {
      console.log(`[Preview API] No preview URL found for project ${projectId}, starting a new one`);
      try {
        previewUrl = await runner.startApp(projectId);
        console.log(`[Preview API] Started new preview for project ${projectId} at ${previewUrl}`);
      } catch (error) {
        console.error(`[Preview API] Error starting preview for project ${projectId}:`, error);
        
        // Special handling for container conflict errors
        const errorStr = String(error);
        if (errorStr.includes('Conflict') && errorStr.includes('already in use')) {
          return NextResponse.json(
            { 
              error: 'Container conflict error',
              message: 'A preview container for this project already exists but cannot be accessed. Try restarting the application.',
              details: errorStr
            },
            { status: 409 }
          );
        }
        
        return NextResponse.json(
          { error: `Failed to start preview for this project: ${error}` },
          { status: 500 }
        );
      }
    } else {
      console.log(`[Preview API] Found existing preview URL for project ${projectId}: ${previewUrl}`);
    }

    console.log(`[Preview API] Returning preview URL for project ${projectId}: ${previewUrl}`);
    return NextResponse.json({ previewUrl });
  } catch (error: unknown) {
    console.error('[Preview API] Error getting preview URL:', error);
    
    // Return a more detailed error message
    const errorMessage = error instanceof Error ? 
      `${error.message}\n${error.stack}` : 
      String(error);
      
    return NextResponse.json(
      { 
        error: 'Internal Server Error', 
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/preview
 * Start a preview for a project
 */
export async function POST(
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

    // Get the preview manager
    const runner = await getRunner();
    if (!runner) {
      return NextResponse.json(
        { error: 'Preview system not available' },
        { status: 500 }
      );
    }

    // Start the preview
    const previewUrl = await runner.startApp(projectId);

    return NextResponse.json({ previewUrl });
  } catch (error: unknown) {
    console.error('Error starting preview:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id]/preview
 * Stop a preview for a project
 */
export async function DELETE(
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

    // Get the preview manager
    const runner = await getRunner();
    if (!runner) {
      return NextResponse.json(
        { error: 'Preview system not available' },
        { status: 500 }
      );
    }

    // Stop the preview
    await runner.stopApp(projectId);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Error stopping preview:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
} 