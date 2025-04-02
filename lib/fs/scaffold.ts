import fs from 'fs/promises';
import path from 'path';

import { createProjectDir, ensureProjectsDir } from './operations';
import { TEMPLATE_DIR } from '@/lib/constants';

/**
 * Copy a directory recursively
 */
async function copyDir(src: string, dest: string, exclude: string[] = []): Promise<void> {
  // Create the destination directory
  await fs.mkdir(dest, { recursive: true });

  // Read the source directory
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    // Skip excluded files/directories
    if (exclude.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      // Recursively copy directories
      await copyDir(srcPath, destPath, exclude);
    } else {
      // Copy files
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Scaffold a new project
 */
export async function scaffoldProject(
  projectId: number | string,
  projectName: string,
  options: {
    additionalDependencies?: Record<string, string>;
  } = {}
): Promise<string> {
  // Ensure the projects directory exists
  await ensureProjectsDir();

  // Create the project directory
  const projectPath = await createProjectDir(projectId);

  const templateDir = TEMPLATE_DIR;

  // Copy the template directory to the project directory
  await copyDir(templateDir, projectPath, [
    'node_modules',
    '.next',
    '.git',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
  ]);

  // Update package.json with project name
  const packageJsonPath = path.join(projectPath, 'package.json');
  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    // Update the name
    packageJson.name = projectName.toLowerCase().replace(/\s+/g, '-');

    // Add additional dependencies if provided
    if (options.additionalDependencies) {
      packageJson.dependencies = {
        ...packageJson.dependencies,
        ...options.additionalDependencies,
      };
    }

    // Write the updated package.json
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.error('Failed to update package.json:', error);
  }

  // Update README.md with project name
  const readmePath = path.join(projectPath, 'README.md');
  try {
    const readmeContent = await fs.readFile(readmePath, 'utf-8');
    const updatedReadme = readmeContent.replace(/^# .*$/m, `# ${projectName}`);
    await fs.writeFile(readmePath, updatedReadme);
  } catch (error) {
    console.error('Failed to update README.md:', error);
  }

  return projectPath;
}

/**
 * Scaffold a project
 */
export async function createProject(
  projectId: number | string,
  projectName: string,
  options: {
    additionalDependencies?: Record<string, string>;
  } = {}
): Promise<string> {
  const { additionalDependencies = {} } = options;

  // Scaffold the project
  const projectPath = await scaffoldProject(projectId, projectName, {
    additionalDependencies,
  });

  return projectPath;
}
