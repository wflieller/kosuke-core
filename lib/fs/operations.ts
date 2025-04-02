import fs from 'fs/promises';
import path from 'path';
import { FILE_EXPLORER } from '@/lib/constants';

/**
 * File node interface
 */
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  hasChanges?: boolean;
}

/**
 * Base directory for project files
 * This is where all project files will be stored
 */
const PROJECTS_DIR = process.env.PROJECTS_DIR || path.join(process.cwd(), 'projects');

/**
 * Ensure the projects directory exists
 */
export async function ensureProjectsDir(): Promise<void> {
  try {
    await fs.mkdir(PROJECTS_DIR, { recursive: true });
  } catch (error) {
    console.error('Failed to create projects directory:', error);
    throw error;
  }
}

/**
 * Get the absolute path to a project directory
 */
export function getProjectPath(projectId: number | string): string {
  return path.join(PROJECTS_DIR, projectId.toString());
}

/**
 * Create a project directory
 */
export async function createProjectDir(projectId: number | string): Promise<string> {
  const projectPath = getProjectPath(projectId);

  try {
    await fs.mkdir(projectPath, { recursive: true });
    return projectPath;
  } catch (error) {
    console.error(`Failed to create project directory for project ${projectId}:`, error);
    throw error;
  }
}

/**
 * Check if a file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Create a file with the given content
 */
export async function createFile(filePath: string, content: string): Promise<void> {
  try {
    // Ensure the directory exists
    const dirPath = path.dirname(filePath);
    await fs.mkdir(dirPath, { recursive: true });

    // Write the file
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    console.error(`Failed to create file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Read a file's content
 */
export async function readFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    console.error(`Failed to read file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Update a file's content
 */
export async function updateFile(filePath: string, content: string): Promise<void> {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
  } catch (error) {
    console.error(`Failed to update file ${filePath}:`, error);
    throw error;
  }
}

/**
 * Delete a file
 */
export async function deleteFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error(`Failed to delete file ${filePath}:`, error);
    throw error;
  }
}

/**
 * List files in a directory
 */
export async function listFiles(dirPath: string): Promise<string[]> {
  try {
    return await fs.readdir(dirPath);
  } catch (error) {
    console.error(`Failed to list files in directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * List files in a directory recursively
 */
export async function listFilesRecursively(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  async function traverse(currentPath: string, relativePath: string = '') {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const entryPath = path.join(currentPath, entry.name);
      const entryRelativePath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        await traverse(entryPath, entryRelativePath);
      } else {
        files.push(entryRelativePath);
      }
    }
  }

  await traverse(dirPath);
  return files;
}

/**
 * Copy a file
 */
export async function copyFile(sourcePath: string, destinationPath: string): Promise<void> {
  try {
    // Ensure the destination directory exists
    const destDir = path.dirname(destinationPath);
    await fs.mkdir(destDir, { recursive: true });

    await fs.copyFile(sourcePath, destinationPath);
  } catch (error) {
    console.error(`Failed to copy file from ${sourcePath} to ${destinationPath}:`, error);
    throw error;
  }
}

/**
 * Copy a directory recursively
 */
export async function copyDir(sourceDir: string, destinationDir: string): Promise<void> {
  try {
    // Create the destination directory
    await fs.mkdir(destinationDir, { recursive: true });

    // Read the source directory
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });

    // Process each entry
    for (const entry of entries) {
      const srcPath = path.join(sourceDir, entry.name);
      const destPath = path.join(destinationDir, entry.name);

      if (entry.isDirectory()) {
        // Recursively copy directories
        await copyDir(srcPath, destPath);
      } else {
        // Copy files
        await fs.copyFile(srcPath, destPath);
      }
    }
  } catch (error) {
    console.error(`Failed to copy directory from ${sourceDir} to ${destinationDir}:`, error);
    throw error;
  }
}

/**
 * Delete a directory and all its contents
 */
export async function deleteDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
  } catch (error) {
    console.error(`Failed to delete directory ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Get all files for a project
 */
export async function getProjectFiles(projectId: number): Promise<FileNode[]> {
  try {
    const projectDir = getProjectPath(projectId);

    // Check if the project directory exists
    try {
      await fs.access(projectDir);
    } catch (error) {
      console.error(`Project directory not found: ${projectDir} (${error})`);
      return [];
    }

    // Read the directory recursively
    return readDirectoryRecursive(projectDir, '');
  } catch (error) {
    console.error('Error getting project files:', error);
    throw error;
  }
}

/**
 * Read a directory recursively
 */
async function readDirectoryRecursive(basePath: string, relativePath: string): Promise<FileNode[]> {
  const fullPath = path.join(basePath, relativePath);
  const entries = await fs.readdir(fullPath, { withFileTypes: true });

  const nodes: FileNode[] = [];

  for (const entry of entries) {
    const entryRelativePath = path.join(relativePath, entry.name);

    // Skip excluded directories
    if (entry.isDirectory() && FILE_EXPLORER.EXCLUDE_DIRS.includes(entry.name)) {
      continue;
    }

    if (entry.isDirectory()) {
      const children = await readDirectoryRecursive(basePath, entryRelativePath);

      nodes.push({
        name: entry.name,
        path: entryRelativePath,
        type: 'directory',
        children,
      });
    } else {
      nodes.push({
        name: entry.name,
        path: entryRelativePath,
        type: 'file',
        hasChanges: false,
      });
    }
  }

  // Sort directories first, then files, both alphabetically
  return nodes.sort((a, b) => {
    if (a.type === 'directory' && b.type === 'file') return -1;
    if (a.type === 'file' && b.type === 'directory') return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * Get the content of a file in a project
 */
export async function getFileContent(projectId: number, filePath: string): Promise<string> {
  try {
    const projectDir = getProjectPath(projectId);
    const fullPath = path.join(projectDir, filePath);

    // Check if the file exists
    await fs.access(fullPath);

    // Read the file content using the existing readFile function
    return await readFile(fullPath);
  } catch (error) {
    console.error('Error reading file:', error);
    throw error;
  }
}
