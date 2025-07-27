import { createProjectDir, ensureProjectsDir } from './operations';

/**
 * Scaffold a new project by creating a blank directory.
 */
export async function scaffoldProject(
  projectId: number | string,
  _projectName: string, // projectName is kept for signature consistency but not used
  _options: { // options are kept for signature consistency but not used
    additionalDependencies?: Record<string, string>;
  } = {}
): Promise<string> {
  // Ensure the projects directory exists
  await ensureProjectsDir();

  // Create the project directory
  const projectPath = await createProjectDir(projectId);

  // Return the path to the newly created empty project directory
  return projectPath;
}

